import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function StatCard({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({ campaigns: 0, sent: 0, failed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ count: campaigns }, { data: dispatches }] = await Promise.all([
        supabase.from('campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('dispatches').select('status'),
      ]);

      const sent = dispatches?.filter(d => d.status === 'sent').length ?? 0;
      const failed = dispatches?.filter(d => d.status === 'failed').length ?? 0;
      const pending = dispatches?.filter(d => d.status === 'pending').length ?? 0;

      setStats({ campaigns: campaigns ?? 0, sent, failed, pending });
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
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Campanhas" value={stats.campaigns} />
        <StatCard label="Enviados" value={stats.sent} color="text-green-400" />
        <StatCard label="Falhas" value={stats.failed} color="text-red-400" />
        <StatCard label="Pendentes" value={stats.pending} color="text-yellow-400" />
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <p className="text-gray-500 text-sm text-center py-8">
          Os gráficos ao vivo serão exibidos aqui conforme os disparos acontecem.
        </p>
      </div>
    </div>
  );
}
