const router = require('express').Router();
const { supabase } = require('../lib/supabase');
const { startCampaign, pauseCampaign, stopCampaign, isRunning } = require('../services/campaign-runner');
const { INTERVAL_OPTIONS } = require('../services/scheduler');

// GET /api/campaigns/intervals
router.get('/intervals', (req, res) => {
  res.json(INTERVAL_OPTIONS);
});

// POST /api/campaigns — cria campanha (modo automático: niche+quantity | modo manual: phones)
router.post('/', async (req, res) => {
  try {
    const { name, template_id, instance_id, interval_min, interval_max, phones, niche, quantity } = req.body;

    if (!name || !instance_id || !interval_min || !interval_max) {
      return res.status(400).json({ error: 'name, instance_id, interval_min e interval_max são obrigatórios' });
    }

    let phoneList = [];

    if (niche && quantity) {
      // Modo automático: busca contatos do nicho que ainda não foram enviados
      const { data: contacts, error: cErr } = await supabase
        .from('contacts')
        .select('phone')
        .eq('niche', niche)
        .eq('sent_count', 0)
        .order('created_at')
        .limit(Number(quantity));

      if (cErr) throw new Error(cErr.message);
      if (!contacts || contacts.length === 0) {
        return res.status(400).json({ error: `Nenhum contato disponível no nicho "${niche}"` });
      }
      phoneList = contacts.map(c => c.phone);
    } else if (phones) {
      // Modo manual: números colados pelo usuário
      phoneList = phones.split('\n').map(p => p.trim().replace(/\D/g, '')).filter(p => p.length >= 10);
      if (phoneList.length === 0) {
        return res.status(400).json({ error: 'Adicione pelo menos um número válido' });
      }
    } else {
      return res.status(400).json({ error: 'Forneça niche+quantity ou phones' });
    }

    // Cria campanha
    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .insert({
        name,
        template_id: template_id || null,
        instance_id,
        interval_min: Number(interval_min),
        interval_max: Number(interval_max),
        status: 'draft',
        total_leads: phoneList.length,
        sent_count: 0,
        failed_count: 0,
      })
      .select()
      .single();

    if (campErr) throw new Error(campErr.message);

    // Cria dispatches
    const { error: dispErr } = await supabase.from('dispatches').insert(
      phoneList.map(phone => ({ campaign_id: campaign.id, phone, status: 'pending' }))
    );
    if (dispErr) throw new Error(dispErr.message);

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/campaigns/:id — edita campanha (apenas se draft ou paused)
router.put('/:id', async (req, res) => {
  try {
    const { name, template_id, instance_id, interval_min, interval_max } = req.body;

    const { data: current } = await supabase.from('campaigns').select('status').eq('id', req.params.id).single();
    if (current?.status === 'running') {
      return res.status(400).json({ error: 'Pause a campanha antes de editar' });
    }

    const { data, error } = await supabase
      .from('campaigns')
      .update({ name, template_id: template_id || null, instance_id, interval_min, interval_max })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/start
router.post('/:id/start', async (req, res) => {
  try {
    await startCampaign(req.params.id, req.app.get('io'));
    res.json({ ok: true, status: 'running' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/pause
router.post('/:id/pause', async (req, res) => {
  try {
    await pauseCampaign(req.params.id, req.app.get('io'));
    res.json({ ok: true, status: 'paused' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/stop
router.post('/:id/stop', async (req, res) => {
  try {
    await stopCampaign(req.params.id, req.app.get('io'));
    res.json({ ok: true, status: 'cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('campaigns').select('*').eq('id', req.params.id).single();
    if (error) throw new Error(error.message);
    res.json({ ...data, is_running: isRunning(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
