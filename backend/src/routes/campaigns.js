const router = require('express').Router();
const { supabase } = require('../lib/supabase');
const { startCampaign, pauseCampaign, stopCampaign, isRunning } = require('../services/campaign-runner');
const { INTERVAL_OPTIONS, getTypingDelay } = require('../services/scheduler');
const { spin } = require('../services/spinner');

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
      // Salva os números na tabela contacts (nicho 'manual') para persistir no banco
      const contactRecords = phoneList.map(phone => ({ phone, name: null, niche: 'manual', sent_count: 0 }));
      const { error: contactErr } = await supabase
        .from('contacts')
        .upsert(contactRecords, { onConflict: 'phone,niche', ignoreDuplicates: true });
      if (contactErr) throw new Error(contactErr.message);
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

// DELETE /api/campaigns/:id — remove campanha e todos os dispatches
router.delete('/:id', async (req, res) => {
  try {
    const { data: current } = await supabase.from('campaigns').select('status').eq('id', req.params.id).single();
    if (current?.status === 'running') {
      return res.status(400).json({ error: 'Pause ou encerre a campanha antes de excluir' });
    }
    const { error } = await supabase.from('campaigns').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/contacts — adiciona contatos a uma campanha existente
router.post('/:id/contacts', async (req, res) => {
  try {
    const { phones, niche, quantity } = req.body;

    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .select('id, status, total_leads')
      .eq('id', req.params.id)
      .single();

    if (campErr || !campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (campaign.status === 'cancelled' || campaign.status === 'completed') {
      return res.status(400).json({ error: 'Não é possível adicionar contatos a uma campanha encerrada ou concluída' });
    }

    let phoneList = [];

    if (niche && quantity) {
      // Busca contatos do nicho não enviados e que ainda não estão nessa campanha
      const { data: existing } = await supabase
        .from('dispatches')
        .select('phone')
        .eq('campaign_id', req.params.id);
      const existingPhones = new Set((existing || []).map(d => d.phone));

      const { data: contacts, error: cErr } = await supabase
        .from('contacts')
        .select('phone')
        .eq('niche', niche)
        .eq('sent_count', 0)
        .order('created_at')
        .limit(Number(quantity) + existingPhones.size);

      if (cErr) throw new Error(cErr.message);
      phoneList = (contacts || []).map(c => c.phone).filter(p => !existingPhones.has(p)).slice(0, Number(quantity));
      if (phoneList.length === 0) {
        return res.status(400).json({ error: `Nenhum contato novo disponível no nicho "${niche}"` });
      }
    } else if (phones) {
      const parsed = phones.split('\n').map(p => p.trim().replace(/\D/g, '')).filter(p => p.length >= 10);
      if (parsed.length === 0) return res.status(400).json({ error: 'Adicione pelo menos um número válido' });

      // Ignora duplicatas já na campanha
      const { data: existing } = await supabase
        .from('dispatches')
        .select('phone')
        .eq('campaign_id', req.params.id);
      const existingPhones = new Set((existing || []).map(d => d.phone));
      phoneList = parsed.filter(p => !existingPhones.has(p));
      if (phoneList.length === 0) return res.status(400).json({ error: 'Todos os números informados já estão na campanha' });

      // Salva no banco de contatos (nicho manual)
      const contactRecords = phoneList.map(phone => ({ phone, name: null, niche: 'manual', sent_count: 0 }));
      const { error: contactErr } = await supabase
        .from('contacts')
        .upsert(contactRecords, { onConflict: 'phone,niche', ignoreDuplicates: true });
      if (contactErr) throw new Error(contactErr.message);
    } else {
      return res.status(400).json({ error: 'Forneça phones ou niche+quantity' });
    }

    // Insere novos dispatches
    const { error: dispErr } = await supabase.from('dispatches').insert(
      phoneList.map(phone => ({ campaign_id: req.params.id, phone, status: 'pending' }))
    );
    if (dispErr) throw new Error(dispErr.message);

    // Atualiza total_leads
    const { error: updErr } = await supabase
      .from('campaigns')
      .update({ total_leads: campaign.total_leads + phoneList.length })
      .eq('id', req.params.id);
    if (updErr) throw new Error(updErr.message);

    res.json({ ok: true, added: phoneList.length });
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

// GET /api/campaigns/:id/dispatches — lista os disparos da campanha
router.get('/:id/dispatches', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dispatches')
      .select('id, phone, status, message_sent, typing_delay, sent_at, error')
      .eq('campaign_id', req.params.id)
      .order('created_at');
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/shuffle — pré-gera mensagem única + delay de digitação por contato
router.post('/:id/shuffle', async (req, res) => {
  try {
    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .select('template_id, status')
      .eq('id', req.params.id)
      .single();

    if (campErr || !campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (campaign.status === 'running') return res.status(400).json({ error: 'Pause a campanha antes de misturar' });
    if (!campaign.template_id) return res.status(400).json({ error: 'Campanha sem template — selecione um template primeiro' });

    const { data: template, error: tplErr } = await supabase
      .from('templates')
      .select('content')
      .eq('id', campaign.template_id)
      .single();

    if (tplErr || !template) return res.status(400).json({ error: 'Template não encontrado' });

    const { data: dispatches, error: dispErr } = await supabase
      .from('dispatches')
      .select('id')
      .eq('campaign_id', req.params.id)
      .eq('status', 'pending');

    if (dispErr) throw new Error(dispErr.message);
    if (!dispatches || dispatches.length === 0) {
      return res.status(400).json({ error: 'Nenhum disparo pendente para misturar' });
    }

    // Gera mensagem única e delay individual para cada contato
    // Usa update (não upsert) para evitar tentativa de INSERT que viola NOT NULL em campaign_id
    for (const d of dispatches) {
      const { error: upErr } = await supabase
        .from('dispatches')
        .update({
          message_sent: spin(template.content),
          typing_delay: getTypingDelay(),
        })
        .eq('id', d.id);
      if (upErr) throw new Error(upErr.message);
    }

    console.log(`[shuffle] ${dispatches.length} mensagens geradas para campanha ${req.params.id}`);
    res.json({ ok: true, count: dispatches.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
