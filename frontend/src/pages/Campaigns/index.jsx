import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import CampaignModal from './CampaignModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_CFG = {
  draft:     { label: 'Rascunho',  bg: 'var(--surface-3)',     color: 'var(--text-3)' },
  running:   { label: 'Rodando',   bg: 'var(--accent-dim)',     color: 'var(--accent)' },
  paused:    { label: 'Pausada',   bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)' },
  completed: { label: 'Concluída', bg: 'rgba(59,130,246,0.12)', color: 'var(--info)' },
  cancelled: { label: 'Encerrada', bg: 'rgba(239,68,68,0.12)',  color: 'var(--danger)' },
};

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d2="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
}
function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconChevronRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
function IconEmpty() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>;
}

export default function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCampaign, setEditCampaign] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    const { data } = await supabase
      .from('campaigns')
      .select('id, name, status, total_leads, sent_count, failed_count, interval_min, interval_max, template_id, instance_id, created_at')
      .order('created_at', { ascending: false });
    setCampaigns(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  async function handleDelete(e, campaign) {
    e.stopPropagation();
    if (!confirm(`Excluir "${campaign.name}"? Todos os disparos serão removidos.`)) return;
    setDeleting(campaign.id);
    try {
      const res = await fetch(`${API_URL}/api/campaigns/${campaign.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="animate-fade-in" style={{ padding: 32 }}>
      {(showModal || editCampaign) && (
        <CampaignModal
          existing={editCampaign}
          onClose={() => { setShowModal(false); setEditCampaign(null); }}
          onSaved={() => { setShowModal(false); setEditCampaign(null); load(); }}
        />
      )}

      <div className="page-header">
        <div>
          <h2 className="page-title">Campanhas</h2>
          {!loading && campaigns.length > 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 4 }}>
              {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''} ·{' '}
              {campaigns.filter(c => c.status === 'running').length} rodando
            </p>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <IconPlus /> Nova campanha
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card" style={{ height: 72 }}>
              <div style={{ padding: '18px 20px', display: 'flex', gap: 16, alignItems: 'center' }}>
                <div className="shimmer" style={{ height: 12, width: 180 }} />
                <div className="shimmer" style={{ height: 20, width: 72, borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card-lg">
          <div className="empty-state">
            <div className="empty-icon"><IconEmpty /></div>
            <p style={{ color: 'var(--text-2)', fontWeight: 500 }}>Nenhuma campanha criada</p>
            <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>Clique em "Nova campanha" para começar</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {campaigns.map(c => {
            const s = STATUS_CFG[c.status] ?? STATUS_CFG.draft;
            const progress = c.total_leads > 0
              ? Math.round(((c.sent_count + c.failed_count) / c.total_leads) * 100)
              : 0;
            const isRunning = c.status === 'running';
            const canEdit = c.status === 'draft' || c.status === 'paused';

            return (
              <div
                key={c.id}
                className="card card-hover"
                onClick={() => navigate(`/campaigns/${c.id}`)}
                style={{ cursor: 'pointer', padding: '16px 20px', transition: 'all 0.2s ease' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Status dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: s.color, flexShrink: 0,
                    boxShadow: isRunning ? `0 0 8px ${s.color}` : 'none',
                    animation: isRunning ? 'pulseSoft 2s ease-in-out infinite' : 'none',
                  }} />

                  {/* Name + progress */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isRunning ? 6 : 0 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.name}
                      </span>
                      <span style={{
                        padding: '1px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 500,
                        background: s.bg, color: s.color, flexShrink: 0,
                      }}>
                        {s.label}
                      </span>
                    </div>
                    {isRunning && (
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 2 }}>Contatos</p>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{c.total_leads ?? 0}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 2 }}>Enviados</p>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent)' }}>{c.sent_count ?? 0}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 2 }}>Falhas</p>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: c.failed_count > 0 ? 'var(--danger)' : 'var(--text-3)' }}>{c.failed_count ?? 0}</p>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                      {canEdit && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={e => { e.stopPropagation(); setEditCampaign(c); }}
                          title="Editar"
                        >
                          <IconEdit />
                        </button>
                      )}
                      {c.status !== 'running' && (
                        <button
                          className="btn btn-sm"
                          onClick={e => handleDelete(e, c)}
                          disabled={deleting === c.id}
                          style={{ background: 'transparent', color: 'var(--text-3)', border: '1px solid transparent' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'transparent'; }}
                          title="Excluir"
                        >
                          {deleting === c.id ? '...' : <IconTrash />}
                        </button>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-3)', marginLeft: 4 }}>
                      <IconChevronRight />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
