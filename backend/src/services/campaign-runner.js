const { supabase } = require('../lib/supabase');
const uazapi = require('./uazapi');
const { spin } = require('./spinner');
const { getRandomDelay, formatDelay, getTypingDelay, sleep } = require('./scheduler');

// Mapa de campanhas ativas: campaignId -> { paused, stopped }
const activeRunners = new Map();

/**
 * Inicia a execução de uma campanha em background.
 */
async function startCampaign(campaignId, io) {
  if (activeRunners.has(campaignId)) {
    const runner = activeRunners.get(campaignId);
    if (runner.paused) {
      runner.paused = false;
      await supabase.from('campaigns').update({ status: 'running' }).eq('id', campaignId);
      io?.emit('campaign:resumed', { campaignId });
      console.log(`[campaign] ${campaignId} retomada`);
    }
    return;
  }

  const runner = { paused: false, stopped: false };
  activeRunners.set(campaignId, runner);

  _execute(campaignId, runner, io).catch(err => {
    console.error(`[campaign] erro fatal em ${campaignId}:`, err.message);
  }).finally(() => {
    activeRunners.delete(campaignId);
  });
}

async function pauseCampaign(campaignId, io) {
  const runner = activeRunners.get(campaignId);
  if (!runner) return;
  runner.paused = true;
  await supabase.from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
  io?.emit('campaign:paused', { campaignId });
  console.log(`[campaign] ${campaignId} pausada`);
}

async function stopCampaign(campaignId, io) {
  const runner = activeRunners.get(campaignId);
  if (runner) {
    runner.paused = false;
    runner.stopped = true;
  }
  await supabase.from('campaigns').update({ status: 'cancelled' }).eq('id', campaignId);
  // Cancela dispatches pendentes
  await supabase.from('dispatches')
    .update({ status: 'cancelled' })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');
  io?.emit('campaign:stopped', { campaignId });
  console.log(`[campaign] ${campaignId} encerrada`);
}

function isRunning(campaignId) {
  return activeRunners.has(campaignId);
}

// ── Execução interna ──────────────────────────────────────────────────────────

async function _execute(campaignId, runner, io) {
  // Busca dados da campanha
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select('id, instance_id, interval_min, interval_max, template_id')
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) throw new Error('Campanha não encontrada');

  const { data: template, error: tplErr } = await supabase
    .from('templates')
    .select('content')
    .eq('id', campaign.template_id)
    .single();

  if (tplErr || !template) throw new Error('Template não encontrado na campanha');

  await supabase.from('campaigns').update({ status: 'running' }).eq('id', campaignId);
  io?.emit('campaign:started', { campaignId });
  console.log(`[campaign] iniciada: ${campaignId}`);

  while (!runner.stopped) {
    // Aguarda se pausada
    while (runner.paused && !runner.stopped) {
      await sleep(500);
    }
    if (runner.stopped) break;

    // Próximo dispatch pendente
    const { data: dispatches } = await supabase
      .from('dispatches')
      .select('id, phone, message_sent, typing_delay')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('created_at')
      .limit(1);

    if (!dispatches || dispatches.length === 0) {
      await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaignId);
      io?.emit('campaign:completed', { campaignId });
      console.log(`[campaign] concluída: ${campaignId}`);
      break;
    }

    const dispatch = dispatches[0];
    // Usa mensagem pré-gerada pelo shuffle, ou gera agora
    const message = dispatch.message_sent || spin(template.content);
    // Usa delay pré-definido pelo shuffle, ou gera agora
    const typingDelay = dispatch.typing_delay ?? getTypingDelay();

    // Envia mensagem
    try {
      await uazapi.sendTextByToken(campaign.instance_id, dispatch.phone, message, typingDelay);
      await supabase.from('dispatches').update({
        status: 'sent',
        message_sent: message,
        sent_at: new Date().toISOString(),
      }).eq('id', dispatch.id);
      await supabase.rpc('increment_campaign_sent', { p_campaign_id: campaignId });
      // Incrementa sent_count do contato se existir no banco
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, sent_count')
        .eq('phone', dispatch.phone)
        .maybeSingle();
      if (contact) {
        await supabase
          .from('contacts')
          .update({ sent_count: contact.sent_count + 1, last_sent_at: new Date().toISOString() })
          .eq('id', contact.id);
      }
      io?.emit('dispatch:sent', { campaignId, dispatchId: dispatch.id, phone: dispatch.phone, message });
      console.log(`[campaign] ✓ enviado para ${dispatch.phone} (delay: ${typingDelay}ms)`);
    } catch (err) {
      await supabase.from('dispatches').update({
        status: 'failed',
        error: err.message,
      }).eq('id', dispatch.id);
      await supabase.rpc('increment_campaign_failed', { p_campaign_id: campaignId });
      io?.emit('dispatch:failed', { campaignId, dispatchId: dispatch.id, phone: dispatch.phone, error: err.message });
      console.log(`[campaign] ✗ falha para ${dispatch.phone}: ${err.message}`);
    }

    if (runner.stopped) break;

    // Delay aleatório entre envios — emite countdown a cada segundo
    const delay = getRandomDelay(campaign.interval_min, campaign.interval_max);
    const totalSecs = Math.round(delay / 1000);
    console.log(`[campaign] aguardando ${formatDelay(delay)}...`);

    for (let i = 0; i < totalSecs && !runner.stopped; i++) {
      // Pausa durante countdown
      while (runner.paused && !runner.stopped) {
        io?.emit('campaign:countdown', { campaignId, remaining: 0, total: totalSecs, paused: true });
        await sleep(500);
      }
      if (runner.stopped) break;
      const remaining = totalSecs - i;
      io?.emit('campaign:countdown', { campaignId, remaining, total: totalSecs, paused: false });
      await sleep(1000);
    }
    // Zera countdown antes do próximo envio
    io?.emit('campaign:countdown', { campaignId, remaining: 0, total: totalSecs, paused: false });
  }
}

/**
 * Ao iniciar o servidor: campanhas "running" viram "paused"
 * pois os runners em memória foram perdidos no restart.
 */
async function resetStaleRunners() {
  await supabase
    .from('campaigns')
    .update({ status: 'paused' })
    .eq('status', 'running');
}

module.exports = { startCampaign, pauseCampaign, stopCampaign, isRunning, resetStaleRunners };
