import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import TemplateModal from './TemplateModal';

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconEmpty() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
}

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  async function load() {
    const { data } = await supabase
      .from('templates')
      .select('id, name, description, content, created_at')
      .order('created_at', { ascending: false });
    setTemplates(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="animate-fade-in" style={{ padding: 32 }}>
      {modal !== null && (
        <TemplateModal
          template={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      <div className="page-header">
        <div>
          <h2 className="page-title">Templates</h2>
          {!loading && templates.length > 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 4 }}>{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setModal('new')}>
          <IconPlus /> Novo template
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div className="shimmer" style={{ height: 14, width: 160, marginBottom: 8 }} />
              <div className="shimmer" style={{ height: 11, width: 240, marginBottom: 16 }} />
              <div className="shimmer" style={{ height: 72, width: '100%' }} />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="card-lg">
          <div className="empty-state">
            <div className="empty-icon"><IconEmpty /></div>
            <p style={{ color: 'var(--text-2)', fontWeight: 500 }}>Nenhum template criado</p>
            <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
              Templates suportam spin com sintaxe <code style={{ background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 4 }}>{'{opção1|opção2}'}</code>
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {templates.map(t => (
            <div key={t.id} className="card card-hover animate-slide-up" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9375rem', marginBottom: 2 }}>{t.name}</p>
                  {t.description && <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>{t.description}</p>}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setModal(t)}>
                  <IconEdit /> Editar
                </button>
              </div>
              <div style={{
                background: 'var(--surface-2)',
                borderRadius: 8,
                padding: '12px 14px',
                fontFamily: 'monospace',
                fontSize: '0.8125rem',
                color: 'var(--text-2)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                maxHeight: 120,
                overflow: 'auto',
                border: '1px solid var(--border)',
              }}>
                {t.content}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 8 }}>
                Criado em {new Date(t.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
