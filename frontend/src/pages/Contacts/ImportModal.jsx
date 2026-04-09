import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ImportModal({ onClose, onDone }) {
  const [niche, setNiche] = useState('');
  const [searchTerms, setSearchTerms] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [maxResults, setMaxResults] = useState(100);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleImport() {
    if (!niche || !searchTerms) {
      setMsg({ type: 'error', text: 'Preencha nicho e termos de busca.' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/contacts/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, searchTerms, locationQuery, maxResults: Number(maxResults) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'ok', text: 'Importação iniciada! Os contatos aparecerão em alguns minutos.' });
      setTimeout(() => { onDone(); }, 4000);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Importar contatos via Google Maps</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Nicho *</label>
            <input
              value={niche}
              onChange={e => setNiche(e.target.value)}
              placeholder="Ex: restaurantes"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            />
            <p className="text-xs text-gray-600 mt-1">Nome para agrupar esses contatos no sistema</p>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Termos de busca * (um por linha)</label>
            <textarea
              value={searchTerms}
              onChange={e => setSearchTerms(e.target.value)}
              rows={3}
              placeholder={"restaurante\npizzaria\nchurrascaria"}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 resize-none"
            />
            <p className="text-xs text-gray-600 mt-1">O que buscar no Google Maps — use palavras-chave do negócio</p>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Localização</label>
            <input
              value={locationQuery}
              onChange={e => setLocationQuery(e.target.value)}
              placeholder="Ex: São Paulo, SP"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            />
            <p className="text-xs text-gray-600 mt-1">Cidade, estado ou região — deixe vazio para busca geral</p>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Quantidade de contatos</label>
            <input
              type="number"
              value={maxResults}
              onChange={e => setMaxResults(e.target.value)}
              min={10}
              max={1000}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            />
            <p className="text-xs text-gray-600 mt-1">Total máximo de resultados (dividido entre os termos de busca)</p>
          </div>
          {msg && (
            <p className={`text-sm ${msg.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>{msg.text}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Iniciando...' : 'Iniciar importação'}
          </button>
        </div>
      </div>
    </div>
  );
}
