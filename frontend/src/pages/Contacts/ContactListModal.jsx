import React, { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function IconX() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

export default function ContactListModal({ niche, onClose }) {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  async function load(p = 1) {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/contacts?niche=${encodeURIComponent(niche)}&page=${p}`);
    const data = await res.json();
    setContacts(data.contacts || []);
    setTotal(data.total || 0);
    setLoading(false);
  }

  useEffect(() => { load(page); }, [page]);

  async function handleDelete(id) {
    await fetch(`${API_URL}/api/contacts/${id}`, { method: 'DELETE' });
    load(page);
  }

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9375rem', textTransform: 'capitalize' }}>
              {niche}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 2 }}>{total} contatos</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 6 }}><IconX /></button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div className="shimmer" style={{ height: 12, width: 130 }} />
                  <div className="shimmer" style={{ height: 12, width: 90 }} />
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-3)' }}>Nenhum contato encontrado.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Telefone</th>
                  <th>Nome</th>
                  <th style={{ textAlign: 'center' }}>Enviados</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text)' }}>{c.phone}</td>
                    <td>{c.name || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                    <td style={{ textAlign: 'center', color: c.sent_count > 0 ? 'var(--accent)' : 'var(--text-3)', fontWeight: c.sent_count > 0 ? 500 : 400 }}>
                      {c.sent_count}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="btn btn-sm"
                        style={{ background: 'transparent', color: 'var(--text-3)', border: 'none', padding: '3px 8px' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; }}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{page} / {totalPages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima →</button>
          </div>
        )}
      </div>
    </div>
  );
}
