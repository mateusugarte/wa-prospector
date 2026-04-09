import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function IconX() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

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

  async function handleSave() {
    if (!name || !instanceId || !intervalOption) { setError('Preencha nome, instância e intervalo.'); return; }
    if (!isEdit) {
      if (mode === 'phones' && phoneList.length === 0) { setError('Adicione ao menos um número.'); return; }
      if (mode === 'niche' && !niche) { setError('Selecione um nicho.'); return; }
    }
    setSaving(true); setError(null);
    try {
      if (isEdit) {
        const res = await fetch(`${API_URL}/api/campaigns/${existing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, template_id: templateId || null, instance_id: instanceId, interval_min: selectedInterval.min, interval_max: selectedInterval.max }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      } else {
        const body = { name, template_id: templateId || null, instance_id: instanceId, interval_min: selectedInterval.min, interval_max: selectedInterval.max };
        if (mode === 'phones') body.phones = phoneList.join('\n');
        else { body.niche = niche; body.quantity = Number(quantity); }
        const res = await fetch(`${API_URL}/api/campaigns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }
      onSaved();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9375rem' }}>
            {isEdit ? 'Editar campanha' : 'Nova campanha'}
          </p>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 6 }}><IconX /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Nome */}
          <div>
            <label className="label">Nome *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Prospecção Abril 2026" />
          </div>

          {/* Instância + Template */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Instância WA *</label>
              <select className="select" value={instanceId} onChange={e => setInstanceId(e.target.value)}>
                <option value="">Selecionar</option>
                {instances.map(i => <option key={i.instance_id} value={i.instance_id}>{i.name}</option>)}
              </select>
              {instances.length === 0 && <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: 4 }}>Nenhuma instância conectada</p>}
            </div>
            <div>
              <label className="label">Template</label>
              <select className="select" value={templateId} onChange={e => setTemplateId(e.target.value)}>
                <option value="">Selecionar depois</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {/* Intervalo */}
          <div>
            <label className="label">Intervalo entre mensagens *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {intervals.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setIntervalOption(opt.label)}
                  style={{
                    padding: '8px 10px', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 500,
                    border: `1px solid ${intervalOption === opt.label ? 'var(--accent)' : 'var(--border)'}`,
                    background: intervalOption === opt.label ? 'var(--accent-dim)' : 'var(--surface-2)',
                    color: intervalOption === opt.label ? 'var(--accent)' : 'var(--text-2)',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Leads (somente criação) */}
          {!isEdit && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label className="label" style={{ margin: 0 }}>Leads</label>
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  {['phones', 'niche'].map(m => (
                    <button key={m} onClick={() => setMode(m)} style={{
                      padding: '5px 12px', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', border: 'none',
                      background: mode === m ? 'var(--accent)' : 'var(--surface-2)',
                      color: mode === m ? '#fff' : 'var(--text-2)',
                      transition: 'all 0.15s ease',
                    }}>
                      {m === 'phones' ? 'Manual' : 'Por nicho'}
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'phones' ? (
                <div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input"
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPhone())}
                      placeholder="5511999999999"
                      style={{ fontFamily: 'monospace' }}
                    />
                    <button onClick={addPhone} className="btn btn-secondary" style={{ flexShrink: 0 }}>Adicionar</button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>
                    Com código do país (55) · Enter para adicionar
                    {phoneList.length > 0 && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>{phoneList.length} número{phoneList.length !== 1 ? 's' : ''}</span>}
                  </p>
                  {phoneList.length > 0 && (
                    <div style={{ marginTop: 8, maxHeight: 120, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {phoneList.map(p => (
                        <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', borderRadius: 6, padding: '5px 10px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-2)' }}>{p}</span>
                          <button onClick={() => setPhoneList(prev => prev.filter(x => x !== p))} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Nicho *</label>
                    <select className="select" value={niche} onChange={e => setNiche(e.target.value)}>
                      <option value="">Selecionar nicho</option>
                      {niches.map(n => <option key={n.niche} value={n.niche}>{n.niche} ({n.available})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Quantidade * {selectedNiche && <span style={{ color: 'var(--text-3)' }}>máx. {selectedNiche.available}</span>}</label>
                    <input className="input" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min={1} max={selectedNiche?.available || 9999} />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p style={{ fontSize: '0.875rem', color: 'var(--danger)' }}>{error}</p>}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? (isEdit ? 'Salvando...' : 'Criando...') : isEdit ? 'Salvar' : mode === 'niche' ? `Criar (${quantity} leads)` : `Criar${phoneList.length > 0 ? ` (${phoneList.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
