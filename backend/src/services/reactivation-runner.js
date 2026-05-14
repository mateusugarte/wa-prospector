const { supabase } = require('../lib/supabase');
const uazapi = require('./uazapi');
const { getRandomDelay, formatDelay, getReactivationTypingDelay, sleep } = require('./scheduler');

// Mapa separado dos runners de campanha normal
// key: reactivationCampaignId → { paused, stopped }
const activeReactivationRunners = new Map();

/**
 * Inicia (ou retoma) uma campanha de reativação em background.
 */
async function startReactivation(campaignId, io) {
  if (activeReactivationRunners.has(campaignId)) {
    const runner = activeReactivationRunners.get(campaignId);
    if (runner.paused) {
      runner.paused = false;
      await supabase.from('reactivation_campaigns').update({ status: 'running' }).eq('id', campaignId);
      io?.emit('reactivation:resumed', { campaignId });
      console.log(`[reactivation] ${campaignId} retomada`);
    }
    return;
  }

  const runner = { paused: false, stopped: false };
  activeReactivationRunners.set(campaignId, runner);

  _executeReactivation(campaignId, runner, io).catch(err => {
    console.error(`[reactivation] erro fatal em ${campaignId}:`, err.message);
  }).finally(() => {
    activeReactivationRunners.delete(campaignId);
  });
}

async function pauseReactivation(campaignId, io) {
  const runner = activeReactivationRunners.get(campaignId);
  if (!runner) return;
  runner.paused = true;
  await supabase.from('reactivation_campaigns').update({ status: 'paused' }).eq('id', campaignId);
  io?.emit('reactivation:paused', { campaignId });
  console.log(`[reactivation] ${campaignId} pausada`);
}

async function stopReactivation(campaignId, io) {
  const runner = activeReactivationRunners.get(campaignId);
  if (runner) {
    runner.paused = false;
    runner.stopped = true;
  }
  await supabase.from('reactivation_campaigns').update({ status: 'cancelled' }).eq('id', campaignId);
  await supabase.from('reactivation_dispatches')
    .update({ status: 'cancelled' })
    .eq('reactivation_campaign_id', campaignId)
    .eq('status', 'pending');
  io?.emit('reactivation:stopped', { campaignId });
  console.log(`[reactivation] ${campaignId} encerrada`);
}

// ── Execução interna ──────────────────────────────────────────────────────────

async function _executeReactivation(campaignId, runner, io) {
  // Busca dados da campanha
  const { data: campaign, error: campErr } = await supabase
    .from('reactivation_campaigns')
    .select('id, instance_id, interval_min, interval_max')
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) throw new Error('Campanha de reativação não encontrada');

  // Valida que todos os dispatches pendentes têm message_sent e typing_delay preenchidos
  const { data: unprepared } = await supabase
    .from('reactivation_dispatches')
    .select('id')
    .eq('reactivation_campaign_id', campaignId)
    .eq('status', 'pending')
    .or('message_sent.is.null,typing_delay.is.null')
    .limit(1);

  if (unprepared && unprepared.length > 0) {
    throw new Error('Execute "Preparar" antes de iniciar — há dispatches sem mensagem ou delay');
  }

  await supabase.from('reactivation_campaigns').update({ status: 'running' }).eq('id', campaignId);
  io?.emit('reactivation:started', { campaignId });
  console.log(`[reactivation] iniciada: ${campaignId}`);

  while (!runner.stopped) {
    // Aguarda se pausada
    while (runner.paused && !runner.stopped) {
      await sleep(500);
    }
    if (runner.stopped) break;

    // Próximo dispatch pendente
    const { data: dispatches } = await supabase
      .from('reactivation_dispatches')
      .select('id, lead_id, phone, message_sent, typing_delay, interval_delay_ms')
      .eq('reactivation_campaign_id', campaignId)
      .eq('status', 'pending')
      .order('created_at')
      .limit(1);

    if (!dispatches || dispatches.length === 0) {
      await supabase.from('reactivation_campaigns').update({ status: 'completed' }).eq('id', campaignId);
      io?.emit('reactivation:completed', { campaignId });
      console.log(`[reactivation] concluída: ${campaignId}`);
      break;
    }

    const dispatch = dispatches[0];
    const message = dispatch.message_sent;
    const typingDelay = dispatch.typing_delay;

    // Envia mensagem
    try {
      await uazapi.sendTextByToken(campaign.instance_id, dispatch.phone, message, typingDelay);

      await supabase.from('reactivation_dispatches').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      }).eq('id', dispatch.id);

      await supabase.rpc('increment_reactivation_sent', { p_campaign_id: campaignId });

      // Incrementa reactivation_count e last_reactivated_at no lead
      if (dispatch.lead_id) {
        const { data: lead } = await supabase
          .from('leads')
          .select('id, reactivation_count')
          .eq('id', dispatch.lead_id)
          .maybeSingle();
        if (lead) {
          await supabase.from('leads').update({
            reactivation_count: (lead.reactivation_count || 0) + 1,
            last_reactivated_at: new Date().toISOString(),
          }).eq('id', lead.id);
        }
      }

      io?.emit('reactivation:dispatch:sent', {
        campaignId,
        dispatchId: dispatch.id,
        phone: dispatch.phone,
        message,
      });
      console.log(`[reactivation] ✓ enviado para ${dispatch.phone} (typing: ${typingDelay}ms)`);
    } catch (err) {
      await supabase.from('reactivation_dispatches').update({
        status: 'failed',
        error: err.message,
      }).eq('id', dispatch.id);
      await supabase.rpc('increment_reactivation_failed', { p_campaign_id: campaignId });
      io?.emit('reactivation:dispatch:failed', {
        campaignId,
        dispatchId: dispatch.id,
        phone: dispatch.phone,
        error: err.message,
      });
      console.log(`[reactivation] ✗ falha para ${dispatch.phone}: ${err.message}`);
    }

    if (runner.stopped) break;

    // Usa o interval_delay_ms já preparado para este dispatch
    const delay = dispatch.interval_delay_ms;
    if (!delay) break; // último dispatch, sem countdown

    const totalSecs = Math.round(delay / 1000);
    console.log(`[reactivation] aguardando ${formatDelay(delay)}...`);

    for (let i = 0; i < totalSecs && !runner.stopped; i++) {
      while (runner.paused && !runner.stopped) {
        io?.emit('reactivation:countdown', { campaignId, remaining: 0, total: totalSecs, paused: true });
        await sleep(500);
      }
      if (runner.stopped) break;
      const remaining = totalSecs - i;
      io?.emit('reactivation:countdown', { campaignId, remaining, total: totalSecs, paused: false });
      await sleep(1000);
    }
    io?.emit('reactivation:countdown', { campaignId, remaining: 0, total: totalSecs, paused: false });
  }
}

/**
 * Na inicialização do servidor: campanhas "running" viram "paused"
 * pois os runners em memória foram perdidos no restart.
 */
async function resetStaleReactivationRunners() {
  await supabase
    .from('reactivation_campaigns')
    .update({ status: 'paused' })
    .eq('status', 'running');
}

module.exports = {
  startReactivation,
  pauseReactivation,
  stopReactivation,
  resetStaleReactivationRunners,
};
