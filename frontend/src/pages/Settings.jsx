import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_INFO = {
  disconnected: { label: 'Desconectado', color: 'text-red-400', dot: 'bg-red-500' },
  connecting: { label: 'Conectando...', color: 'text-yellow-400', dot: 'bg-yellow-500 animate-pulse' },
  connected: { label: 'Conectado', color: 'text-green-400', dot: 'bg-green-500' },
};

function ConnectModal({ onClose, onConnected }) {
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
      // Registra a instância no Supabase
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
      const qr = data.qrcode || data.base64 || data.qr || data.image;
      if (qr) setQrcode(qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`);
    } catch (_) {}
  }

  function startPolling(id) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/instances/${id}/status`);
        const data = await res.json();
        if (data.isConnected) {
          clearInterval(pollRef.current);
          setStep('connected');
          setTimeout(() => { onConnected(); }, 1500);
        } else {
          // Atualiza QR code periodicamente (expira a cada ~20s)
          await loadQrCode(id);
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
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                  placeholder="Ex: Vendas Principal"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Token da instância *</label>
                <input
                  value={instanceToken}
                  onChange={e => setInstanceToken(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 font-mono"
                  placeholder="f57ab3e6-ee7d-4aec-8364-..."
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

export default function Settings() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    const [{ data }, healthRes] = await Promise.all([
      supabase
        .from('wa_instances')
        .select('id, name, instance_id, status, phone, connected_at')
        .order('created_at', { ascending: false }),
      fetch(`${API_URL}/health/db`).then(r => r.json()).catch(() => null),
    ]);
    setInstances(data ?? []);
    setHealth(healthRes);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDisconnect(instanceId) {
    setDisconnecting(instanceId);
    try {
      await fetch(`${API_URL}/api/instances/${instanceId}/disconnect`, { method: 'POST' });
      await load();
    } finally {
      setDisconnecting(null);
    }
  }

  async function handleDelete(instanceId) {
    if (!confirm('Remover esta instância do sistema?')) return;
    setDeleting(instanceId);
    try {
      await fetch(`${API_URL}/api/instances/${instanceId}`, { method: 'DELETE' });
      await load();
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      {showModal && (
        <ConnectModal
          onClose={() => setShowModal(false)}
          onConnected={() => { setShowModal(false); load(); }}
        />
      )}

      <h2 className="text-2xl font-bold mb-6">Configurações</h2>

      {/* Status do backend */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Status do Sistema
        </h3>
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${health?.ok ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">
            Backend:{' '}
            <span className={health?.ok ? 'text-green-400' : 'text-red-400'}>
              {health?.ok ? 'Online' : 'Offline'}
            </span>
          </span>
          <span className="text-gray-700">·</span>
          <span className="text-sm">
            Supabase:{' '}
            <span className={health?.supabase === 'connected' ? 'text-green-400' : 'text-red-400'}>
              {health?.supabase === 'connected' ? 'Conectado' : health?.supabase ?? 'N/A'}
            </span>
          </span>
        </div>
        <p className="text-xs text-gray-600 mt-2">Backend: {API_URL}</p>
      </div>

      {/* Instâncias WhatsApp */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Instâncias WhatsApp
          </h3>
          <button
            onClick={() => setShowModal(true)}
            className="bg-green-600 hover:bg-green-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            + Conectar novo número
          </button>
        </div>

        {instances.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-1">Nenhum número conectado.</p>
            <p className="text-gray-600 text-sm">
              Clique em "Conectar novo número" para escanear o QR Code.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {instances.map((inst) => {
              const s = STATUS_INFO[inst.status] ?? STATUS_INFO.disconnected;
              return (
                <div key={inst.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                  <div>
                    <p className="font-medium text-white">{inst.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {inst.phone ?? inst.instance_id}
                    </p>
                    {inst.connected_at && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        Conectado desde {new Date(inst.connected_at).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      <span className={`text-sm ${s.color}`}>{s.label}</span>
                    </div>
                    <button
                      onClick={() => handleDisconnect(inst.instance_id)}
                      disabled={disconnecting === inst.instance_id}
                      className="text-xs text-gray-400 hover:text-yellow-400 disabled:opacity-50 px-2 py-1 transition-colors"
                    >
                      {disconnecting === inst.instance_id ? '...' : 'Desconectar'}
                    </button>
                    <button
                      onClick={() => handleDelete(inst.instance_id)}
                      disabled={deleting === inst.instance_id}
                      className="text-xs text-gray-400 hover:text-red-400 disabled:opacity-50 px-2 py-1 transition-colors"
                    >
                      {deleting === inst.instance_id ? '...' : 'Excluir'}
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
