import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import StatCard from './StatCard';

function IconSend() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
}
function IconX() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
}
function IconClock() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function IconZap() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
}

const STATUS_LABELS = {
  draft:     { label: 'Rascunho',  color: 'var(--text-3)' },
  running:   { label: 'Rodando',   color: 'var(--accent)' },
  paused:    { label: 'Pausada',   color: 'var(--warning)' },
  completed: { label: 'Concluída', color: 'var(--info)' },
  cancelled: { label: 'Encerrada', color: 'var(--danger)' },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ campaigns: 0, sent: 0, failed: 0, pending: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ count: campaigns }, { data: dispatches }, { data: camps }] = await Promise.all([
        supabase.from('campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('dispatches').select('status'),
        supabase.from('campaigns').select('id,name,status,sent_count,total_leads').order('created_at', { ascending: false }).limit(5),
      ]);
      const sent    = dispatches?.filter(d => d.status === 'sent').length    ?? 0;
      const failed  = dispatches?.filter(d => d.status === 'failed').length  ?? 0;
      const pending = dispatches?.filter(d => d.status === 'pending').length ?? 0;
      setStats({ campaigns: campaigns ?? 0, sent, failed, pending });
      setRecent(camps ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card" style={{ height: 90 }}>
              <div className="shimmer" style={{ height: 12, width: '40%', margin: '20px 22px 8px' }} />
              <div className="shimmer" style={{ height: 28, width: '60%', margin: '0 22px' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const successRate = stats.sent + stats.failed > 0
    ? Math.round((stats.sent / (stats.sent + stats.failed)) * 100)
    : 0;

  return (
    <div className="animate-fade-in" style={{ padding: 32 }}>
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard
          label="Campanhas"
          value={stats.campaigns}
          icon={<IconZap />}
        />
        <StatCard
          label="Enviados"
          value={stats.sent}
          color="var(--accent)"
          icon={<IconSend />}
          sub={`${successRate}% taxa de sucesso`}
        />
        <StatCard
          label="Falhas"
          value={stats.failed}
          color="var(--danger)"
          icon={<IconX />}
        />
        <StatCard
          label="Pendentes"
          value={stats.pending}
          color="var(--warning)"
          icon={<IconClock />}
        />
      </div>

      {/* Recent campaigns */}
      <div className="card-lg" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>Campanhas recentes</p>
          <button
            onClick={() => navigate('/campaigns')}
            style={{ fontSize: '0.8rem', color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            Ver todas →
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <IconZap />
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>Nenhuma campanha ainda</p>
            <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>Crie sua primeira campanha para começar</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Progresso</th>
                <th style={{ textAlign: 'right' }}>Enviados</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(c => {
                const s = STATUS_LABELS[c.status] ?? STATUS_LABELS.draft;
                const pct = c.total_leads > 0 ? Math.round((c.sent_count / c.total_leads) * 100) : 0;
                return (
                  <tr
                    key={c.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/campaigns/${c.id}`)}
                  >
                    <td style={{ color: 'var(--text)', fontWeight: 500 }}>{c.name}</td>
                    <td>
                      <span style={{ color: s.color, fontSize: '0.8125rem', fontWeight: 500 }}>{s.label}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <div className="progress-bar" style={{ width: 80 }}>
                          <div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text)', fontWeight: 500 }}>
                      {c.sent_count ?? 0} / {c.total_leads ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
