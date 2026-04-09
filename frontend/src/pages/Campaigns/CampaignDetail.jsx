import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { supabase } from '../../lib/supabase';
import AddContactsModal from './AddContactsModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_CFG = {
  draft:     { label: 'Rascunho',  bg: 'var(--surface-3)',     color: 'var(--text-3)' },
  running:   { label: 'Rodando',   bg: 'var(--accent-dim)',     color: 'var(--accent)' },
  paused:    { label: 'Pausada',   bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)' },
  completed: { label: 'Concluída', bg: 'rgba(59,130,246,0.12)', color: 'var(--info)' },
  cancelled: { label: 'Encerrada', bg: 'rgba(239,68,68,0.12)',  color: 'var(--danger)' },
};

const DISPATCH_CFG = {
  pending:   { label: 'Pendente',  color: 'var(--text-3)' },
  sent:      { label: 'Enviado',   color: 'var(--accent)' },
  failed:    { label: 'Falhou',    color: 'var(--danger)' },
  cancelled: { label: 'Cancelado', color: 'var(--text-3)' },
};

function IconArrowLeft() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
}
function IconShuffle() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>;
}
function IconPlay() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
}
function IconPause() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
}
function IconStop() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
}
function IconPlus() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function IconPhone() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 6.16 6.16l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
}
function IconClock() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}

