import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function TemplateModal({ template, onClose, onSaved }) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [content, setContent] = useState(template?.content || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (!name.trim() || !content.trim()) {
      setError('Nome e conteúdo são obrigatórios.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      content: content.trim(),
    };
    const { error: err } = template
      ? await supabase.from('templates').update(payload).eq('id', template.id)
      : await supabase.from('templates').insert(payload);
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">{template ? 'Editar template' : 'Novo template'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Nome *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              placeholder="Ex: Prospecção inicial"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Descrição</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Conteúdo *</label>
            <p className="text-xs text-gray-600 mb-2">
              Use <span className="text-gray-500 font-mono">{'{opção1|opção2}'}</span> para variações automáticas por mensagem
            </p>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 resize-none font-mono"
              placeholder={'Olá {João|amigo|parceiro}! Vi que você trabalha com {área}...\nTenho uma oportunidade que pode te interessar.'}
            />
          </div>
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
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | template object

  async function load() {
    const { data } = await supabase
      .from('templates')
      .select('id, name, description, content, created_at')
      .order('created_at', { ascending: false });
    setTemplates(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleSaved() {
    setModal(null);
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
      {modal !== null && (
        <TemplateModal
          template={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Templates</h2>
        <button
          onClick={() => setModal('new')}
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Novo template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500 mb-2">Nenhum template criado ainda.</p>
          <p className="text-gray-600 text-sm">Templates suportam spin com sintaxe {'{opção1|opção2|opção3}'}.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-white">{t.name}</h3>
                  {t.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setModal(t)}
                  className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  Editar
                </button>
              </div>
              <pre className="text-sm text-gray-400 whitespace-pre-wrap font-sans bg-gray-800 rounded-lg p-3 mt-3">
                {t.content}
              </pre>
              <p className="text-xs text-gray-600 mt-2">
                Criado em {new Date(t.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
