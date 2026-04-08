const router = require('express').Router();
const uazapi = require('../services/uazapi');
const { supabase } = require('../lib/supabase');

function extractError(err) {
  if (err.response) {
    const ct = err.response.headers?.['content-type'] || '';
    if (ct.includes('json')) return err.response.data?.message || err.response.data?.error || JSON.stringify(err.response.data);
    return `UazAPI retornou status ${err.response.status}: ${String(err.response.data).slice(0, 200)}`;
  }
  return err.message;
}

// POST /api/instances/connect — registra instância existente pelo token
router.post('/connect', async (req, res) => {
  try {
    const { name, instanceToken } = req.body;
    if (!name || !instanceToken) {
      return res.status(400).json({ error: 'name e instanceToken são obrigatórios' });
    }

    // Salva no Supabase com o token da instância
    const { data, error } = await supabase
      .from('wa_instances')
      .insert({ name, instance_id: instanceToken, status: 'connecting' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: extractError(err) });
  }
});

// GET /api/instances/:instanceToken/qrcode
router.get('/:instanceToken/qrcode', async (req, res) => {
  try {
    const data = await uazapi.getQRCodeByToken(req.params.instanceToken);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: extractError(err) });
  }
});

// GET /api/instances/:instanceToken/status
router.get('/:instanceToken/status', async (req, res) => {
  try {
    const data = await uazapi.getStatusByToken(req.params.instanceToken);

    const isConnected = data.status === 'connected' || data.connected === true || data.state === 'open';
    if (isConnected) {
      await supabase
        .from('wa_instances')
        .update({
          status: 'connected',
          phone: data.phone || data.phoneNumber || data.jid?.split('@')[0] || null,
          connected_at: new Date().toISOString(),
        })
        .eq('instance_id', req.params.instanceToken);
    }

    res.json({ ...data, isConnected });
  } catch (err) {
    res.status(500).json({ error: extractError(err) });
  }
});

// POST /api/instances/:instanceToken/disconnect
router.post('/:instanceToken/disconnect', async (req, res) => {
  try {
    await uazapi.disconnectByToken(req.params.instanceToken);
    await supabase
      .from('wa_instances')
      .update({ status: 'disconnected', connected_at: null })
      .eq('instance_id', req.params.instanceToken);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: extractError(err) });
  }
});

module.exports = router;
