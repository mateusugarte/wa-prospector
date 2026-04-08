const router = require('express').Router();
const { supabase } = require('../lib/supabase');
const { startCampaign, pauseCampaign, stopCampaign, isRunning } = require('../services/campaign-runner');
const { INTERVAL_OPTIONS } = require('../services/scheduler');
const { preview } = require('../services/spinner');

// GET /api/campaigns/intervals — lista opções de intervalo
router.get('/intervals', (req, res) => {
  res.json(INTERVAL_OPTIONS);
});

// POST /api/campaigns — cria campanha com leads
router.post('/', async (req, res) => {
  try {
    const { name, template_id, instance_id, interval_min, interval_max, phones } = req.body;

    if (!name || !instance_id || !interval_min || !interval_max) {
      return res.status(400).json({ error: 'name, instance_id, interval_min e interval_max são obrigatórios' });
    }

    const phoneList = (phones || '')
      .split('\n')
      .map(p => p.trim().replace(/\D/g, ''))
      .filter(p => p.length >= 10);

    if (phoneList.length === 0) {
      return res.status(400).json({ error: 'Adicione pelo menos um número de telefone válido' });
    }

    // Cria a campanha
    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .insert({
        name,
        template_id: template_id || null,
        instance_id,
        interval_min,
        interval_max,
        status: 'draft',
        total_leads: phoneList.length,
        sent_count: 0,
        failed_count: 0,
      })
      .select()
      .single();

    if (campErr) throw new Error(campErr.message);

    // Cria os dispatches
    const dispatches = phoneList.map(phone => ({
      campaign_id: campaign.id,
      phone,
      status: 'pending',
    }));

    const { error: dispErr } = await supabase.from('dispatches').insert(dispatches);
    if (dispErr) throw new Error(dispErr.message);

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/start
router.post('/:id/start', async (req, res) => {
  try {
    const io = req.app.get('io');
    await startCampaign(req.params.id, io);
    res.json({ ok: true, status: 'running' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/pause
router.post('/:id/pause', async (req, res) => {
  try {
    const io = req.app.get('io');
    await pauseCampaign(req.params.id, io);
    res.json({ ok: true, status: 'paused' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/stop
router.post('/:id/stop', async (req, res) => {
  try {
    const io = req.app.get('io');
    await stopCampaign(req.params.id, io);
    res.json({ ok: true, status: 'cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id — detalhes da campanha
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw new Error(error.message);
    res.json({ ...data, is_running: isRunning(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
