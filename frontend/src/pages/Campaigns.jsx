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

const DISPATCH_STATUS = {
  pending:   { label: 'Pendente',  color: 'text-gray-400' },
  sent:      { label: 'Enviado',   color: 'text-green-400' },
  failed:    { label: 'Falhou',    color: 'text-red-400' },
  cancelled: { label: 'Cancelado', color: 'text-gray-600' },
};

// ── Modal Criar/Editar Campanha ───────────────────────────────────────────────

function CampaignModal({ existing, onClose, onSaved }) {
  const isEdit = !!existing;

  const [mode, setMode] = useState('phones');
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
      if (existing && ivls?.length) {
        const found = ivls.find(i => i.min === existing.interval_min && i.max === existing.interval_max);
        if (found) setIntervalOption(found.label);
      }
    });
  }, []);

  const selectedInterval = intervals.find(i => i.label === intervalOption);
  const phoneCount = phones.split('\n').map(p => p.trim().replace(/\D/g, '')).filter(p => p.length >= 10).length;
  const selectedNiche = niches.find(n => n.niche === niche);

  async function handleSave() {
    if (!name || !instanceId || !intervalOption) {
      setError('Preencha nome, instância e intervalo.');
      return;
    }
    if (!isEdit) {
      if (mode === 'phones' && phoneCount === 0) { setError('Adicione ao menos um número válido.'); return; }
      if (mode === 'niche' && !niche) { setError('Selecione um nicho.'); return; }
    }
    setSaving(true); setError(null);
    try {
      if (isEdit) {
        const res = await fetch(`${API_URL}/api/campaigns/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, template_id: templateId || null, instance_id: instanceId, interval_min: selectedInterval.min, interval_max: selectedInterval.max }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      } else {
        const body = { name, template_id: templateId || null, instance_id: instanceId, interval_min: selectedInterval.min, interval_max: selectedInterval.max };
        if (mode === 'phones') body.phones = phones;
        else { body.niche = niche; body.quantity = Number(quantity); }
        const res = await fetch(`${API_URL}/api/campaigns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }
      onSaved();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">{isEdit ? 'Editar campanha' : 'Nova campanha'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Nome *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Prospecção Abril 2026"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Instância WhatsApp *</label>
              <select value={instanceId} onChange={e => setInstanceId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500">
                <option value="">Selecionar</option>
                {instances.map(i => <option key={i.instance_id} value={i.instance_id}>{i.name}</option>)}
              </select>
              {instances.length === 0 && <p className="text-xs text-yellow-500 mt-1">Nenhuma instância conectada</p>}
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Template de mensagem</label>
              <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500">
                <option value="">Selecionar depois</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Intervalo entre mensagens *</label>
            <div className="grid grid-cols-3 gap-2">
              {intervals.map(opt => (
                <button key={opt.label} onClick={() => setIntervalOption(opt.label)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${intervalOption === opt.label ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {!isEdit && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <label className="text-sm text-gray-400">Modo de leads</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-700 ml-auto">
                  <button onClick={() => setMode('phones')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'phones' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Manual</button>
                  <button onClick={() => setMode('niche')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'niche' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Por nicho</button>
                </div>
              </div>
              {mode === 'phones' ? (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Números *{phoneCount > 0 && <span className="ml-2 text-green-400">{phoneCount} válido{phoneCount !== 1 ? 's' : ''}</span>}</label>
                  <textarea value={phones} onChange={e => setPhones(e.target.value)} rows={5}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 resize-none font-mono"
                    placeholder={'5511999999999\n5521988888888'} />
                  <p className="text-xs text-gray-600 mt-1">Um por linha com código do país (55 Brasil)</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Nicho *</label>
                    <select value={niche} onChange={e => setNiche(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500">
                      <option value="">Selecionar nicho</option>
                      {niches.map(n => <option key={n.niche} value={n.niche}>{n.niche} ({n.available} disponíveis)</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Quantidade *{selectedNiche && <span className="ml-2 text-gray-500">máx. {selectedNiche.available}</span>}</label>
                    <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min={1} max={selectedNiche?.available || 9999}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" />
                  </div>
                </div>
              )}
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
            {saving ? (isEdit ? 'Salvando...' : 'Criando...') : isEdit ? 'Salvar alterações' : mode === 'niche' ? `Criar (${quantity} leads)` : `Criar${phoneCount > 0 ? ` (${phoneCount} leads)` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Painel de Detalhes da Campanha ────────────────────────────────────────────

function CampaignDetail({ campaign, onClose, onAction }) {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shuffling, setShuffling] = useState(false);
  const [shuffleMsg, setShuffleMsg] = useState(null);
  const [acting, setActing] = useState(false);

  async function loadDispatches() {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/campaigns/${campaign.id}/dispatches`);
    const data = await res.json();
    setDispatches(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { loadDispatches(); }, [campaign.id]);

  // Atualiza dispatches a cada 4s quando rodando
  useEffect(() => {
    if (campaign.status !== 'running') return;
    const t = setInterval(loadDispatches, 4000);
    return () => clearInterval(t);
  }, [campaign.status]);

  async function handleShuffle() {
    setShuffling(true);
    setShuffleMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/campaigns/${campaign.id}/shuffle`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShuffleMsg({ ok: true, text: `${data.count} mensagens únicas geradas!` });
      await loadDispatches();
    } catch (err) {
      setShuffleMsg({ ok: false, text: err.message });
    } finally {
      setShuffling(false);
    }
  }

  async function handleAction(type) {
    setActing(true);
    await fetch(`${API_URL}/api/campaigns/${campaign.id}/${type}`, { method: 'POST' });
    onAction();
    setActing(false);
  }

  const pending = dispatches.filter(d => d.status === 'pending').length;
  const sent    = dispatches.filter(d => d.status === 'sent').length;
  const failed  = dispatches.filter(d => d.status === 'failed').length;
  const isShuffled = dispatches.some(d => d.message_sent);
  const canEdit = campaign.status === 'draft' || campaign.status === 'paused';
  const s = STATUS_LABELS[campaign.status] ?? STATUS_LABELS.draft;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h3 className="font-semibold text-white text-lg">{campaign.name}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
              <span className="text-xs text-gray-500">{campaign.interval_min}–{campaign.interval_max} min entre envios</span>
              <span className="text-xs text-gray-500">{dispatches.length} contatos</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Barra de progresso */}
        {dispatches.length > 0 && (
          <div className="px-6 py-3 border-b border-gray-800 shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>{sent} enviados · {failed} falhas · {pending} pendentes</span>
              <span>{dispatches.length > 0 ? Math.round(((sent + failed) / dispatches.length) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${dispatches.length > 0 ? ((sent + failed) / dispatches.length) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {/* Botão Misturar */}
        {canEdit && (
          <div className="px-6 py-3 border-b border-gray-800 shrink-0 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-white font-medium">Misturar mensagens</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {isShuffled
                  ? 'Mensagens únicas já geradas — você pode misturar novamente'
                  : 'Gera uma mensagem única e delay de digitação para cada contato'}
              </p>
            </div>
            <button
              onClick={handleShuffle}
              disabled={shuffling || !campaign.template_id}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${isShuffled ? 'bg-purple-700 hover:bg-purple-600 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
            >
              {shuffling ? 'Gerando...' : isShuffled ? '🔀 Misturar novamente' : '🔀 Misturar mensagens'}
            </button>
            {!campaign.template_id && <p className="text-xs text-yellow-500">Sem template</p>}
            {shuffleMsg && (
              <p className={`text-xs ${shuffleMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{shuffleMsg.text}</p>
            )}
          </div>
        )}

        {/* Tabela de dispatches */}
        <div className="overflow-auto flex-1">
          {loading ? (
            <p className="text-gray-500 text-sm p-6">Carregando...</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">Telefone</th>
                  <th className="text-left px-5 py-3 font-medium">Mensagem</th>
                  <th className="text-center px-4 py-3 font-medium">Delay</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map(d => {
                  const ds = DISPATCH_STATUS[d.status] ?? DISPATCH_STATUS.pending;
                  return (
                    <tr key={d.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40">
                      <td className="px-5 py-2.5 font-mono text-xs text-gray-300 whitespace-nowrap">{d.phone}</td>
                      <td className="px-5 py-2.5 text-gray-400 max-w-xs">
                        {d.message_sent
                          ? <span className="text-xs">{d.message_sent.slice(0, 80)}{d.message_sent.length > 80 ? '…' : ''}</span>
                          : <span className="text-xs text-gray-600 italic">Não gerada</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs text-gray-500 whitespace-nowrap">
                        {d.typing_delay ? `${d.typing_delay}ms` : <span className="text-gray-600">—</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-center text-xs font-medium ${ds.color}`}>{ds.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
          {(campaign.status === 'draft' || campaign.status === 'paused') && (
            <button onClick={() => handleAction('start')} disabled={acting}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {acting ? '...' : '▶ Iniciar campanha'}
            </button>
          )}
          {campaign.status === 'running' && (
            <button onClick={() => handleAction('pause')} disabled={acting}
              className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {acting ? '...' : '⏸ Pausar'}
            </button>
          )}
          {(campaign.status === 'running' || campaign.status === 'paused') && (
            <button onClick={() => handleAction('stop')} disabled={acting}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              ■ Encerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCampaign, setEditCampaign] = useState(null);
  const [detailCampaign, setDetailCampaign] = useState(null);

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

  // Quando uma ação é feita no detail, recarrega e atualiza o objeto aberto
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
    return <div className="flex items-center justify-center h-full"><p className="text-gray-500">Carregando...</p></div>;
  }

  return (
    <div className="p-8">
      {showModal && (
        <CampaignModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}
      {editCampaign && (
        <CampaignModal existing={editCampaign} onClose={() => setEditCampaign(null)} onSaved={() => { setEditCampaign(null); load(); }} />
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
        <button onClick={() => setShowModal(true)}
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
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
                  ? Math.round(((c.sent_count + c.failed_count) / c.total_leads) * 100) : 0;
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
                          <button onClick={() => setEditCampaign(c)}
                            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-2.5 py-1.5 rounded-lg transition-colors">
                            Editar
                          </button>
                        )}
                        <button onClick={() => setDetailCampaign(c)}
                          className="text-xs text-green-400 hover:text-green-300 border border-green-800 hover:border-green-600 px-2.5 py-1.5 rounded-lg transition-colors">
                          Abrir
                        </button>
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
