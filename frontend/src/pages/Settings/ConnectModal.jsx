import React, { useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function IconX() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function IconCheck() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}

export default function ConnectModal({ onClose, onConnected }) {
  const [step, setStep] = useState('form');
  const [name, setName] = useState('');
  const [instanceToken, setInstanceToken] = useState('');
  const [qrcode, setQrcode] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const pollRef = useRef(null);

  async function handleCreate() {
    if (!name.trim() || !instanceToken.trim()) { setError('Nome e token são obrigatórios.'); return; }
    setCreating(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/instances/connect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), instanceToken: instanceToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao registrar instância');
      await loadQrCode(instanceToken.trim());
      setStep('qrcode');
      startPolling(instanceToken.trim());
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  }

  async function loadQrCode(id) {
    try {
      const res = await fetch(`${API_URL}/api/instances/${id}/qrcode`);
      const data = await res.json();
      if (!res.ok) { setError(`Erro QR: ${data.error || res.status}`); return; }
      if (data.qrcode) { setQrcode(data.qrcode); setError(null); }
      else { setError(`QR não encontrado`); }
    } catch (err) { setError(`Falha ao buscar QR: ${err.message}`); }
  }

  function startPolling(id) {
    pollRef.current = setInterval(async () => {
      try {
        await loadQrCode(id);
        const res = await fetch(`${API_URL}/api/instances/${id}/status`);
        const data = await res.json();
        if (data.isConnected) { clearInterval(pollRef.current); setStep('connected'); setTimeout(onConnected, 1500); }
      } catch (_) {}
    }, 5000);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9375rem' }}>Conectar WhatsApp</p>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 6 }}><IconX /></button>
        </div>

        {step === 'form' && (
          <>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Nome da instância *</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Vendas Principal" />
              </div>
              <div>
                <label className="label">Token da instância *</label>
                <input
                  className="input"
                  value={instanceToken}
                  onChange={e => setInstanceToken(e.target.value)}
                  placeholder="f57ab3e6-ee7d-4aec-8364-…"
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>
                  Painel UazAPI → sua instância → token
                </p>
              </div>
              {error && <p style={{ fontSize: '0.875rem', color: 'var(--danger)' }}>{error}</p>}
            </div>
            <div className="modal-footer">
              <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
              <button onClick={handleCreate} disabled={creating} className="btn btn-primary">
                {creating ? 'Criando…' : 'Gerar QR Code'}
              </button>
            </div>
          </>
        )}

        {step === 'qrcode' && (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
              Abra o WhatsApp → <strong style={{ color: 'var(--text)' }}>Aparelhos conectados</strong> → <strong style={{ color: 'var(--text)' }}>Conectar aparelho</strong>
            </p>
            {qrcode ? (
              <div style={{ display: 'inline-block', padding: 10, background: '#fff', borderRadius: 12 }}>
                <img src={qrcode} alt="QR Code" style={{ display: 'block', width: 200, height: 200, borderRadius: 6 }} />
              </div>
            ) : (
              <div style={{
                width: 220, height: 220, margin: '0 auto',
                background: 'var(--surface-2)', borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Carregando QR…</p>
              </div>
            )}
            {error && <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: 10 }}>{error}</p>}
            <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 16 }} className="animate-pulse-soft">
              Aguardando conexão…
            </p>
          </div>
        )}

        {step === 'connected' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56,
              background: 'var(--accent-dim)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--accent)',
            }}>
              <IconCheck />
            </div>
            <p style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '1rem', marginBottom: 4 }}>WhatsApp conectado!</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Fechando…</p>
          </div>
        )}
      </div>
    </div>
  );
}
