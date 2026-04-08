const router = require('express').Router();
const uazapi = require('../services/uazapi');
const { supabase } = require('../lib/supabase');

function extractError(err) {
  // Axios errors com resposta HTML/texto da API externa
  if (err.response) {
    const ct = err.response.headers?.['content-type'] || '';
    if (ct.includes('json')) return err.response.data?.message || err.response.data?.error || JSON.stringify(err.response.data);
    return `UazAPI retornou status ${err.response.status}: ${String(err.response.data).slice(0, 200)}`;
  }
  return err.message;
}

// POST /api/instances — cria instância no UazAPI e salva no Supabase
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name é obrigatório' });

    const result = await uazapi.createInstance(name);
    const instanceId = result.instanceId || result.id || result.instance_id || result.name;

    const { data, error } = await supabase
      .from('wa_instances')
      .insert({ name, instance_id: instanceId, status: 'connecting' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.json({ ...data, uazapi: result });
  } catch (err) {
    res.status(500).json({ error: extractError(err) });
  }
});

// GET /api/instances/:instanceId/qrcode
router.get('/:instanceId/qrcode', async (req, res) => {
  try {
    const data = await uazapi.getQRCode(req.params.instanceId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: extractError(err) });
  }
});

// GET /api/instances/:instanceId/status
router.get('/:instanceId/status', async (req, res) => {
  try {
    const data = await uazapi.getStatus(req.params.instanceId);

    const isConnected = data.status === 'connected' || data.connected === true || data.state === 'open';
    if (isConnected) {
      await supabase
        .from('wa_instances')
        .update({
          status: 'connected',
          phone: data.phone || data.phoneNumber || data.jid?.split('@')[0] || null,
          connected_at: new Date().toISOString(),
        })
        .eq('instance_id', req.params.instanceId);
    }

    res.json({ ...data, isConnected });
  } catch (err) {
    res.status(500).json({ error: extractError(err) });
  }
});

// POST /api/instances/:instanceId/disconnect
router.post('/:instanceId/disconnect', async (req, res) => {
  try {
    await uazapi.disconnect(req.params.instanceId);
    await supabase
      .from('wa_instances')
      .update({ status: 'disconnected', connected_at: null })
      .eq('instance_id', req.params.instanceId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: extractError(err) });
  }
});

module.exports = router;
