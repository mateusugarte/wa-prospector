import React, { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function ImportModal({ onClose, onDone }) {
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

function ContactListModal({ niche, onClose }) {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  async function load(p = 1) {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/contacts?niche=${encodeURIComponent(niche)}&page=${p}`);
    const data = await res.json();
    setContacts(data.contacts || []);
    setTotal(data.total || 0);
    setLoading(false);
  }

  useEffect(() => { load(page); }, [page]);

  async function handleDelete(id) {
    await fetch(`${API_URL}/api/contacts/${id}`, { method: 'DELETE' });
    load(page);
  }

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h3 className="font-semibold text-white">Contatos — {niche} <span className="text-gray-500 font-normal text-sm ml-2">{total} total</span></h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="overflow-auto flex-1">
          {loading ? (
            <p className="text-gray-500 text-sm p-6">Carregando...</p>
          ) : contacts.length === 0 ? (
            <p className="text-gray-500 text-sm p-6">Nenhum contato encontrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">Telefone</th>
                  <th className="text-left px-5 py-3 font-medium">Nome</th>
                  <th className="text-center px-5 py-3 font-medium">Enviados</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                    <td className="px-5 py-2.5 font-mono text-xs text-gray-300">{c.phone}</td>
                    <td className="px-5 py-2.5 text-gray-400">{c.name || '—'}</td>
                    <td className="px-5 py-2.5 text-center">
                      <span className={c.sent_count > 0 ? 'text-green-400' : 'text-gray-600'}>{c.sent_count}</span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-xs text-red-500 hover:text-red-400 transition-colors"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800 shrink-0">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              ← Anterior
            </button>
            <span className="text-xs text-gray-600">{page} / {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Contacts() {
  const [niches, setNiches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [viewNiche, setViewNiche] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/contacts/niches`);
    const data = await res.json();
    setNiches(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDeleteNiche(niche) {
    if (!window.confirm(`Deletar todos os contatos do nicho "${niche}"?`)) return;
    setDeleting(niche);
    await fetch(`${API_URL}/api/contacts/niche/${encodeURIComponent(niche)}`, { method: 'DELETE' });
    setDeleting(null);
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
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load(); }} />
      )}
      {viewNiche && (
        <ContactListModal niche={viewNiche} onClose={() => setViewNiche(null)} />
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Contatos</h2>
        <button
          onClick={() => setShowImport(true)}
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Importar via Apify
        </button>
      </div>

      {niches.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500 mb-2">Nenhum contato importado ainda.</p>
          <p className="text-gray-600 text-sm">Clique em "Importar via Apify" para buscar leads.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left px-5 py-3 font-medium">Nicho</th>
                <th className="text-right px-5 py-3 font-medium">Total</th>
                <th className="text-right px-5 py-3 font-medium">Disponíveis</th>
                <th className="text-right px-5 py-3 font-medium">Enviados</th>
                <th className="text-right px-5 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {niches.map(n => {
                const sent = n.total - n.available;
                const pct = n.total > 0 ? Math.round((sent / n.total) * 100) : 0;
                return (
                  <tr key={n.niche} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-white capitalize">{n.niche}</p>
                      <div className="w-32 bg-gray-700 rounded-full h-1 mt-1">
                        <div className="bg-green-500 h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400">{n.total}</td>
                    <td className="px-5 py-3 text-right text-green-400">{n.available}</td>
                    <td className="px-5 py-3 text-right text-gray-500">{sent}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setViewNiche(n.niche)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Ver contatos
                        </button>
                        <button
                          onClick={() => handleDeleteNiche(n.niche)}
                          disabled={deleting === n.niche}
                          className="text-xs text-red-500 hover:text-red-400 disabled:opacity-50 transition-colors"
                        >
                          {deleting === n.niche ? '...' : 'Deletar nicho'}
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
