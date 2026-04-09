import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

function IconX() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

export default function TemplateModal({ template, onClose, onSaved }) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [content, setContent] = useState(template?.content || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (!name.trim() || !content.trim()) { setError('Nome e conteúdo são obrigatórios.'); return; }
    setSaving(true); setError(null);
    const payload = { name: name.trim(), description: description.trim() || null, content: content.trim() };
    const { error: err } = template
      ? await supabase.from('templates').update(payload).eq('id', template.id)
      : await supabase.from('templates').insert(payload);
    if (err) { setError(err.message); setSaving(false); return; }
    onSaved();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9375rem' }}>
            {template ? 'Editar template' : 'Novo template'}
          </p>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 6 }}><IconX /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Nome *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Prospecção inicial" />
          </div>
          <div>
            <label className="label">Descrição</label>
            <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <label className="label">Conteúdo *</label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 6 }}>
              Use <code style={{ background: 'var(--surface-3)', padding: '1px 5px', borderRadius: 4, color: 'var(--text-2)' }}>{'{opção1|opção2}'}</code> para variações automáticas
            </p>
            <textarea
              className="textarea"
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={6}
              style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}
              placeholder={'Olá {João|amigo|parceiro}!\n\nVi que você trabalha com {área}...\nTenho uma oportunidade que pode te interessar.'}
            />
          </div>
          {error && <p style={{ fontSize: '0.875rem', color: 'var(--danger)' }}>{error}</p>}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
