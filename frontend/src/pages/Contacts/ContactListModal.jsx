import React, { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ContactListModal({ niche, onClose }) {
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
          <h3 className="font-semibold text-white">
            Contatos — {niche}
            <span className="text-gray-500 font-normal text-sm ml-2">{total} total</span>
          </h3>
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
