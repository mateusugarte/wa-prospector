import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_LABELS = {
  draft:     { label: 'Rascunho',  color: 'bg-gray-700 text-gray-300' },
  running:   { label: 'Rodando',   color: 'bg-green-900 text-green-300' },
  paused:    { label: 'Pausada',   color: 'bg-yellow-900 text-yellow-300' },
  completed: { label: 'Concluída', color: 'bg-blue-900 text-blue-300' },
  cancelled: { label: 'Encerrada', color: 'bg-red-900 text-red-300' },
};

function CampaignModal({ existing, onClose, onSaved }) {
  const isEdit = !!existing;

  const [mode, setMode] = useState('phones'); // 'phones' | 'niche'
  const [name, setName] = useState(existing?.name || '');
  const [templateId, setTemplateId] = useState(existing?.template_id || '');
  const [instanceId, setInstanceId] = useState(existing?.instance_id || '');
  const [intervalOption, setIntervalOption] = useState('');
  const [phones, setPhones] = useState('');
  const [niche, setNiche] = useState('');
  const [quantity, setQuantity] = useState(50);
  const [templates, setTemplates] = useState([]);
  const [instances, setInstances] = useState([]);
  const [intervals, setIntervals] = useState([]);
  const [niches, setNiches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      supabase.from('templates').select('id, name').order('name'),
      supabase.from('wa_instances').select('instance_id, name').eq('status', 'connected'),
      fetch(`${API_URL}/api/campaigns/intervals`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/api/contacts/niches`).then(r => r.json()).catch(() => []),
    ]).then(([{ data: tpls }, { data: insts }, ivls, nch]) => {
      setTemplates(tpls ?? []);
      setInstances(insts ?? []);
      setIntervals(ivls ?? []);
      setNiches(Array.isArray(nch) ? nch : []);

      // Pré-seleciona intervalo se editando
      if (existing && ivls?.length) {
        const found = ivls.find(i => i.min === existing.interval_min && i.max === existing.interval_max);
        if (found) setIntervalOption(found.label);
      }
    });
  }, []);

  const selectedInterval = intervals.find(i => i.label === intervalOption);
  const phoneCount = phones.split('\n').map(p => p.trim().replace(/\D/g, '')).filter(p => p.length >= 10).length;

  async function handleSave() {
    if (!name || !instanceId || !intervalOption) {
      setError('Preencha nome, instância e intervalo.');
      return;
    }
    if (!isEdit) {
      if (mode === 'phones' && phoneCount === 0) {
        setError('Adicione ao menos um número válido.');
        return;
      }
      if (mode === 'niche' && !niche) {
        setError('Selecione um nicho.');
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      if (isEdit) {
        const res = await fetch(`${API_URL}/api/campaigns/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            template_id: templateId || null,
            instance_id: instanceId,
            interval_min: selectedInterval.min,
            interval_max: selectedInterval.max,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      } else {
        const body = {
          name,
          template_id: templateId || null,
          instance_id: instanceId,
          interval_min: selectedInterval.min,
          interval_max: selectedInterval.max,
        };
        if (mode === 'phones') {
          body.phones = phones;
        } else {
          body.niche = niche;
          body.quantity = Number(quantity);
        }
        const res = await fetch(`${API_URL}/api/campaigns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const selectedNiche = niches.find(n => n.niche === niche);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">{isEdit ? 'Editar campanha' : 'Nova campanha'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Nome */}
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Nome da campanha *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              placeholder="Ex: Prospecção Abril 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Instância WhatsApp */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Instância WhatsApp *</label>
              <select
                value={instanceId}
                onChange={e => setInstanceId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              >
                <option value="">Selecionar</option>
                {instances.map(i => (
                  <option key={i.instance_id} value={i.instance_id}>{i.name}</option>
                ))}
              </select>
              {instances.length === 0 && (
                <p className="text-xs text-yellow-500 mt-1">Nenhuma instância conectada</p>
              )}
            </div>

            {/* Template */}
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
          </div>

          {/* Intervalo */}
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Intervalo entre mensagens *</label>
            <div className="grid grid-cols-3 gap-2">
              {intervals.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setIntervalOption(opt.label)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    intervalOption === opt.label
                      ? 'bg-green-600 border-green-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Leads — apenas na criação */}
          {!isEdit && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <label className="text-sm text-gray-400">Modo de leads</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-700 ml-auto">
                  <button
                    onClick={() => setMode('phones')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'phones' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                  >
                    Manual
                  </button>
                  <button
                    onClick={() => setMode('niche')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'niche' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                  >
                    Por nicho
                  </button>
                </div>
              </div>

              {mode === 'phones' ? (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">
                    Números de telefone *
                    {phoneCount > 0 && <span className="ml-2 text-green-400">{phoneCount} válido{phoneCount !== 1 ? 's' : ''}</span>}
                  </label>
                  <textarea
                    value={phones}
                    onChange={e => setPhones(e.target.value)}
                    rows={5}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 resize-none font-mono"
                    placeholder={'5511999999999\n5521988888888'}
                  />
                  <p className="text-xs text-gray-600 mt-1">Um número por linha com código do país (55 para Brasil)</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Nicho *</label>
                    <select
                      value={niche}
                      onChange={e => setNiche(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                    >
                      <option value="">Selecionar nicho</option>
                      {niches.map(n => (
                        <option key={n.niche} value={n.niche}>
                          {n.niche} ({n.available} disponíveis)
                        </option>
                      ))}
                    </select>
                    {niches.length === 0 && (
                      <p className="text-xs text-yellow-500 mt-1">Nenhum contato importado ainda</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      Quantidade *
                      {selectedNiche && (
                        <span className="ml-2 text-gray-500">máx. {selectedNiche.available} disponíveis</span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      min={1}
                      max={selectedNiche?.available || 9999}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

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
            {saving
              ? (isEdit ? 'Salvando...' : 'Criando...')
              : isEdit
                ? 'Salvar alterações'
                : mode === 'niche'
                  ? `Criar campanha (${quantity} leads)`
                  : `Criar campanha${phoneCount > 0 ? ` (${phoneCount} leads)` : ''}`
            }
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
  const [editCampaign, setEditCampaign] = useState(null);
  const [acting, setActing] = useState(null);

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

  async function action(campaignId, type) {
    setActing(campaignId);
    try {
      await fetch(`${API_URL}/api/campaigns/${campaignId}/${type}`, { method: 'POST' });
      await load();
    } finally {
      setActing(null);
    }
  }

  function CampaignActions({ c }) {
    const busy = acting === c.id;
    if (c.status === 'draft' || c.status === 'paused') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditCampaign(c)}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            Editar
          </button>
          <button
            onClick={() => action(c.id, 'start')}
            disabled={busy}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {busy ? '...' : '▶ Iniciar'}
          </button>
          {c.status === 'paused' && (
            <button
              onClick={() => action(c.id, 'stop')}
              disabled={busy}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              ■ Encerrar
            </button>
          )}
        </div>
      );
    }
    if (c.status === 'running') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => action(c.id, 'pause')}
            disabled={busy}
            className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {busy ? '...' : '⏸ Pausar'}
          </button>
          <button
            onClick={() => action(c.id, 'stop')}
            disabled={busy}
            className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            ■ Encerrar
          </button>
        </div>
      );
    }
    return null;
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
        <CampaignModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}
      {editCampaign && (
        <CampaignModal
          existing={editCampaign}
          onClose={() => setEditCampaign(null)}
          onSaved={() => { setEditCampaign(null); load(); }}
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
              {campaigns.map((c) => {
                const s = STATUS_LABELS[c.status] ?? STATUS_LABELS.draft;
                const progress = c.total_leads > 0
                  ? Math.round(((c.sent_count + c.failed_count) / c.total_leads) * 100)
                  : 0;
                return (
                  <tr key={c.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-white">{c.name}</p>
                      {c.status === 'running' && (
                        <div className="w-32 bg-gray-700 rounded-full h-1 mt-1">
                          <div className="bg-green-500 h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400">{c.total_leads ?? 0}</td>
                    <td className="px-5 py-3 text-right text-green-400">{c.sent_count ?? 0}</td>
                    <td className="px-5 py-3 text-right text-red-400">{c.failed_count ?? 0}</td>
                    <td className="px-5 py-3 text-right">
                      <CampaignActions c={c} />
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