function InfoCard({ label, value, icon, color }) {
  return (
    <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 8,
        background: color ? `${color}18` : 'var(--surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color || 'var(--text-2)', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>{value}</p>
      </div>
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [instance, setInstance] = useState(null);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(null);
  const [shuffling, setShuffling] = useState(false);
  const [shuffleMsg, setShuffleMsg] = useState(null);
  const [acting, setActing] = useState(false);
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [addMsg, setAddMsg] = useState(null);
  const socketRef = useRef(null);

  async function loadAll() {
    const { data: camp } = await supabase
      .from('campaigns')
      .select('id, name, status, total_leads, sent_count, failed_count, interval_min, interval_max, template_id, template_ids, instance_id, created_at')
      .eq('id', id)
      .single();
    if (!camp) { navigate('/campaigns'); return; }
    setCampaign(camp);

    // Resolve IDs de templates (suporte a múltiplos e campo legado)
    const allTemplateIds = (camp.template_ids?.length ? camp.template_ids : null)
      ?? (camp.template_id ? [camp.template_id] : []);

    const [tplResult, { data: inst }, dispRes] = await Promise.all([
      allTemplateIds.length
        ? supabase.from('templates').select('id, name, content').in('id', allTemplateIds)
        : Promise.resolve({ data: [] }),
      supabase.from('wa_instances').select('id, name, phone, status').eq('instance_id', camp.instance_id).single(),
      fetch(`${API_URL}/api/campaigns/${id}/dispatches`).then(r => r.json()),
    ]);

    setTemplates(tplResult.data ?? []);
    setInstance(inst);
    setDispatches(Array.isArray(dispRes) ? dispRes : []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [id]);

  // Socket.io — live updates when running
  useEffect(() => {
    if (!campaign || campaign.status !== 'running') {
      setCountdown(null);
      return;
    }
    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('dispatch:sent', (data) => {
      if (data.campaignId !== id) return;
      setDispatches(prev => prev.map(d =>
        d.id === data.dispatchId
          ? { ...d, status: 'sent', message_sent: data.message, sent_at: new Date().toISOString() }
          : d
      ));
    });
    socket.on('dispatch:failed', (data) => {
      if (data.campaignId !== id) return;
      setDispatches(prev => prev.map(d =>
        d.id === data.dispatchId ? { ...d, status: 'failed', error: data.error } : d
      ));
    });
    socket.on('campaign:countdown', (data) => {
      if (data.campaignId !== id) return;
      setCountdown(data);
    });
    socket.on('campaign:completed', (data) => {
      if (data.campaignId !== id) return;
      setCountdown(null);
      loadAll();
    });
    socket.on('campaign:paused', (data) => {
      if (data.campaignId !== id) return;
      setCountdown(null);
      loadAll();
    });
    socket.on('campaign:stopped', (data) => {
      if (data.campaignId !== id) return;
      setCountdown(null);
      loadAll();
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [campaign?.status, id]);

  async function handleShuffle() {
    setShuffling(true);
    setShuffleMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/campaigns/${id}/shuffle`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShuffleMsg({ ok: true, text: `${data.count} mensagens únicas geradas` });
      await loadAll();
    } catch (err) {
      setShuffleMsg({ ok: false, text: err.message });
    } finally {
      setShuffling(false);
      setTimeout(() => setShuffleMsg(null), 4000);
    }
  }

  async function handleAction(type) {
    setActing(true);
    await fetch(`${API_URL}/api/campaigns/${id}/${type}`, { method: 'POST' });
    await loadAll();
    setActing(false);
  }

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="shimmer" style={{ height: 16, width: 120, marginBottom: 24 }} />
        <div className="shimmer" style={{ height: 32, width: 260, marginBottom: 8 }} />
        <div className="shimmer" style={{ height: 14, width: 180, marginBottom: 32 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="card shimmer" style={{ height: 70 }} />)}
        </div>
      </div>
    );
  }

  const pending  = dispatches.filter(d => d.status === 'pending').length;
  const sent     = dispatches.filter(d => d.status === 'sent').length;
  const failed   = dispatches.filter(d => d.status === 'failed').length;
  const hasTemplates = templates.length > 0;
  const isShuffled = dispatches.some(d => d.message_sent && d.status === 'pending');
  const canEdit  = campaign.status === 'draft' || campaign.status === 'paused';
  const canAddContacts = campaign.status !== 'cancelled' && campaign.status !== 'completed';
  const s = STATUS_CFG[campaign.status] ?? STATUS_CFG.draft;
  const progress = dispatches.length > 0 ? Math.round(((sent + failed) / dispatches.length) * 100) : 0;
  const countdownPct = countdown?.total > 0 ? Math.round((countdown.remaining / countdown.total) * 100) : 0;

  // Estimated completion
  const avgInterval = (campaign.interval_min + campaign.interval_max) / 2;
  const remainingMins = pending * avgInterval;
  const estFinish = remainingMins > 0
    ? remainingMins < 60
      ? `~${Math.round(remainingMins)} min`
      : `~${Math.round(remainingMins / 60)}h ${Math.round(remainingMins % 60)}min`
    : '—';

  return (
    <div className="animate-fade-in" style={{ padding: 32, maxWidth: 1100 }}>
      {showAddContacts && (
        <AddContactsModal
          campaignId={id}
          onClose={() => setShowAddContacts(false)}
          onAdded={(count) => {
            setShowAddContacts(false);
            setAddMsg(`+${count} contato${count !== 1 ? 's' : ''} adicionado${count !== 1 ? 's' : ''}!`);
            setTimeout(() => setAddMsg(null), 3000);
            loadAll();
          }}
        />
      )}

      {/* Back + header */}
      <button
        onClick={() => navigate('/campaigns')}
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 20, paddingLeft: 6 }}
      >
        <IconArrowLeft /> Campanhas
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', margin: 0 }}>
              {campaign.name}
            </h1>
            <span style={{
              padding: '3px 10px', borderRadius: 99, fontSize: '0.8rem', fontWeight: 500,
              background: s.bg, color: s.color,
            }}>
              {s.label}
            </span>
          </div>
          <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
            Criada em {new Date(campaign.created_at).toLocaleDateString('pt-BR')} · Intervalo: {campaign.interval_min}–{campaign.interval_max} min
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {canAddContacts && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddContacts(true)}>
              <IconPlus /> Adicionar contatos
            </button>
          )}
          {addMsg && <span style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>{addMsg}</span>}
          {(campaign.status === 'draft' || campaign.status === 'paused') && (
            <button className="btn btn-primary" onClick={() => handleAction('start')} disabled={acting}>
              <IconPlay /> {acting ? '...' : 'Iniciar'}
            </button>
          )}
          {campaign.status === 'running' && (
            <button
              className="btn"
              onClick={() => handleAction('pause')}
              disabled={acting}
              style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              <IconPause /> {acting ? '...' : 'Pausar'}
            </button>
          )}
          {(campaign.status === 'running' || campaign.status === 'paused') && (
            <button className="btn btn-danger" onClick={() => handleAction('stop')} disabled={acting}>
              <IconStop /> Encerrar
            </button>
          )}
        </div>
      </div>

      {/* Info cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <InfoCard label="Total de contatos" value={dispatches.length} icon={<IconPhone />} />
        <InfoCard label="Enviados" value={sent} icon={
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        } color="var(--accent)" />
        <InfoCard label="Falhas" value={failed} icon={
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        } color={failed > 0 ? 'var(--danger)' : null} />
        <InfoCard label="Pendentes" value={pending} icon={<IconClock />} color={pending > 0 ? 'var(--warning)' : null} />
        <InfoCard label="Conclusão estimada" value={estFinish} icon={<IconClock />} />
        <InfoCard
          label="Instância WA"
          value={instance?.name ?? campaign.instance_id.slice(0, 12) + '…'}
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          }
          color="var(--accent)"
        />
      </div>

      {/* Two-column: template preview + progress/countdown */}
      <div style={{ display: 'grid', gridTemplateColumns: hasTemplates ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 20 }}>
        {hasTemplates && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {templates.map((tpl, idx) => (
              <div key={tpl.id} className="card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
                    Template {templates.length > 1 ? `${idx + 1}` : ''} · {tpl.name}
                  </p>
                  {templates.length > 1 && (
                    <span style={{
                      fontSize: '0.7rem', padding: '1px 6px', borderRadius: 99,
                      background: 'rgba(168,85,247,0.12)', color: '#a855f7',
                      fontWeight: 500,
                    }}>
                      aleatório
                    </span>
                  )}
                </div>
                <pre style={{
                  fontFamily: 'inherit', fontSize: '0.8125rem', color: 'var(--text-2)',
                  whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0,
                  maxHeight: 80, overflow: 'auto',
                }}>
                  {tpl.content}
                </pre>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Progress */}
          {dispatches.length > 0 && (
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{sent} enviados · {failed} falhas · {pending} pendentes</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 600 }}>{progress}%</p>
              </div>
              <div className="progress-bar" style={{ height: 5 }}>
                <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
              </div>
            </div>
          )}

          {/* Countdown */}
          {campaign.status === 'running' && countdown !== null && (
            <div className="card" style={{ padding: '16px 20px' }}>
              {countdown.paused ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--warning)', display: 'inline-block' }} className="animate-pulse-soft" />
                  <span style={{ fontSize: '0.875rem', color: 'var(--warning)' }}>Campanha pausada — aguardando retomada</span>
                </div>
              ) : countdown.remaining === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} className="animate-pulse-soft" />
                  <span style={{ fontSize: '0.875rem', color: 'var(--accent)' }}>Enviando mensagem...</span>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--info)', display: 'inline-block' }} className="animate-pulse-soft" />
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>Próximo envio em</span>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                        {countdown.remaining}s
                      </span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{countdown.total}s de espera</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${countdownPct}%`, background: 'var(--info)', transition: 'width 1s linear' }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Shuffle */}
          {canEdit && (
            <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Misturar mensagens</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
                  {isShuffled ? 'Mensagens únicas já geradas — pode misturar novamente' : 'Gera variação única e delay para cada contato'}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <button
                  onClick={handleShuffle}
                  disabled={shuffling || !hasTemplates}
                  className="btn btn-sm"
                  style={{
                    background: isShuffled ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.12)',
                    color: '#a855f7',
                    border: '1px solid rgba(168,85,247,0.25)',
                  }}
                >
                  <IconShuffle /> {shuffling ? 'Gerando...' : isShuffled ? 'Misturar novamente' : 'Misturar'}
                </button>
                {!hasTemplates && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>Sem template</p>
                )}
                {hasTemplates && templates.length > 1 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{templates.length} templates · escolha aleatória</p>
                )}
                {shuffleMsg && (
                  <p style={{ fontSize: '0.75rem', color: shuffleMsg.ok ? 'var(--accent)' : 'var(--danger)' }}>{shuffleMsg.text}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dispatch table */}
      <div className="card-lg" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
            Contatos ({dispatches.length})
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Telefone</th>
                <th>Mensagem</th>
                <th style={{ textAlign: 'center' }}>Delay</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Enviado em</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.map(d => {
                const ds = DISPATCH_CFG[d.status] ?? DISPATCH_CFG.pending;
                const isLive = campaign.status === 'running' && d.status === 'pending';
                return (
                  <tr
                    key={d.id}
                    style={{
                      background: d.status === 'sent' ? 'rgba(34,197,94,0.04)' :
                                  d.status === 'failed' ? 'rgba(239,68,68,0.04)' : undefined,
                    }}
                  >
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text)' }}>
                        {d.phone}
                      </span>
                      {isLive && (
                        <span style={{
                          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                          background: 'var(--info)', marginLeft: 8, verticalAlign: 'middle',
                          animation: 'pulseSoft 1.5s ease-in-out infinite',
                        }} />
                      )}
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      {d.message_sent
                        ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>
                            {d.message_sent.slice(0, 80)}{d.message_sent.length > 80 ? '…' : ''}
                          </span>
                        : <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontStyle: 'italic' }}>Não gerada</span>
                      }
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                      {d.typing_delay ? `${d.typing_delay}ms` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ color: ds.color, fontWeight: 500, fontSize: '0.8125rem' }}>
                        {ds.label}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                      {d.sent_at ? new Date(d.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
