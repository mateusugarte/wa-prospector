import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function IconX() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

export default function ImportModal({ onClose, onDone }) {
  const [niche, setNiche] = useState('');
  const [searchTerms, setSearchTerms] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [maxResults, setMaxResults] = useState(100);
  const [minReviews, setMinReviews] = useState(0);
  const [maxReviews, setMaxReviews] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleImport() {
    if (!niche || !searchTerms) { setMsg({ type: 'error', text: 'Preencha nicho e termos de busca.' }); return; }
    setLoading(true); setMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/contacts/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, searchTerms, locationQuery, maxResults: Number(maxResults), minReviews: Number(minReviews), maxReviews: maxReviews !== '' ? Number(maxReviews) : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'ok', text: 'Importação iniciada! Os contatos aparecerão em alguns minutos.' });
      setTimeout(onDone, 4000);
    } catch (err) { setMsg({ type: 'error', text: err.message }); setLoading(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9375rem' }}>Importar via Google Maps</p>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 6 }}><IconX /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Nicho *</label>
            <input className="input" value={niche} onChange={e => setNiche(e.target.value)} placeholder="Ex: restaurantes" />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>Nome para agrupar esses contatos no sistema</p>
          </div>

          <div>
            <label className="label">Termos de busca * <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(um por linha)</span></label>
            <textarea
              className="textarea"
              value={searchTerms}
              onChange={e => setSearchTerms(e.target.value)}
              rows={3}
              placeholder={'restaurante\npizzaria\nchurrascaria'}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>Palavras-chave do negócio para buscar no Google Maps</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Localização</label>
              <input className="input" value={locationQuery} onChange={e => setLocationQuery(e.target.value)} placeholder="Ex: São Paulo, SP" />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>Deixe vazio para busca geral</p>
            </div>
            <div>
              <label className="label">Quantidade</label>
              <input className="input" type="number" value={maxResults} onChange={e => setMaxResults(e.target.value)} min={10} max={1000} />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>Máx. de resultados</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Mín. de avaliações</label>
              <input className="input" type="number" value={minReviews} onChange={e => setMinReviews(e.target.value)} min={0} placeholder="0" />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>Pelo menos N avaliações. 0 = sem filtro.</p>
            </div>
            <div>
              <label className="label">Máx. de avaliações</label>
              <input className="input" type="number" value={maxReviews} onChange={e => setMaxReviews(e.target.value)} min={0} placeholder="Sem limite" />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>Exclui negócios muito grandes. Vazio = sem limite.</p>
            </div>
          </div>

          {msg && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem',
              background: msg.type === 'error' ? 'rgba(239,68,68,0.1)' : 'var(--accent-dim)',
              color: msg.type === 'error' ? 'var(--danger)' : 'var(--accent)',
              border: `1px solid ${msg.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
            }}>
              {msg.text}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleImport} disabled={loading} className="btn btn-primary">
            {loading ? 'Iniciando…' : 'Iniciar importação'}
          </button>
        </div>
      </div>
    </div>
  );
}
