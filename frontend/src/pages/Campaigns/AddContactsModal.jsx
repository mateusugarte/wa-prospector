import React, { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function AddContactsModal({ campaignId, onClose, onAdded }) {
  const [mode, setMode] = useState('phones');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneList, setPhoneList] = useState([]);
  const [niche, setNiche] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [niches, setNiches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/contacts/niches`)
      .then(r => r.json())
      .then(data => setNiches(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const selectedNiche = niches.find(n => n.niche === niche);

  function addPhone() {
    const cleaned = phoneInput.trim().replace(/\D/g, '');
    if (cleaned.length < 10) return;
    if (phoneList.includes(cleaned)) { setPhoneInput(''); return; }
    setPhoneList(prev => [...prev, cleaned]);
    setPhoneInput('');
  }

  function removePhone(phone) {
    setPhoneList(prev => prev.filter(p => p !== phone));
  }

  async function handleAdd() {
    if (mode === 'phones' && phoneList.length === 0) { setError('Adicione ao menos um número.'); return; }
    if (mode === 'niche'  && !niche)                 { setError('Selecione um nicho.'); return; }

    setSaving(true);
    setError(null);
    try {
      const body = mode === 'phones'
        ? { phones: phoneList.join('\n') }
        : { niche, quantity: Number(quantity) };

      const res = await fetch(`${API_URL}/api/campaigns/${campaignId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAdded(data.added);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Adicionar contatos</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Toggle modo */}
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button
              onClick={() => setMode('phones')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${mode === 'phones' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              Números manuais
            </button>
            <button
              onClick={() => setMode('niche')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${mode === 'niche' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              Por nicho
            </button>
          </div>

          {mode === 'phones' ? (
            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Número
                {phoneList.length > 0 && (
                  <span className="ml-2 text-green-400">{phoneList.length} adicionado{phoneList.length !== 1 ? 's' : ''}</span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPhone())}
                  placeholder="5511999999999"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-green-500"
                />
                <button
                  type="button"
                  onClick={addPhone}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-2 rounded-lg transition-colors"
                >
                  + Adicionar
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1">Com código do país (55 Brasil) · Enter para adicionar</p>
              {phoneList.length > 0 && (
                <div className="mt-2 max-h-36 overflow-y-auto space-y-1">
                  {phoneList.map(p => (
                    <div key={p} className="flex items-center justify-between bg-gray-800 rounded px-3 py-1.5">
                      <span className="font-mono text-xs text-gray-300">{p}</span>
                      <button
                        type="button"
                        onClick={() => removePhone(p)}
                        className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Nicho</label>
                <select
                  value={niche}
                  onChange={e => setNiche(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                >
                  <option value="">Selecionar nicho</option>
                  {niches.map(n => (
                    <option key={n.niche} value={n.niche}>{n.niche} ({n.available} disponíveis)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  Quantidade
                  {selectedNiche && <span className="ml-2 text-gray-500">máx. {selectedNiche.available}</span>}
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  min={1}
                  max={selectedNiche?.available || 9999}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Adicionando...' : mode === 'phones'
              ? `Adicionar${phoneList.length > 0 ? ` (${phoneList.length})` : ''}`
              : `Adicionar (${quantity})`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
