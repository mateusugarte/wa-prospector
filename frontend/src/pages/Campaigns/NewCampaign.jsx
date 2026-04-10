import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function IconArrowLeft() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
}
function IconCheck() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}

export default function NewCampaign() {
  const navigate = useNavigate();

  const [mode, setMode] = useState('niche');
  const [name, setName] = useState('');
  const [templateIds, setTemplateIds] = useState([]);
  const [instanceId, setInstanceId] = useState('');
  const [intervalOption, setIntervalOption] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneList, setPhoneList] = useState([]);
  const [niche, setNiche] = useState('');
  const [quantity, setQuantity] = useState(50);
  const [templates, setTemplates] = useState([]);
  const [instances, setInstances] = useState([]);
  const [intervals, setIntervals] = useState([]);
  const [niches, setNiches] = useState([]);
  const [hasMedia, setHasMedia] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image');
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
    });
  }, []);

  const selectedInterval = intervals.find(i => i.label === intervalOption);
  const selectedNiche = niches.find(n => n.niche === niche);

  function toggleTemplate(id) {
    setTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function addPhone() {
    const cleaned = phoneInput.trim().replace(/\D/g, '');
    if (cleaned.length < 10) return;
    if (phoneList.includes(cleaned)) { setPhoneInput(''); return; }
    setPhoneList(prev => [...prev, cleaned]);
    setPhoneInput('');
  }

  async function handleCreate() {
    if (!name || !instanceId || !intervalOption) { setError('Preencha nome, instância e intervalo.'); return; }
    if (mode === 'phones' && phoneList.length === 0) { setError('Adicione ao menos um número.'); return; }
    if (mode === 'niche' && !niche) { setError('Selecione um nicho.'); return; }
    setSaving(true); setError(null);
    try {
      const body = {
        name,
        template_ids: templateIds,
        instance_id: instanceId,
        interval_min: selectedInterval.min,
        interval_max: selectedInterval.max,
        media_url: hasMedia && mediaUrl.trim() ? mediaUrl.trim() : null,
        media_type: mediaType,
      };
      if (mode === 'phones') body.phones = phoneList.join('\n');
      else { body.niche = niche; body.quantity = Number(quantity); }

      const res = await fetch(`${API_URL}/api/campaigns`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      navigate('/campaigns');
    } catch (err) { setError(err.message); setSaving(false); }
  }

  const sectionStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  };

  const sectionTitleStyle = {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 2,
  };

  return (
    <div className="animate-fade-in" style={{ padding: 32, maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <button
          onClick={() => navigate('/campaigns')}
          className="btn btn-ghost btn-sm"
          style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <IconArrowLeft />
          Voltar
        </button>
        <div>
          <h2 className="page-title" style={{ marginBottom: 0 }}>Nova campanha</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 2 }}>
            Preencha as informações abaixo para criar sua campanha de prospecção
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Identificação */}
        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>Identificação</p>
          <div>
            <label className="label">Nome da campanha *</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Prospecção Clínicas – Abril 2026"
            />
          </div>

          <div>
            <label className="label">Instância WhatsApp *</label>
            <select className="select" value={instanceId} onChange={e => setInstanceId(e.target.value)}>
              <option value="">Selecionar instância</option>
              {instances.map(i => <option key={i.instance_id} value={i.instance_id}>{i.name}</option>)}
            </select>
            {instances.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: 4 }}>
                Nenhuma instância conectada — vá em Configurações
              </p>
            )}
          </div>
        </div>

        {/* Templates */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ ...sectionTitleStyle, marginBottom: 0 }}>Templates de mensagem</p>
            {templateIds.length > 0 && (
              <span style={{
                fontSize: '0.75rem', fontWeight: 500,
                color: 'var(--accent)', background: 'var(--accent-dim)',
                padding: '2px 10px', borderRadius: 99,
              }}>
                {templateIds.length} selecionado{templateIds.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {templates.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', fontStyle: 'italic' }}>
              Nenhum template criado ainda — vá em Templates para criar
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {templates.map(t => {
                const selected = templateIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTemplate(t.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                      background: selected ? 'var(--accent-dim)' : 'var(--surface-2)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: selected ? 'var(--accent)' : 'var(--surface-3)',
                      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-2)'}`,
                      color: '#fff', transition: 'all 0.15s ease',
                    }}>
                      {selected && <IconCheck />}
                    </span>
                    <span style={{
                      fontSize: '0.875rem', fontWeight: selected ? 500 : 400,
                      color: selected ? 'var(--text)' : 'var(--text-2)', flex: 1,
                    }}>
                      {t.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {templateIds.length > 1 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
              O sistema escolherá um template aleatório para cada contato no shuffle
            </p>
          )}
        </div>

        {/* Intervalo */}
        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>Cadência de envio *</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {intervals.map(opt => (
              <button
                key={opt.label}
                onClick={() => setIntervalOption(opt.label)}
                style={{
                  padding: '10px', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 500,
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

        {/* Leads */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ ...sectionTitleStyle, marginBottom: 0 }}>Leads *</p>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {['niche', 'phones'].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  padding: '5px 14px', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', border: 'none',
                  background: mode === m ? 'var(--accent)' : 'var(--surface-2)',
                  color: mode === m ? '#fff' : 'var(--text-2)',
                  transition: 'all 0.15s ease',
                }}>
                  {m === 'niche' ? 'Por nicho' : 'Manual'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'niche' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">Nicho *</label>
                <select className="select" value={niche} onChange={e => setNiche(e.target.value)}>
                  <option value="">Selecionar nicho</option>
                  {niches.map(n => <option key={n.niche} value={n.niche}>{n.niche} ({n.available} disponíveis)</option>)}
                </select>
              </div>
              <div>
                <label className="label">
                  Quantidade *
                  {selectedNiche && <span style={{ color: 'var(--text-3)', marginLeft: 6, fontWeight: 400 }}>máx. {selectedNiche.available}</span>}
                </label>
                <input
                  className="input"
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  min={1}
                  max={selectedNiche?.available || 9999}
                />
              </div>
            </div>
          ) : (
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
                {phoneList.length > 0 && (
                  <span style={{ color: 'var(--accent)', marginLeft: 8 }}>
                    {phoneList.length} número{phoneList.length !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
              {phoneList.length > 0 && (
                <div style={{ marginTop: 8, maxHeight: 140, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {phoneList.map(p => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', borderRadius: 6, padding: '6px 12px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-2)' }}>{p}</span>
                      <button onClick={() => setPhoneList(prev => prev.filter(x => x !== p))} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mídia */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ ...sectionTitleStyle, marginBottom: 2 }}>Mídia (opcional)</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                Após o texto, envia uma imagem, vídeo ou outro arquivo via URL pública
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHasMedia(p => !p)}
              style={{
                width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
                background: hasMedia ? 'var(--accent)' : 'var(--surface-3)',
                position: 'relative', transition: 'background 0.2s ease', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 4, left: hasMedia ? 22 : 4,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s ease',
              }} />
            </button>
          </div>

          {hasMedia && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
              <div>
                <label className="label">Tipo de mídia</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {['image', 'video', 'audio', 'document'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMediaType(t)}
                      style={{
                        padding: '9px 6px', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 500,
                        border: `1px solid ${mediaType === t ? 'var(--accent)' : 'var(--border)'}`,
                        background: mediaType === t ? 'var(--accent-dim)' : 'var(--surface-2)',
                        color: mediaType === t ? 'var(--accent)' : 'var(--text-2)',
                        cursor: 'pointer', transition: 'all 0.15s ease',
                      }}
                    >
                      {t === 'image' ? 'Imagem' : t === 'video' ? 'Vídeo' : t === 'audio' ? 'Áudio' : 'Doc'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">URL pública da mídia</label>
                <input
                  className="input"
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  placeholder="https://exemplo.com/video.mp4"
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>
                  O link precisa ser acessível publicamente (sem login ou autenticação)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Erro e ação */}
        {error && (
          <div style={{
            padding: '10px 16px', borderRadius: 8, fontSize: '0.875rem',
            background: 'rgba(239,68,68,0.1)', color: 'var(--danger)',
            border: '1px solid rgba(239,68,68,0.2)',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingBottom: 8 }}>
          <button onClick={() => navigate('/campaigns')} className="btn btn-ghost">
            Cancelar
          </button>
          <button onClick={handleCreate} disabled={saving} className="btn btn-primary" style={{ minWidth: 140 }}>
            {saving
              ? 'Criando...'
              : mode === 'niche'
                ? `Criar campanha (${quantity} leads)`
                : `Criar campanha${phoneList.length > 0 ? ` (${phoneList.length})` : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
