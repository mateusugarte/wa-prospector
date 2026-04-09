import React, { useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ConnectModal({ onClose, onConnected }) {
  const [step, setStep] = useState('form'); // 'form' | 'qrcode' | 'connected'
  const [name, setName] = useState('');
  const [instanceToken, setInstanceToken] = useState('');
  const [qrcode, setQrcode] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const pollRef = useRef(null);

  async function handleCreate() {
    if (!name.trim() || !instanceToken.trim()) {
      setError('Nome e token são obrigatórios.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/instances/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), instanceToken: instanceToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao registrar instância');
      await loadQrCode(instanceToken.trim());
      setStep('qrcode');
      startPolling(instanceToken.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function loadQrCode(id) {
    try {
      const res = await fetch(`${API_URL}/api/instances/${id}/qrcode`);
      const data = await res.json();
      if (!res.ok) { setError(`Erro QR: ${data.error || res.status}`); return; }
      if (data.qrcode) {
        setQrcode(data.qrcode);
        setError(null);
      } else {
        setError(`QR não encontrado. Campos: ${(data.fields || []).join(', ')}`);
      }
    } catch (err) {
      setError(`Falha ao buscar QR: ${err.message}`);
    }
  }

  function startPolling(id) {
    pollRef.current = setInterval(async () => {
      try {
        await loadQrCode(id);
        const res = await fetch(`${API_URL}/api/instances/${id}/status`);
        const data = await res.json();
        if (data.isConnected) {
          clearInterval(pollRef.current);
          setStep('connected');
          setTimeout(() => { onConnected(); }, 1500);
        }
      } catch (_) {}
    }, 5000);
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Conectar WhatsApp</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        {step === 'form' && (
          <>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Nome da instância *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Vendas Principal"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Token da instância *</label>
                <input
                  value={instanceToken}
                  onChange={e => setInstanceToken(e.target.value)}
                  placeholder="f57ab3e6-ee7d-4aec-8364-..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 font-mono"
                />
                <p className="text-xs text-gray-600 mt-1">Encontrado no painel da UazAPI → sua instância → token</p>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={onClose} className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {creating ? 'Criando...' : 'Gerar QR Code'}
              </button>
            </div>
          </>
        )}

        {step === 'qrcode' && (
          <div className="p-6 text-center">
            <p className="text-sm text-gray-400 mb-4">
              Abra o WhatsApp no celular → <strong className="text-white">Aparelhos conectados</strong> → <strong className="text-white">Conectar aparelho</strong>
            </p>
            {qrcode ? (
              <img src={qrcode} alt="QR Code WhatsApp" className="mx-auto rounded-xl w-56 h-56 bg-white p-2" />
            ) : (
              <div className="w-56 h-56 mx-auto bg-gray-800 rounded-xl flex items-center justify-center">
                <p className="text-gray-500 text-sm">Carregando QR...</p>
              </div>
            )}
            {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
            <p className="text-xs text-gray-600 mt-4 animate-pulse">Aguardando conexão...</p>
          </div>
        )}

        {step === 'connected' && (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-green-400 font-semibold">WhatsApp conectado!</p>
            <p className="text-gray-500 text-sm mt-1">Fechando...</p>
          </div>
        )}
      </div>
    </div>
  );
}
