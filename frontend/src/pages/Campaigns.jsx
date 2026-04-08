import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const STATUS_LABELS = {
  draft: { label: 'Rascunho', color: 'bg-gray-700 text-gray-300' },
  running: { label: 'Rodando', color: 'bg-green-900 text-green-300' },
  paused: { label: 'Pausada', color: 'bg-yellow-900 text-yellow-300' },
  completed: { label: 'Concluída', color: 'bg-blue-900 text-blue-300' },
  cancelled: { label: 'Cancelada', color: 'bg-red-900 text-red-300' },
};

function CampaignModal({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.from('templates').select('id, name').order('name').then(({ data }) => {
      setTemplates(data ?? []);
    });
  }, []);

  async function handleSave() {
    if (!name.trim()) {
      setError('Nome é obrigatório.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('campaigns').insert({
      name: name.trim(),
      template_id: templateId || null,
      status: 'draft',
    });
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Nova campanha</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Nome *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              placeholder="Ex: Prospecção Janeiro 2026"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Template de mensagem</label>
            <select
              value={templateId}
              onChange={e => setTemplateId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            >
              <option value="">Selecionar depois</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-600">
            A campanha será criada como rascunho. Você poderá configurar leads e iniciar o disparo depois.
          </p>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Criando...' : 'Criar rascunho'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('campaigns')
      .select('id, name, status, total_leads, sent_count, failed_count, created_at')
      .order('created_at', { ascending: false });
    setCampaigns(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleSaved() {
    setShowModal(false);
    load();
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
        <CampaignModal onClose={() => setShowModal(false)} onSaved={handleSaved} />
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
                    <td className="px-5 py-3 text-right text-gray-400">{c.total_leads ?? 0}</td>
                    <td className="px-5 py-3 text-right text-green-400">{c.sent_count ?? 0}</td>
                    <td className="px-5 py-3 text-right text-red-400">{c.failed_count ?? 0}</td>
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
