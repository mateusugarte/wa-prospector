import React, { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function IconX() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

export default function AddContactsModal({ campaignId, onClose, onAdded }) {
  const [mode, setMode] = useState('phones');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneList, setPhoneList] = useState([]);
  const [niche, setNiche] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [niches, setNiches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/contacts/niches`)
      .then(r => r.json())
      .then(data => setNiches(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const selectedNiche = niches.find(n => n.niche === niche);

  function addPhone() {
    const cleaned = phoneInput.trim().replace(/\D/g, '');
    if (cleaned.length < 10) return;
    if (phoneList.includes(cleaned)) { setPhoneInput(''); return; }
    setPhoneList(prev => [...prev, cleaned]);
    setPhoneInput('');
  }

  async function handleAdd() {
    if (mode === 'phones' && phoneList.length === 0) { setError('Adicione ao menos um número.'); return; }
    if (mode === 'niche' && !niche) { setError('Selecione um nicho.'); return; }
    setSaving(true); setError(null);
    try {
      const body = mode === 'phones' ? { phones: phoneList.join('\n') } : { niche, quantity: Number(quantity) };
      const res = await fetch(`${API_URL}/api/campaigns/${campaignId}/contacts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAdded(data.added);
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 60 }}>
      <div className="modal-box" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9375rem' }}>Adicionar contatos</p>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 6 }}><IconX /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {['phones', 'niche'].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '8px 12px', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', border: 'none',
                background: mode === m ? 'var(--accent)' : 'var(--surface-2)',
                color: mode === m ? '#fff' : 'var(--text-2)',
                transition: 'all 0.15s ease',
              }}>
                {m === 'phones' ? 'Números manuais' : 'Por nicho'}
              </button>
            ))}
          </div>

          {mode === 'phones' ? (
            <div>
              <label className="label">
                Número
                {phoneList.length > 0 && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>{phoneList.length} adicionado{phoneList.length !== 1 ? 's' : ''}</span>}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPhone())}
                  placeholder="5511999999999"
                  style={{ fontFamily: 'monospace' }}
                />
                <button onClick={addPhone} className="btn btn-secondary" style={{ flexShrink: 0 }}>+ Add</button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>Com código do país (55) · Enter para adicionar</p>
              {phoneList.length > 0 && (
                <div style={{ marginTop: 8, maxHeight: 130, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {phoneList.map(p => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', borderRadius: 6, padding: '5px 10px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-2)' }}>{p}</span>
                      <button onClick={() => setPhoneList(prev => prev.filter(x => x !== p))} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Nicho</label>
                <select className="select" value={niche} onChange={e => setNiche(e.target.value)}>
                  <option value="">Selecionar nicho</option>
                  {niches.map(n => <option key={n.niche} value={n.niche}>{n.niche} ({n.available} disponíveis)</option>)}
                </select>
              </div>
              <div>
                <label className="label">
                  Quantidade
                  {selectedNiche && <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>máx. {selectedNiche.available}</span>}
                </label>
                <input className="input" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min={1} max={selectedNiche?.available || 9999} />
              </div>
            </div>
          )}

          {error && <p style={{ fontSize: '0.875rem', color: 'var(--danger)' }}>{error}</p>}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleAdd} disabled={saving} className="btn btn-primary">
            {saving ? 'Adicionando...' : mode === 'phones'
              ? `Adicionar${phoneList.length > 0 ? ` (${phoneList.length})` : ''}`
              : `Adicionar (${quantity})`}
          </button>
        </div>
      </div>
    </div>
  );
}
