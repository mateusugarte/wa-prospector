import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_CFG = {
  draft:     { label: 'Rascunho',  bg: 'var(--surface-3)',     color: 'var(--text-3)' },
  running:   { label: 'Rodando',   bg: 'var(--accent-dim)',     color: 'var(--accent)' },
  paused:    { label: 'Pausada',   bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)' },
  completed: { label: 'Concluída', bg: 'rgba(59,130,246,0.12)', color: 'var(--info)' },
  cancelled: { label: 'Encerrada', bg: 'rgba(239,68,68,0.12)',  color: 'var(--danger)' },
};

const INTERVAL_OPTIONS = [
  { label: '2 a 4 minutos',  min: 2,  max: 4  },
  { label: '4 a 5 minutos',  min: 4,  max: 5  },
  { label: '5 a 8 minutos',  min: 5,  max: 8  },
  { label: '8 a 12 minutos', min: 8,  max: 12 },
];

function IconRefresh() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
}
function IconPlay() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
}
function IconClose() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function IconCheck() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}

// ── Wizard Modal ──────────────────────────────────────────────────────────────

function WizardModal({ onClose, onCreated }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1 — contacts
  const [allContacts, setAllContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [filterCount, setFilterCount] = useState('all');
  const [selected, setSelected] = useState(new Set());

  // Step 2 — reference messages
  const [messages, setMessages] = useState(['', '', '', '', '']);

  // Step 3 — interval + instance
  const [intervalOpt, setIntervalOpt] = useState(0);
  const [instances, setInstances] = useState([]);
  const [instanceId, setInstanceId] = useState('');

  // Prepare flow
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState(null);
  const [prepareResult, setPrepareResult] = useState(null); // { count, preview, campaignId }

  useEffect(() => {
    loadContacts();
    loadInstances();
  }, []);

  async function loadContacts() {
    setContactsLoading(true);
    const { data } = await supabase
      .from('leads')
      .select('id, name, phone, reactivation_count, last_reactivated_at')
      .order('reactivation_count', { ascending: true });
    setAllContacts(data || []);
    setContactsLoading(false);
  }

  async function loadInstances() {
    const { data } = await supabase
      .from('wa_instances')
      .select('instance_id, name, status')
      .eq('status', 'open');
    if (data?.length) {
      setInstances(data);
      setInstanceId(data[0].instance_id);
    }
  }

  const filtered = filterCount === 'all'
    ? allContacts
    : allContacts.filter(c => c.reactivation_count === Number(filterCount));

  function toggleContact(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allIds = filtered.map(c => c.id);
    const allSelected = allIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      allIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }

  const selectedContacts = allContacts.filter(c => selected.has(c.id));
  const allFilledMessages = messages.every(m => m.trim().length > 0);
  const opt = INTERVAL_OPTIONS[intervalOpt];

  async function handlePrepare() {
    if (!instanceId) return;
    setPreparing(true);
    setPrepareError(null);

    try {
      const campaignName = `Reativação ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;

      // 1. Cria a campanha
      const createRes = await fetch(`${API_URL}/api/reactivation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          instance_id: instanceId,
          contacts: selectedContacts.map(c => ({ id: c.id, phone: c.phone })),
          reference_messages: messages,
          interval_min: opt.min,
          interval_max: opt.max,
        }),
      });
      const campaignData = await createRes.json();
      if (!createRes.ok) throw new Error(campaignData.error);

      // 2. Prepara (chama IA)
      const prepRes = await fetch(`${API_URL}/api/reactivation/${campaignData.id}/prepare`, { method: 'POST' });
      const prepData = await prepRes.json();
      if (!prepRes.ok) throw new Error(prepData.error);

      setPrepareResult({ ...prepData, campaignId: campaignData.id });
    } catch (err) {
      setPrepareError(err.message);
    } finally {
      setPreparing(false);
    }
  }

  async function handleConfirmStart() {
    if (!prepareResult) return;
    setPreparing(true);
    try {
      const res = await fetch(`${API_URL}/api/reactivation/${prepareResult.campaignId}/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated();
      navigate(`/reativar/${prepareResult.campaignId}`);
    } catch (err) {
      setPrepareError(err.message);
      setPreparing(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        width: '100%', maxWidth: 720,
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Novo disparo de reativação
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3].map(n => (
                <span key={n} style={{
                  fontSize: '0.8rem', fontWeight: 600,
                  color: step === n ? 'var(--accent)' : step > n ? 'var(--text-3)' : 'var(--text-3)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: step === n ? 'var(--accent)' : step > n ? 'var(--accent-dim)' : 'var(--surface-2)',
                    color: step === n ? '#fff' : step > n ? 'var(--accent)' : 'var(--text-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700,
                    border: `1px solid ${step >= n ? 'var(--accent)' : 'var(--border)'}`,
                  }}>
                    {step > n ? <IconCheck /> : n}
                  </span>
                  {n === 1 ? 'Contatos' : n === 2 ? 'Mensagens' : 'Intervalo'}
                  {n < 3 && <span style={{ color: 'var(--border)', marginLeft: 4 }}>›</span>}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 6 }}>
            <IconClose />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── Step 1: Selecionar Contatos ── */}
          {step === 1 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>
                  Selecione os contatos para reativar.
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['all', '0', '1', '2', '3'].map(v => (
                    <button
                      key={v}
                      onClick={() => setFilterCount(v)}
                      className="btn btn-sm"
                      style={{
                        fontSize: '0.75rem',
                        background: filterCount === v ? 'var(--accent-dim)' : 'var(--surface-2)',
                        color: filterCount === v ? 'var(--accent)' : 'var(--text-3)',
                        border: `1px solid ${filterCount === v ? 'var(--accent)' : 'var(--border)'}`,
                        padding: '4px 10px',
                      }}
                    >
                      {v === 'all' ? 'Todos' : `${v}×`}
                    </button>
                  ))}
                </div>
              </div>

              {selected.size > 10 && (
                <div style={{
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 8, padding: '8px 12px', marginBottom: 12,
                  fontSize: '0.8rem', color: 'var(--warning)',
                }}>
                  ⚠️ Você selecionou {selected.size} contatos. Recomendamos no máximo 10 por disparo.
                </div>
              )}

              {contactsLoading ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: '0.875rem' }}>Carregando contatos...</div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: '0.875rem' }}>Nenhum contato encontrado.</div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>
                          <input
                            type="checkbox"
                            checked={filtered.length > 0 && filtered.every(c => selected.has(c.id))}
                            onChange={toggleAll}
                            style={{ cursor: 'pointer' }}
                          />
                        </th>
                        <th>Nome</th>
                        <th>Telefone</th>
                        <th style={{ textAlign: 'center' }}>Reativações</th>
                        <th style={{ textAlign: 'right' }}>Última vez</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(c => (
                        <tr
                          key={c.id}
                          onClick={() => toggleContact(c.id)}
                          style={{ cursor: 'pointer', background: selected.has(c.id) ? 'var(--accent-dim)' : undefined }}
                        >
                          <td onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selected.has(c.id)}
                              onChange={() => toggleContact(c.id)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
                            {c.name || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>—</span>}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-2)' }}>{c.phone}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              fontSize: '0.8rem', fontWeight: 600,
                              color: c.reactivation_count === 0 ? 'var(--text-3)' : c.reactivation_count >= 3 ? 'var(--danger)' : 'var(--warning)',
                            }}>
                              {c.reactivation_count}×
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                            {c.last_reactivated_at
                              ? new Date(c.last_reactivated_at).toLocaleDateString('pt-BR')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: 5 Mensagens de Referência ── */}
          {step === 2 && (
            <div>
              <div style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 18,
                fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.6,
              }}>
                Escreva 5 versões da sua mensagem. Mantenha o mesmo contexto e intenção em todas — a IA vai criar uma variação exclusiva para cada contato.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((msg, i) => (
                  <div key={i}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Mensagem {i + 1}
                    </label>
                    <textarea
                      value={msg}
                      onChange={e => {
                        const next = [...messages];
                        next[i] = e.target.value;
                        setMessages(next);
                      }}
                      placeholder={`Escreva a mensagem ${i + 1}…`}
                      rows={3}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'var(--surface-2)',
                        border: `1px solid ${msg.trim() ? 'var(--border-2)' : 'var(--border)'}`,
                        borderRadius: 8,
                        padding: '10px 12px',
                        fontSize: '0.875rem',
                        color: 'var(--text)',
                        resize: 'vertical',
                        outline: 'none',
                        fontFamily: 'inherit',
                        lineHeight: 1.5,
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.target.style.borderColor = msg.trim() ? 'var(--border-2)' : 'var(--border)'}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Intervalo + instância ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Intervalo entre envios
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {INTERVAL_OPTIONS.map((o, i) => (
                    <label
                      key={i}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${intervalOpt === i ? 'var(--accent)' : 'var(--border)'}`,
                        background: intervalOpt === i ? 'var(--accent-dim)' : 'var(--surface-2)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="radio"
                        name="interval"
                        checked={intervalOpt === i}
                        onChange={() => setIntervalOpt(i)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: intervalOpt === i ? 600 : 400 }}>
                        {o.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {instances.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                    Instância WhatsApp
                  </p>
                  <select
                    value={instanceId}
                    onChange={e => setInstanceId(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8,
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      color: 'var(--text)', fontSize: '0.875rem',
                      outline: 'none', cursor: 'pointer',
                    }}
                  >
                    {instances.map(inst => (
                      <option key={inst.instance_id} value={inst.instance_id}>{inst.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Preview do prepare */}
              {prepareResult && (
                <div style={{
                  background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 10, padding: 16,
                }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', marginBottom: 10 }}>
                    ✓ Mensagens geradas com sucesso — {prepareResult.count} contatos
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Prévia das primeiras mensagens
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {prepareResult.preview.map((msg, i) => (
                      <div key={i} style={{
                        background: 'var(--surface-2)', borderRadius: 8,
                        padding: '8px 12px', fontSize: '0.8125rem', color: 'var(--text-2)',
                        borderLeft: '3px solid var(--accent)',
                      }}>
                        {msg}
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 10 }}>
                    Intervalo: {opt.label} · {prepareResult.count} contatos selecionados
                  </p>
                </div>
              )}

              {prepareError && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 8, padding: '10px 14px',
                  fontSize: '0.8rem', color: 'var(--danger)',
                }}>
                  {prepareError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0, gap: 10,
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
            {step === 1 && `${selected.size} selecionado${selected.size !== 1 ? 's' : ''}`}
            {step === 2 && `${messages.filter(m => m.trim()).length}/5 mensagens preenchidas`}
            {step === 3 && !prepareResult && `${selectedContacts.length} contatos · ${opt.label}`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && !prepareResult && (
              <button className="btn btn-secondary btn-sm" onClick={() => setStep(s => s - 1)}>
                Voltar
              </button>
            )}

            {step === 1 && (
              <button
                className="btn btn-primary btn-sm"
                disabled={selected.size === 0}
                onClick={() => setStep(2)}
              >
                Próximo
              </button>
            )}

            {step === 2 && (
              <button
                className="btn btn-primary btn-sm"
                disabled={!allFilledMessages}
                onClick={() => setStep(3)}
              >
                Próximo
              </button>
            )}

            {step === 3 && !prepareResult && (
              <button
                className="btn btn-primary"
                disabled={preparing || !instanceId}
                onClick={handlePrepare}
              >
                {preparing ? 'Gerando mensagens com IA…' : 'Preparar Reativação'}
              </button>
            )}

            {step === 3 && prepareResult && (
              <button
                className="btn btn-primary"
                disabled={preparing}
                onClick={handleConfirmStart}
              >
                <IconPlay /> {preparing ? 'Iniciando…' : 'Confirmar e Iniciar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ReativarContatos() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ once: 0, twice: 0, thrice: 0 });
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  async function loadAll() {
    const [statsRes, campRes] = await Promise.all([
      fetch(`${API_URL}/api/reactivation/stats`).then(r => r.json()),
      fetch(`${API_URL}/api/reactivation`).then(r => r.json()),
    ]);
    setStats(statsRes);
    setCampaigns(Array.isArray(campRes) ? campRes : []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  return (
    <div className="animate-fade-in" style={{ padding: 32, maxWidth: 1100 }}>
      {showWizard && (
        <WizardModal
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); loadAll(); }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', margin: 0, marginBottom: 6 }}>
            Reativar Contatos
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
            Envie mensagens personalizadas via IA para reengajar contatos anteriores.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowWizard(true)}>
          <IconRefresh /> Disparar
        </button>
      </div>

      {/* Aviso */}
      <div style={{
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: 10, padding: '10px 16px', marginBottom: 24,
        fontSize: '0.8rem', color: 'var(--warning)', lineHeight: 1.6,
      }}>
        ⚠️ Recomendamos disparar para no máximo <strong>10 contatos</strong> a cada <strong>4 horas</strong> para evitar bloqueios.
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Reengajados 1×', value: stats.once,   color: 'var(--accent)' },
          { label: 'Reengajados 2×', value: stats.twice,  color: 'var(--warning)' },
          { label: 'Reengajados 3×', value: stats.thrice, color: 'var(--danger)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `${color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <IconRefresh />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 700, color, lineHeight: 1 }}>
                {loading ? '—' : value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Lista de campanhas */}
      <div className="card-lg" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
            Disparos de Reativação
          </p>
          <button
            onClick={loadAll}
            className="btn btn-ghost btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--text-3)' }}
          >
            Atualizar
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: '0.875rem' }}>
            Carregando...
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Nenhum disparo de reativação ainda.</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowWizard(true)}>
              <IconRefresh /> Criar primeiro disparo
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Enviados</th>
                  <th style={{ textAlign: 'center' }}>Falhas</th>
                  <th style={{ textAlign: 'right' }}>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const s = STATUS_CFG[c.status] ?? STATUS_CFG.draft;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/reativar/${c.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 9px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 500,
                          background: s.bg, color: s.color,
                        }}>
                          {s.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-2)' }}>{c.total_leads}</td>
                      <td style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--accent)' }}>{c.sent_count}</td>
                      <td style={{ textAlign: 'center', fontSize: '0.8125rem', color: c.failed_count > 0 ? 'var(--danger)' : 'var(--text-3)' }}>{c.failed_count}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-3)' }}>
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
    </div>
  );
}
