const router = require('express').Router();
const { supabase } = require('../lib/supabase');
const { generateVariations } = require('../services/ai-variation');
const { getRandomDelay, getReactivationTypingDelay } = require('../services/scheduler');
const { startReactivation, pauseReactivation, stopReactivation } = require('../services/reactivation-runner');

// GET /api/reactivation/stats — contagem de contacts por reactivation_count (1, 2, 3)
// IMPORTANTE: definido antes de /:id para não ser capturado pelo param
router.get('/stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('reactivation_count');

    if (error) throw new Error(error.message);

    const contacts = data || [];
    const stats = {
      once:   contacts.filter(c => c.reactivation_count === 1).length,
      twice:  contacts.filter(c => c.reactivation_count === 2).length,
      thrice: contacts.filter(c => c.reactivation_count === 3).length,
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reactivation — lista campanhas ordenadas por created_at desc
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reactivation_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reactivation — cria campanha + dispatches
router.post('/', async (req, res) => {
  try {
    const { name, instance_id, contacts, reference_messages, interval_min, interval_max } = req.body;

    if (!name || !instance_id || !contacts?.length || !reference_messages?.length || !interval_min || !interval_max) {
      return res.status(400).json({ error: 'name, instance_id, contacts, reference_messages, interval_min e interval_max são obrigatórios' });
    }

    if (reference_messages.length !== 5) {
      return res.status(400).json({ error: 'reference_messages deve conter exatamente 5 mensagens' });
    }

    // Cria a campanha
    const { data: campaign, error: campErr } = await supabase
      .from('reactivation_campaigns')
      .insert({
        name,
        instance_id,
        reference_messages,
        interval_min: Number(interval_min),
        interval_max: Number(interval_max),
        status: 'draft',
        total_leads: contacts.length,
        sent_count: 0,
        failed_count: 0,
      })
      .select()
      .single();

    if (campErr) throw new Error(campErr.message);

    // Cria um dispatch por lead
    const dispatchRows = contacts.map(c => ({
      reactivation_campaign_id: campaign.id,
      lead_id: c.id || null,
      phone: c.phone,
      status: 'pending',
    }));

    const { error: dispErr } = await supabase.from('reactivation_dispatches').insert(dispatchRows);
    if (dispErr) throw new Error(dispErr.message);

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reactivation/:id/prepare — gera variações via IA e salva nos dispatches
router.post('/:id/prepare', async (req, res) => {
  try {
    const { id } = req.params;

    // Busca a campanha
    const { data: campaign, error: campErr } = await supabase
      .from('reactivation_campaigns')
      .select('id, reference_messages, interval_min, interval_max, status')
      .eq('id', id)
      .single();

    if (campErr || !campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (campaign.status === 'running') {
      return res.status(400).json({ error: 'Pause a campanha antes de preparar novamente' });
    }

    // Busca dispatches pendentes
    const { data: dispatches, error: dispErr } = await supabase
      .from('reactivation_dispatches')
      .select('id')
      .eq('reactivation_campaign_id', id)
      .eq('status', 'pending');

    if (dispErr) throw new Error(dispErr.message);
    if (!dispatches || dispatches.length === 0) {
      return res.status(400).json({ error: 'Nenhum dispatch pendente para preparar' });
    }

    // Chama a API da Anthropic — UMA única chamada com todas as variações
    let variations;
    try {
      variations = await generateVariations(campaign.reference_messages, dispatches.length);
    } catch (aiErr) {
      console.error('[reactivation:prepare] erro na API Anthropic:', aiErr.message);
      return res.status(502).json({ error: 'Falha ao gerar variações de mensagem via IA. Tente novamente.' });
    }

    // Gera todos os valores antes de salvar — salva somente após gerar tudo com sucesso
    const updates = dispatches.map((d, i) => ({
      id: d.id,
      message_sent: variations[i],
      typing_delay: getReactivationTypingDelay(),
      interval_delay_ms: getRandomDelay(campaign.interval_min, campaign.interval_max),
    }));

    // Salva em batch
    for (const u of updates) {
      const { error: upErr } = await supabase
        .from('reactivation_dispatches')
        .update({
          message_sent: u.message_sent,
          typing_delay: u.typing_delay,
          interval_delay_ms: u.interval_delay_ms,
        })
        .eq('id', u.id);
      if (upErr) throw new Error(upErr.message);
    }

    // Retorna as primeiras 3 variações para preview
    res.json({
      ok: true,
      count: dispatches.length,
      preview: variations.slice(0, 3),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reactivation/:id/start
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    // Valida que todos os dispatches pendentes estão preparados
    const { data: unprepared } = await supabase
      .from('reactivation_dispatches')
      .select('id')
      .eq('reactivation_campaign_id', id)
      .eq('status', 'pending')
      .or('message_sent.is.null,typing_delay.is.null');

    if (unprepared && unprepared.length > 0) {
      return res.status(400).json({
        error: `Execute "Preparar Reativação" antes de iniciar — ${unprepared.length} lead(s) sem mensagem gerada.`,
      });
    }

    await startReactivation(id, req.app.get('io'));
    res.json({ ok: true, status: 'running' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reactivation/:id/pause
router.post('/:id/pause', async (req, res) => {
  try {
    await pauseReactivation(req.params.id, req.app.get('io'));
    res.json({ ok: true, status: 'paused' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reactivation/:id/stop
router.post('/:id/stop', async (req, res) => {
  try {
    await stopReactivation(req.params.id, req.app.get('io'));
    res.json({ ok: true, status: 'cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reactivation/:id — detalhe + dispatches
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [{ data: campaign, error: campErr }, { data: dispatches, error: dispErr }] = await Promise.all([
      supabase.from('reactivation_campaigns').select('*').eq('id', id).single(),
      supabase.from('reactivation_dispatches').select('*').eq('reactivation_campaign_id', id).order('created_at'),
    ]);

    if (campErr || !campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (dispErr) throw new Error(dispErr.message);

    res.json({ ...campaign, dispatches: dispatches || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
