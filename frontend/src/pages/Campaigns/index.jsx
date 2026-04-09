import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import CampaignModal from './CampaignModal';
import CampaignDetail from './CampaignDetail';

const STATUS_LABELS = {
  draft:     { label: 'Rascunho',  color: 'bg-gray-700 text-gray-300' },
  running:   { label: 'Rodando',   color: 'bg-green-900 text-green-300' },
  paused:    { label: 'Pausada',   color: 'bg-yellow-900 text-yellow-300' },
  completed: { label: 'Concluída', color: 'bg-blue-900 text-blue-300' },
  cancelled: { label: 'Encerrada', color: 'bg-red-900 text-red-300' },
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCampaign, setEditCampaign] = useState(null);
  const [detailCampaign, setDetailCampaign] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    const { data } = await supabase
      .from('campaigns')
      .select('id, name, status, total_leads, sent_count, failed_count, interval_min, interval_max, template_id, instance_id, created_at')
      .order('created_at', { ascending: false });
    setCampaigns(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleDelete(campaign) {
    if (!confirm(`Excluir a campanha "${campaign.name}"? Todos os disparos serão removidos.`)) return;
    setDeleting(campaign.id);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/campaigns/${campaign.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  }

  async function handleDetailAction() {
    await load();
    if (detailCampaign) {
      const { data } = await supabase
        .from('campaigns')
        .select('id, name, status, total_leads, sent_count, failed_count, interval_min, interval_max, template_id, instance_id')
        .eq('id', detailCampaign.id)
        .single();
      if (data) setDetailCampaign(data);
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
    <div className="p-8">
      {showModal && (
        <CampaignModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
      {editCampaign && (
        <CampaignModal
          existing={editCampaign}
          onClose={() => setEditCampaign(null)}
          onSaved={() => { setEditCampaign(null); load(); }}
        />
      )}
      {detailCampaign && (
        <CampaignDetail
          campaign={detailCampaign}
          onClose={() => setDetailCampaign(null)}
          onAction={handleDetailAction}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Campanhas</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
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
                <th className="text-right px-5 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const s = STATUS_LABELS[c.status] ?? STATUS_LABELS.draft;
                const progress = c.total_leads > 0
                  ? Math.round(((c.sent_count + c.failed_count) / c.total_leads) * 100)
                  : 0;
                return (
                  <tr key={c.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setDetailCampaign(c)}
                        className="font-medium text-white hover:text-green-400 transition-colors text-left"
                      >
                        {c.name}
                      </button>
                      {c.status === 'running' && (
                        <div className="w-32 bg-gray-700 rounded-full h-1 mt-1">
                          <div className="bg-green-500 h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400">{c.total_leads ?? 0}</td>
                    <td className="px-5 py-3 text-right text-green-400">{c.sent_count ?? 0}</td>
                    <td className="px-5 py-3 text-right text-red-400">{c.failed_count ?? 0}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(c.status === 'draft' || c.status === 'paused') && (
                          <button
                            onClick={() => setEditCampaign(c)}
                            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => setDetailCampaign(c)}
                          className="text-xs text-green-400 hover:text-green-300 border border-green-800 hover:border-green-600 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          Abrir
                        </button>
                        {c.status !== 'running' && (
                          <button
                            onClick={() => handleDelete(c)}
                            disabled={deleting === c.id}
                            className="text-xs text-gray-500 hover:text-red-400 disabled:opacity-50 px-2 py-1 transition-colors"
                          >
                            {deleting === c.id ? '...' : 'Excluir'}
                          </button>
                        )}
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
