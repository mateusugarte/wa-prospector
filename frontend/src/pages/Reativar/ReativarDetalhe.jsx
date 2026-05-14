import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

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
function IconPlay() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
}
function IconPause() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
}
function IconStop() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
}

function InfoCard({ label, value, color }) {
  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: '1.1rem', fontWeight: 700, color: color || 'var(--text)' }}>{value}</p>
    </div>
  );
}

export default function ReativarDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(null);
  const [acting, setActing] = useState(false);
  const socketRef = useRef(null);

  async function loadAll() {
    const res = await fetch(`${API_URL}/api/reactivation/${id}`);
    if (!res.ok) { navigate('/reativar'); return; }
    const data = await res.json();
    setCampaign(data);
    setDispatches(data.dispatches || []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [id]);

  // Socket.io — live updates somente quando running
  useEffect(() => {
    if (!campaign || campaign.status !== 'running') {
      setCountdown(null);
      return;
    }

    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('reactivation:dispatch:sent', (data) => {
      if (data.campaignId !== id) return;
      setDispatches(prev => prev.map(d =>
        d.id === data.dispatchId
          ? { ...d, status: 'sent', message_sent: data.message, sent_at: new Date().toISOString() }
          : d
      ));
    });

    socket.on('reactivation:dispatch:failed', (data) => {
      if (data.campaignId !== id) return;
      setDispatches(prev => prev.map(d =>
        d.id === data.dispatchId ? { ...d, status: 'failed', error: data.error } : d
      ));
    });

    socket.on('reactivation:countdown', (data) => {
      if (data.campaignId !== id) return;
      setCountdown(data);
    });

    socket.on('reactivation:completed', (data) => {
      if (data.campaignId !== id) return;
      setCountdown(null);
      loadAll();
    });

    socket.on('reactivation:paused', (data) => {
      if (data.campaignId !== id) return;
      setCountdown(null);
      loadAll();
    });

    socket.on('reactivation:stopped', (data) => {
      if (data.campaignId !== id) return;
      setCountdown(null);
      loadAll();
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [campaign?.status, id]);

  async function handleAction(type) {
    setActing(true);
    await fetch(`${API_URL}/api/reactivation/${id}/${type}`, { method: 'POST' });
    await loadAll();
    setActing(false);
  }

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="shimmer" style={{ height: 16, width: 100, marginBottom: 24 }} />
        <div className="shimmer" style={{ height: 32, width: 280, marginBottom: 8 }} />
        <div className="shimmer" style={{ height: 14, width: 200, marginBottom: 32 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="card shimmer" style={{ height: 70 }} />)}
        </div>
      </div>
    );
  }

  const pending   = dispatches.filter(d => d.status === 'pending').length;
  const sent      = dispatches.filter(d => d.status === 'sent').length;
  const failed    = dispatches.filter(d => d.status === 'failed').length;
  const progress  = dispatches.length > 0 ? Math.round(((sent + failed) / dispatches.length) * 100) : 0;
  const countdownPct = countdown?.total > 0 ? Math.round((countdown.remaining / countdown.total) * 100) : 0;
  const s = STATUS_CFG[campaign.status] ?? STATUS_CFG.draft;

  return (
    <div className="animate-fade-in" style={{ padding: 32, maxWidth: 1100 }}>

      {/* Back */}
      <button
        onClick={() => navigate('/reativar')}
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 20, paddingLeft: 6 }}
      >
        <IconArrowLeft /> Reativar Contatos
      </button>

      {/* Header */}
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
            Criado em {new Date(campaign.created_at).toLocaleDateString('pt-BR')} · Intervalo: {campaign.interval_min}–{campaign.interval_max} min
          </p>
        </div>

        {/* Botões de ação */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {(campaign.status === 'draft' || campaign.status === 'paused') && (
            <button className="btn btn-primary" onClick={() => handleAction('start')} disabled={acting}>
              <IconPlay /> {acting ? '...' : campaign.status === 'paused' ? 'Retomar' : 'Iniciar'}
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

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <InfoCard label="Total" value={dispatches.length} />
        <InfoCard label="Enviados" value={sent} color="var(--accent)" />
        <InfoCard label="Falhas" value={failed} color={failed > 0 ? 'var(--danger)' : undefined} />
        <InfoCard label="Pendentes" value={pending} color={pending > 0 ? 'var(--warning)' : undefined} />
      </div>

      {/* Progresso + countdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {dispatches.length > 0 && (
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
                {sent} enviados · {failed} falhas · {pending} pendentes
              </p>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)' }}>{progress}%</p>
            </div>
            <div className="progress-bar" style={{ height: 5 }}>
              <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
            </div>
          </div>
        )}

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
      </div>

      {/* Tabela de dispatches */}
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
                <th>Mensagem enviada</th>
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
                    <td style={{ maxWidth: 320 }}>
                      {d.message_sent
                        ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>
                            {d.message_sent.slice(0, 90)}{d.message_sent.length > 90 ? '…' : ''}
                          </span>
                        : <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontStyle: 'italic' }}>
                            {d.status === 'pending' ? 'Preparada' : 'Não gerada'}
                          </span>
                      }
                      {d.error && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 2 }}>
                          {d.error.slice(0, 80)}
                        </div>
                      )}
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
                      {d.sent_at
                        ? new Date(d.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
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
