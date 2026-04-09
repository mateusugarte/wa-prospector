import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import ConnectModal from './ConnectModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_CFG = {
  disconnected: { label: 'Desconectado', color: 'var(--danger)',  dot: 'var(--danger)' },
  connecting:   { label: 'Conectando…',  color: 'var(--warning)', dot: 'var(--warning)', pulse: true },
  connected:    { label: 'Conectado',    color: 'var(--accent)',  dot: 'var(--accent)' },
};

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function IconWA() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}

export default function Settings() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [checking, setChecking] = useState(null);

  async function load() {
    const [{ data }, healthRes] = await Promise.all([
      supabase.from('wa_instances').select('id, name, instance_id, status, phone, connected_at').order('created_at', { ascending: false }),
      fetch(`${API_URL}/health/db`).then(r => r.json()).catch(() => null),
    ]);
    setInstances(data ?? []);
    setHealth(healthRes);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCheckStatus(instanceId) {
    setChecking(instanceId);
    try { await fetch(`${API_URL}/api/instances/${instanceId}/status`); await load(); }
    finally { setChecking(null); }
  }

  async function handleDisconnect(instanceId) {
    setDisconnecting(instanceId);
    try { await fetch(`${API_URL}/api/instances/${instanceId}/disconnect`, { method: 'POST' }); await load(); }
    finally { setDisconnecting(null); }
  }

  async function handleDelete(instanceId) {
    if (!confirm('Remover esta instância?')) return;
    setDeleting(instanceId);
    try { await fetch(`${API_URL}/api/instances/${instanceId}`, { method: 'DELETE' }); await load(); }
    finally { setDeleting(null); }
  }

  return (
    <div className="animate-fade-in" style={{ padding: 32, maxWidth: 720 }}>
      {showModal && (
        <ConnectModal onClose={() => setShowModal(false)} onConnected={() => { setShowModal(false); load(); }} />
      )}

      <div className="page-header" style={{ marginBottom: 28 }}>
        <h2 className="page-title">Configurações</h2>
      </div>

      {/* System status */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Status do sistema
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: health?.ok ? 'var(--accent)' : 'var(--danger)', display: 'inline-block' }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>
              Backend: <span style={{ color: health?.ok ? 'var(--accent)' : 'var(--danger)', fontWeight: 500 }}>{health?.ok ? 'Online' : 'Offline'}</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: health?.supabase === 'connected' ? 'var(--accent)' : 'var(--danger)', display: 'inline-block' }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>
              Supabase: <span style={{ color: health?.supabase === 'connected' ? 'var(--accent)' : 'var(--danger)', fontWeight: 500 }}>{health?.supabase === 'connected' ? 'Conectado' : health?.supabase ?? 'N/A'}</span>
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginLeft: 'auto' }}>{API_URL}</span>
        </div>
      </div>

      {/* WA instances */}
      <div className="card-lg" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--accent)' }}><IconWA /></span>
            <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>Instâncias WhatsApp</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <IconPlus /> Conectar número
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(2)].map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div className="shimmer" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="shimmer" style={{ height: 13, width: 140, marginBottom: 6 }} />
                  <div className="shimmer" style={{ height: 11, width: 100 }} />
                </div>
              </div>
            ))}
          </div>
        ) : instances.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 24px' }}>
            <div className="empty-icon"><IconWA /></div>
            <p style={{ color: 'var(--text-2)', fontWeight: 500 }}>Nenhum número conectado</p>
            <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>Clique em "Conectar número" para escanear o QR Code</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {instances.map((inst, idx) => {
              const s = STATUS_CFG[inst.status] ?? STATUS_CFG.disconnected;
              return (
                <div
                  key={inst.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 20px',
                    borderBottom: idx < instances.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'var(--accent-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent)', flexShrink: 0,
                  }}>
                    <IconWA />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>{inst.name}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 1 }}>
                      {inst.phone ?? inst.instance_id}
                      {inst.connected_at && ` · desde ${new Date(inst.connected_at).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>

                  {/* Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: s.dot, display: 'inline-block',
                      animation: s.pulse ? 'pulseSoft 1.5s ease-in-out infinite' : 'none',
                    }} />
                    <span style={{ fontSize: '0.8125rem', color: s.color, fontWeight: 500 }}>{s.label}</span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleCheckStatus(inst.instance_id)}
                      disabled={checking === inst.instance_id}
                      className="btn btn-secondary btn-sm"
                    >
                      {checking === inst.instance_id ? 'Verificando…' : 'Verificar'}
                    </button>
                    <button
                      onClick={() => handleDisconnect(inst.instance_id)}
                      disabled={disconnecting === inst.instance_id}
                      className="btn btn-sm"
                      style={{ background: 'transparent', color: 'var(--text-3)', border: '1px solid transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--warning)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'transparent'; }}
                    >
                      {disconnecting === inst.instance_id ? '…' : 'Desconectar'}
                    </button>
                    <button
                      onClick={() => handleDelete(inst.instance_id)}
                      disabled={deleting === inst.instance_id}
                      className="btn btn-sm"
                      style={{ background: 'transparent', color: 'var(--text-3)', border: '1px solid transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'transparent'; }}
                    >
                      {deleting === inst.instance_id ? '…' : 'Excluir'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
