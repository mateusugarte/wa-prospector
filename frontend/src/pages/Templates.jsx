import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('templates')
        .select('id, name, description, content, created_at')
        .order('created_at', { ascending: false });
      setTemplates(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Templates</h2>
        <button className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
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
                <div className="flex gap-2">
                  <button className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                    Editar
                  </button>
                </div>
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
