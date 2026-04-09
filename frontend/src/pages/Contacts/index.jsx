import React, { useEffect, useState } from 'react';
import ImportModal from './ImportModal';
import ContactListModal from './ContactListModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); load(); }}
        />
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
                const pct  = n.total > 0 ? Math.round((sent / n.total) * 100) : 0;
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
