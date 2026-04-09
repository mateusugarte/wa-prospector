import React, { useEffect, useState } from 'react';
import ImportModal from './ImportModal';
import ContactListModal from './ContactListModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function IconEmpty() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

export default function Contacts() {
  const [niches, setNiches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [viewNiche, setViewNiche] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/contacts/niches`);
    const data = await res.json();
    setNiches(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDeleteNiche(niche) {
    if (!window.confirm(`Deletar todos os contatos do nicho "${niche}"?`)) return;
    setDeleting(niche);
    await fetch(`${API_URL}/api/contacts/niche/${encodeURIComponent(niche)}`, { method: 'DELETE' });
    setDeleting(null);
    load();
  }

  const totalContacts = niches.reduce((acc, n) => acc + n.total, 0);
  const totalAvailable = niches.reduce((acc, n) => acc + n.available, 0);

  return (
    <div className="animate-fade-in" style={{ padding: 32 }}>
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load(); }} />
      )}
      {viewNiche && (
        <ContactListModal niche={viewNiche} onClose={() => setViewNiche(null)} />
      )}

      <div className="page-header">
        <div>
          <h2 className="page-title">Contatos</h2>
          {!loading && niches.length > 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 4 }}>
              {totalContacts.toLocaleString('pt-BR')} total · {totalAvailable.toLocaleString('pt-BR')} disponíveis
            </p>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setShowImport(true)}>
          <IconPlus /> Importar via Apify
        </button>
      </div>

      {loading ? (
        <div className="card-lg" style={{ overflow: 'hidden' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}>
              <div className="shimmer" style={{ height: 13, width: 120 }} />
              <div className="shimmer" style={{ height: 5, width: 100, borderRadius: 99 }} />
            </div>
          ))}
        </div>
      ) : niches.length === 0 ? (
        <div className="card-lg">
          <div className="empty-state">
            <div className="empty-icon"><IconEmpty /></div>
            <p style={{ color: 'var(--text-2)', fontWeight: 500 }}>Nenhum contato importado</p>
            <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>Clique em "Importar via Apify" para buscar leads</p>
          </div>
        </div>
      ) : (
        <div className="card-lg" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nicho</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Disponíveis</th>
                <th style={{ textAlign: 'right' }}>Enviados</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {niches.map(n => {
                const sent = n.total - n.available;
                const pct  = n.total > 0 ? Math.round((sent / n.total) * 100) : 0;
                return (
                  <tr key={n.niche}>
                    <td>
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize', marginBottom: 5 }}>{n.niche}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ width: 100 }}>
                            <div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{pct}% enviado</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--text)' }}>{n.total.toLocaleString('pt-BR')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 500 }}>{n.available.toLocaleString('pt-BR')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-3)' }}>{sent.toLocaleString('pt-BR')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          onClick={() => setViewNiche(n.niche)}
                          className="btn btn-secondary btn-sm"
                        >
                          Ver contatos
                        </button>
                        <button
                          onClick={() => handleDeleteNiche(n.niche)}
                          disabled={deleting === n.niche}
                          className="btn btn-sm"
                          style={{ background: 'transparent', color: 'var(--text-3)', border: '1px solid transparent' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'transparent'; }}
                        >
                          {deleting === n.niche ? '...' : 'Deletar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
