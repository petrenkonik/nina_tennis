"use client";
import React, { useEffect, useState } from 'react';
import { getGroupById, getTournamentById, getGroupMatches, createGroup, updateGroup, deleteGroup } from 'app/lib/api';
import AdminMenu from 'components/AdminMenu';
import { generateKnockoutBracket } from '@shared/utils';
import { useParams } from 'next/navigation';
import GroupHeader from './GroupHeader';

const ROUND_OPTIONS = Array.from({ length: 8 }, (_, i) => i + 1);
const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'scheduled', label: 'Запланирован' },
  { value: 'in_progress', label: 'Идёт' },
  { value: 'finished', label: 'Завершён' },
  { value: 'canceled', label: 'Отменён' },
];

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Запланирован',
  in_progress: 'Идёт',
  finished: 'Завершён',
  canceled: 'Отменён',
};

export default function GroupBracketEditor() {
  const { groupId } = useParams() as { groupId: string };
  const [group, setGroup] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roundFilter, setRoundFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [generateRounds, setGenerateRounds] = useState(1);
  const [tournament, setTournament] = useState<any>(null);

  useEffect(() => {
    getGroupById(groupId).then(g => {
      setGroup(g);
      setPlayers(g.players || []);
      setLoading(false);
      if (g.tournamentId) {
        getTournamentById(g.tournamentId).then(setTournament);
      }
    });
    getGroupMatches(groupId).then(setMatches);
  }, [groupId]);

  async function handleGenerate() {
    if (!players.length) return;
    await fetch(`/groups/${groupId}/generate-matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // accessToken можно добавить при необходимости
    });
    getGroupMatches(groupId).then(setMatches);
  }

  function handleAddMatch() {
    setMatches([...matches, {
      _id: `m${Date.now()}`,
      player1: null,
      player2: null,
      round: 1,
      status: 'scheduled',
      scheduledAt: '',
      score: '',
      winnerId: '',
    }]);
  }

  function handleEditMatch(match: any) {
    setEditingMatch({ ...match });
  }

  function handleSaveMatch() {
    setMatches(matches.map(m => m._id === editingMatch._id ? editingMatch : m));
    setEditingMatch(null);
    // TODO: отправить на сервер
  }

  function handleDeleteMatch(id: string) {
    setMatches(matches.filter(m => m._id !== id));
    // TODO: удалить на сервере
  }

  const filteredMatches = matches.filter(m =>
    (roundFilter === '' || m.round === roundFilter) &&
    (!statusFilter || m.status === statusFilter)
  );

  if (loading) return <div>Загрузка...</div>;

  return (
    <main className="max-w-3xl mx-auto py-8 px-2 pb-24">
      <AdminMenu className="hidden md:flex" />
      <h1 className="text-2xl font-extrabold mb-2">Редактор матчей группы</h1>
      <GroupHeader tournament={tournament} group={group} />
      <div className="flex gap-2 mb-4 flex-wrap">
        <label className="flex items-center gap-2">
          Раунд:
          <select className="border rounded px-2 py-1" value={roundFilter} onChange={e => setRoundFilter(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">Все</option>
            {ROUND_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Статус:
          <select className="border rounded px-2 py-1" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </label>
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={handleGenerate}>
          Сгенерировать раунды
        </button>
        <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={handleAddMatch}>
          + Добавить матч
        </button>
      </div>
      <div className="space-y-4">
        {filteredMatches.map(m => (
          <div key={m._id} className="bg-white rounded shadow p-4 flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <span className="font-bold">Раунд {m.round}</span>
              <span className="text-xs text-gray-500">Статус: {STATUS_LABELS[m.status] || m.status}</span>
              <button className="ml-auto px-2 py-1 bg-yellow-100 text-yellow-800 rounded" onClick={() => handleEditMatch(m)}>Редактировать</button>
              <button className="px-2 py-1 bg-red-100 text-red-700 rounded" onClick={() => handleDeleteMatch(m._id)}>Удалить</button>
            </div>
            <div className="flex gap-4">
              <span>{m.player1 ? m.player1.fullName : <span className="text-gray-400">—</span>}</span>
              <span>vs</span>
              <span>{m.player2 ? m.player2.fullName : <span className="text-gray-400">—</span>}</span>
            </div>
            <div>Счёт: {m.score || <span className="text-gray-400">—</span>}</div>
            <div>Победитель: {players.find((p: any) => p._id === m.winnerId)?.fullName || <span className="text-gray-400">—</span>}</div>
            <div>Дата: {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString() : <span className="text-gray-400">—</span>}</div>
          </div>
        ))}
      </div>
      {/* Модалка редактирования матча */}
      {editingMatch && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xs flex flex-col gap-3 animate-pop-in" onSubmit={e => { e.preventDefault(); handleSaveMatch(); }}>
            <h2 className="font-semibold text-lg mb-2">Редактировать матч</h2>
            <label>Игрок 1
              <select
                className="border rounded px-2 py-1 w-full"
                value={editingMatch.player1?._id || ''}
                onChange={e => {
                  const selected = players.find((p: any) => p._id === e.target.value);
                  setEditingMatch((em: any) => {
                    // Если выбранный игрок совпадает с player2, сбрасываем player2
                    if (em.player2 && em.player2._id === selected?._id) {
                      return { ...em, player1: selected, player2: null };
                    }
                    return { ...em, player1: selected };
                  });
                }}
              >
                <option value="">—</option>
                {players.map((p: any) => <option key={p._id} value={p._id}>{p.fullName}</option>)}
              </select>
            </label>
            <label>Игрок 2
              <select
                className="border rounded px-2 py-1 w-full"
                value={editingMatch.player2?._id || ''}
                onChange={e => {
                  const selected = players.find((p: any) => p._id === e.target.value);
                  setEditingMatch((em: any) => {
                    // Если выбранный игрок совпадает с player1, сбрасываем player1
                    if (em.player1 && em.player1._id === selected?._id) {
                      return { ...em, player2: selected, player1: null };
                    }
                    return { ...em, player2: selected };
                  });
                }}
              >
                <option value="">—</option>
                {players.map((p: any) => <option key={p._id} value={p._id}>{p.fullName}</option>)}
              </select>
            </label>
            <label>Дата
              <input type="datetime-local" className="border rounded px-2 py-1 w-full" value={editingMatch.scheduledAt ? new Date(editingMatch.scheduledAt).toISOString().slice(0,16) : ''} onChange={e => setEditingMatch((em: any) => ({ ...em, scheduledAt: e.target.value }))} />
            </label>
            <label>Статус
              <select className="border rounded px-2 py-1 w-full" value={editingMatch.status} onChange={e => setEditingMatch((em: any) => ({ ...em, status: e.target.value }))}>
                <option value="scheduled">Запланирован</option>
                <option value="in_progress">Идёт</option>
                <option value="finished">Завершён</option>
                <option value="canceled">Отменён</option>
              </select>
            </label>
            <label>Счёт
              <input className="border rounded px-2 py-1 w-full" value={editingMatch.score || ''} onChange={e => setEditingMatch((em: any) => ({ ...em, score: e.target.value }))} />
            </label>
            <label>Победитель
              <select className="border rounded px-2 py-1 w-full" value={editingMatch.winnerId || ''} onChange={e => setEditingMatch((em: any) => ({ ...em, winnerId: e.target.value }))}>
                <option value="">—</option>
                {[editingMatch.player1, editingMatch.player2]
                  .filter(Boolean)
                  .map((p: any) => <option key={p._id} value={p._id}>{p.fullName}</option>)}
              </select>
            </label>
            <div className="flex gap-2 mt-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button>
              <button type="button" className="px-4 py-2 bg-gray-200 rounded" onClick={() => setEditingMatch(null)}>Отмена</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
} 