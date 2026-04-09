import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import AddContactsModal from './AddContactsModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_LABELS = {
  draft:     { label: 'Rascunho',  color: 'bg-gray-700 text-gray-300' },
  running:   { label: 'Rodando',   color: 'bg-green-900 text-green-300' },
  paused:    { label: 'Pausada',   color: 'bg-yellow-900 text-yellow-300' },
  completed: { label: 'Concluída', color: 'bg-blue-900 text-blue-300' },
  cancelled: { label: 'Encerrada', color: 'bg-red-900 text-red-300' },
};

const DISPATCH_STATUS = {
  pending:   { label: 'Pendente',  color: 'text-gray-400' },
  sent:      { label: 'Enviado',   color: 'text-green-400' },
  failed:    { label: 'Falhou',    color: 'text-red-400' },
  cancelled: { label: 'Cancelado', color: 'text-gray-600' },
};

export default function CampaignDetail({ campaign, onClose, onAction }) {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(null); // { remaining, total, paused }
  const [shuffling, setShuffling] = useState(false);
  const [shuffleMsg, setShuffleMsg] = useState(null);
  const [acting, setActing] = useState(false);
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [addMsg, setAddMsg] = useState(null);
  const socketRef = useRef(null);

  async function loadDispatches() {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/campaigns/${campaign.id}/dispatches`);
    const data = await res.json();
    setDispatches(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  // Carga inicial
  useEffect(() => { loadDispatches(); }, [campaign.id]);

  // Socket.io — conecta apenas quando rodando
  useEffect(() => {
    if (campaign.status !== 'running') {
      setCountdown(null);
      return;
    }

    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('dispatch:sent', (data) => {
      if (data.campaignId !== campaign.id) return;
      setDispatches(prev => prev.map(d =>
        d.id === data.dispatchId
          ? { ...d, status: 'sent', message_sent: data.message, sent_at: new Date().toISOString() }
          : d
      ));
    });

    socket.on('dispatch:failed', (data) => {
      if (data.campaignId !== campaign.id) return;
      setDispatches(prev => prev.map(d =>
        d.id === data.dispatchId
          ? { ...d, status: 'failed', error: data.error }
          : d
      ));
    });

    socket.on('campaign:countdown', (data) => {
      if (data.campaignId !== campaign.id) return;
      setCountdown(data);
    });

    socket.on('campaign:completed', (data) => {
      if (data.campaignId !== campaign.id) return;
      setCountdown(null);
      onAction();
    });

    socket.on('campaign:paused', (data) => {
      if (data.campaignId !== campaign.id) return;
      setCountdown(null);
      onAction();
    });

    socket.on('campaign:stopped', (data) => {
      if (data.campaignId !== campaign.id) return;
      setCountdown(null);
      onAction();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [campaign.id, campaign.status]);

  async function handleShuffle() {
    setShuffling(true);
    setShuffleMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/campaigns/${campaign.id}/shuffle`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShuffleMsg({ ok: true, text: `${data.count} mensagens únicas geradas!` });
      await loadDispatches();
    } catch (err) {
      setShuffleMsg({ ok: false, text: err.message });
    } finally {
      setShuffling(false);
    }
  }

  async function handleAction(type) {
    setActing(true);
    await fetch(`${API_URL}/api/campaigns/${campaign.id}/${type}`, { method: 'POST' });
    onAction();
    setActing(false);
  }

  const pending    = dispatches.filter(d => d.status === 'pending').length;
  const sent       = dispatches.filter(d => d.status === 'sent').length;
  const failed     = dispatches.filter(d => d.status === 'failed').length;
  const isShuffled = dispatches.some(d => d.message_sent);
  const canEdit    = campaign.status === 'draft' || campaign.status === 'paused';
  const canAddContacts = campaign.status !== 'cancelled' && campaign.status !== 'completed';
  const s          = STATUS_LABELS[campaign.status] ?? STATUS_LABELS.draft;
  const progress   = dispatches.length > 0 ? Math.round(((sent + failed) / dispatches.length) * 100) : 0;

  // Tempo formatado para exibição
  const countdownPct = countdown && countdown.total > 0
    ? Math.round((countdown.remaining / countdown.total) * 100)
    : 0;

  return (
    <>
    {showAddContacts && (
      <AddContactsModal
        campaignId={campaign.id}
        onClose={() => setShowAddContacts(false)}
        onAdded={(count) => {
          setShowAddContacts(false);
          setAddMsg(`+${count} contato${count !== 1 ? 's' : ''} adicionado${count !== 1 ? 's' : ''}!`);
          setTimeout(() => setAddMsg(null), 3000);
          loadDispatches();
          onAction();
        }}
      />
    )}
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h3 className="font-semibold text-white text-lg">{campaign.name}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
              <span className="text-xs text-gray-500">{campaign.interval_min}–{campaign.interval_max} min entre envios</span>
              <span className="text-xs text-gray-500">{dispatches.length} contatos</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Barra de progresso de envios */}
        {dispatches.length > 0 && (
          <div className="px-6 py-3 border-b border-gray-800 shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>{sent} enviados · {failed} falhas · {pending} pendentes</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Countdown em tempo real */}
        {campaign.status === 'running' && countdown !== null && (
          <div className="px-6 py-3 border-b border-gray-800 shrink-0">
            {countdown.paused ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-xs text-yellow-400">Campanha pausada — aguardando retomada</span>
              </div>
            ) : countdown.remaining === 0 ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-400">Enviando mensagem...</span>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-gray-400">Próximo envio em</span>
                    <span className="text-white font-mono font-semibold tabular-nums">
                      {countdown.remaining}s
                    </span>
                  </div>
                  <span className="text-gray-600">{countdown.total}s de espera</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1">
                  <div
                    className="bg-blue-500 h-1 rounded-full transition-all duration-1000"
                    style={{ width: `${countdownPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botão Misturar mensagens */}
        {canEdit && (
          <div className="px-6 py-3 border-b border-gray-800 shrink-0 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-white font-medium">Misturar mensagens</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {isShuffled
                  ? 'Mensagens únicas já geradas — você pode misturar novamente'
                  : 'Gera uma mensagem única e delay de digitação para cada contato'}
              </p>
            </div>
            <button
              onClick={handleShuffle}
              disabled={shuffling || !campaign.template_id}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                isShuffled ? 'bg-purple-700 hover:bg-purple-600 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {shuffling ? 'Gerando...' : isShuffled ? '🔀 Misturar novamente' : '🔀 Misturar mensagens'}
            </button>
            {!campaign.template_id && <p className="text-xs text-yellow-500">Sem template</p>}
            {shuffleMsg && (
              <p className={`text-xs ${shuffleMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{shuffleMsg.text}</p>
            )}
          </div>
        )}

        {/* Tabela de dispatches */}
        <div className="overflow-auto flex-1">
          {loading ? (
            <p className="text-gray-500 text-sm p-6">Carregando...</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">Telefone</th>
                  <th className="text-left px-5 py-3 font-medium">Mensagem</th>
                  <th className="text-center px-4 py-3 font-medium">Delay</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map(d => {
                  const ds = DISPATCH_STATUS[d.status] ?? DISPATCH_STATUS.pending;
                  const isLive = campaign.status === 'running' && d.status === 'pending';
                  return (
                    <tr
                      key={d.id}
                      className={`border-b border-gray-800 last:border-0 transition-colors ${
                        d.status === 'sent'   ? 'bg-green-950/20' :
                        d.status === 'failed' ? 'bg-red-950/20' :
                        'hover:bg-gray-800/40'
                      }`}
                    >
                      <td className="px-5 py-2.5 font-mono text-xs text-gray-300 whitespace-nowrap">
                        {d.phone}
                        {isLive && (
                          <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse align-middle" />
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-gray-400 max-w-xs">
                        {d.message_sent
                          ? <span className="text-xs">{d.message_sent.slice(0, 80)}{d.message_sent.length > 80 ? '…' : ''}</span>
                          : <span className="text-xs text-gray-600 italic">Não gerada</span>
                        }
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs text-gray-500 whitespace-nowrap">
                        {d.typing_delay ? `${d.typing_delay}ms` : <span className="text-gray-600">—</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-center text-xs font-medium ${ds.color}`}>{ds.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            {canAddContacts && (
              <button
                onClick={() => setShowAddContacts(true)}
                className="text-sm text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 px-3 py-2 rounded-lg transition-colors"
              >
                + Adicionar contatos
              </button>
            )}
            {addMsg && <span className="text-xs text-green-400">{addMsg}</span>}
          </div>

          <div className="flex items-center gap-2">
            {(campaign.status === 'draft' || campaign.status === 'paused') && (
              <button
                onClick={() => handleAction('start')}
                disabled={acting}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {acting ? '...' : '▶ Iniciar campanha'}
              </button>
            )}
            {campaign.status === 'running' && (
              <button
                onClick={() => handleAction('pause')}
                disabled={acting}
                className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {acting ? '...' : '⏸ Pausar'}
              </button>
            )}
            {(campaign.status === 'running' || campaign.status === 'paused') && (
              <button
                onClick={() => handleAction('stop')}
                disabled={acting}
                className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                ■ Encerrar
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
    </>
  );
}
