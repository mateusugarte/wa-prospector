import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const STATUS_LABELS = {
  draft: { label: 'Rascunho', color: 'bg-gray-700 text-gray-300' },
  running: { label: 'Rodando', color: 'bg-green-900 text-green-300' },
  paused: { label: 'Pausada', color: 'bg-yellow-900 text-yellow-300' },
  completed: { label: 'Concluída', color: 'bg-blue-900 text-blue-300' },
  cancelled: { label: 'Cancelada', color: 'bg-red-900 text-red-300' },
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('campaigns')
        .select('id, name, status, total_leads, sent_count, failed_count, created_at')
        .order('created_at', { ascending: false });
      setCampaigns(data ?? []);
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
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Campanhas</h2>
        <button className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Nova campanha
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500 mb-2">Nenhuma campanha criada ainda.</p>
          <p className="text-gray-600 text-sm">Clique em "Nova campanha" para começar.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left px-5 py-3 font-medium">Nome</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-right px-5 py-3 font-medium">Leads</th>
                <th className="text-right px-5 py-3 font-medium">Enviados</th>
                <th className="text-right px-5 py-3 font-medium">Falhas</th>
                <th className="text-left px-5 py-3 font-medium">Criada em</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const s = STATUS_LABELS[c.status] ?? STATUS_LABELS.draft;
                return (
                  <tr key={c.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-white">{c.name}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400">{c.total_leads}</td>
                    <td className="px-5 py-3 text-right text-green-400">{c.sent_count}</td>
                    <td className="px-5 py-3 text-right text-red-400">{c.failed_count}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
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
