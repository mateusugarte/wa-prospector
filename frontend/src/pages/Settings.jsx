import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_INFO = {
  disconnected: { label: 'Desconectado', color: 'text-red-400', dot: 'bg-red-500' },
  connecting: { label: 'Conectando...', color: 'text-yellow-400', dot: 'bg-yellow-500 animate-pulse' },
  connected: { label: 'Conectado', color: 'text-green-400', dot: 'bg-green-500' },
};

export default function Settings() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);

  useEffect(() => {
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
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
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
          <button className="bg-green-600 hover:bg-green-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
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
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      <span className={`text-sm ${s.color}`}>{s.label}</span>
                    </div>
                    <button className="text-xs text-gray-400 hover:text-red-400 px-2 py-1 transition-colors">
                      Desconectar
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
