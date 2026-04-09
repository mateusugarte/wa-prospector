import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function CampaignModal({ existing, onClose, onSaved }) {
  const isEdit = !!existing;

  const [mode, setMode] = useState('phones');
  const [name, setName] = useState(existing?.name || '');
  const [templateId, setTemplateId] = useState(existing?.template_id || '');
  const [instanceId, setInstanceId] = useState(existing?.instance_id || '');
  const [intervalOption, setIntervalOption] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneList, setPhoneList] = useState([]);
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
  const selectedNiche    = niches.find(n => n.niche === niche);

  function addPhone() {
    const cleaned = phoneInput.trim().replace(/\D/g, '');
    if (cleaned.length < 10) return;
    if (phoneList.includes(cleaned)) { setPhoneInput(''); return; }
    setPhoneList(prev => [...prev, cleaned]);
    setPhoneInput('');
  }

  function removePhone(phone) {
    setPhoneList(prev => prev.filter(p => p !== phone));
  }

  async function handleSave() {
    if (!name || !instanceId || !intervalOption) {
      setError('Preencha nome, instância e intervalo.');
      return;
    }
    if (!isEdit) {
      if (mode === 'phones' && phoneList.length === 0) { setError('Adicione ao menos um número válido.'); return; }
      if (mode === 'niche'  && !niche)                 { setError('Selecione um nicho.'); return; }
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
        if (mode === 'phones') body.phones = phoneList.join('\n');
        else { body.niche = niche; body.quantity = Number(quantity); }

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
            <label className="text-sm text-gray-400 mb-1 block">Nome *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Prospecção Abril 2026"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Instância + Template */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Instância WhatsApp *</label>
              <select
                value={instanceId}
                onChange={e => setInstanceId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              >
                <option value="">Selecionar</option>
                {instances.map(i => <option key={i.instance_id} value={i.instance_id}>{i.name}</option>)}
              </select>
              {instances.length === 0 && (
                <p className="text-xs text-yellow-500 mt-1">Nenhuma instância conectada</p>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Template de mensagem</label>
              <select
                value={templateId}
                onChange={e => setTemplateId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              >
                <option value="">Selecionar depois</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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

          {/* Modo de leads (somente criação) */}
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
                    Número *
                    {phoneList.length > 0 && (
                      <span className="ml-2 text-green-400">{phoneList.length} adicionado{phoneList.length !== 1 ? 's' : ''}</span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPhone())}
                      placeholder="5511999999999"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-green-500"
                    />
                    <button
                      type="button"
                      onClick={addPhone}
                      className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-2 rounded-lg transition-colors"
                    >
                      + Adicionar
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Com código do país (55 Brasil) · Enter para adicionar</p>
                  {phoneList.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                      {phoneList.map(p => (
                        <div key={p} className="flex items-center justify-between bg-gray-800 rounded px-3 py-1.5">
                          <span className="font-mono text-xs text-gray-300">{p}</span>
                          <button
                            type="button"
                            onClick={() => removePhone(p)}
                            className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
                        <option key={n.niche} value={n.niche}>{n.niche} ({n.available} disponíveis)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      Quantidade *
                      {selectedNiche && <span className="ml-2 text-gray-500">máx. {selectedNiche.available}</span>}
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
                  ? `Criar (${quantity} leads)`
                  : `Criar${phoneList.length > 0 ? ` (${phoneList.length} leads)` : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
