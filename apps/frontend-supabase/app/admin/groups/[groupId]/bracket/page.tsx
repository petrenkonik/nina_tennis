"use client";
import React, { useEffect, useState } from 'react';
import { getGroupById, getTournamentById, getGroupMatches, addMatch, updateMatch, deleteMatch, generateMatches, advanceWinners, getGroupStandings } from 'app/lib/client';
import AdminMenu from 'components/AdminMenu';
import { useParams } from 'next/navigation';
import GroupHeader from './GroupHeader';
import Link from 'next/link';
import { FaTrash } from 'react-icons/fa';

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

/**
 * Форматирует дату в значение для <input type="datetime-local"> в ЛОКАЛЬНОМ
 * часовом поясе пользователя (формат YYYY-MM-DDTHH:mm без суффикса зоны).
 * toISOString() здесь НЕ подходит — он отдаёт UTC (суффикс Z), и пользователь
 * видит гринвичское время вместо своего.
 */
function toLocalDateTimeInput(date: any): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function GroupBracketEditor() {
  const { groupId } = useParams() as { groupId: string };
      const [group, setGroup] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [pairs, setPairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [roundFilter, setRoundFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tournament, setTournament] = useState<any>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [newMatchRound, setNewMatchRound] = useState<number>(1);

  useEffect(() => {
    getGroupById(groupId).then(g => {
      setGroup(g);
      setPlayers(g.players || []);
      setPairs(g.pairs || []);
      setLoading(false);
      if (g.tournamentId) {
        getTournamentById(g.tournamentId).then(setTournament);
      }
    });
    getGroupMatches(groupId).then(setMatches);
    // Для круговой — подгрузить турнирную таблицу.
    getGroupById(groupId).then(g => {
      if (g?.system === 'round_robin') {
        getGroupStandings(groupId).then(setStandings).catch(() => setStandings([]));
      }
    });
  }, [groupId]);

  async function refreshMatches() {
    const fresh = await getGroupMatches(groupId);
    setMatches(fresh);
    if (group?.system === 'round_robin') {
      getGroupStandings(groupId).then(setStandings).catch(() => setStandings([]));
    }
  }

  async function handleGenerate() {
    if (!players.length) return;
    setSaving(true); setError('');
    try {
      await generateMatches(groupId);
      await refreshMatches();
    } catch (e: any) {
      setError(e.message || 'Ошибка генерации');
    } finally {
      setSaving(false);
    }
  }

  // Перенос победителей завершённых матчей в слоты следующего раунда (elimination).
  // Идемпотентно: повторный клик переcчитывает из текущих победителей.
  async function handleAdvance() {
    setSaving(true); setError('');
    try {
      await advanceWinners(groupId);
      await refreshMatches();
    } catch (e: any) {
      setError(e.message || 'Ошибка заполнения победителями');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMatch() {
    setSaving(true); setError('');
    try {
      const created = await addMatch(groupId, {
        player1: null,
        player2: null,
        round: newMatchRound,
        status: 'scheduled',
        court: '',
        score: '',
      });
      setMatches([...matches, created]);
    } catch (e: any) {
      setError(e.message || 'Ошибка добавления матча');
    } finally {
      setSaving(false);
    }
  }

  function handleEditMatch(match: any) {
    setEditingMatch({ ...match });
  }

  async function handleSaveMatch() {
    if (!editingMatch) return;
    setSaving(true); setError('');
    try {
      const isDoubles = group?.format === 'doubles';
      // Нормализуем игроков к id для бэка.
      // Парный режим: player1/player3 — капитан+партнёр стороны 1, player2/player4 — стороны 2.
      // Капитан — это a пары, партнёр — b (см. getGroupPairs).
      const payload: any = {
        player1Id: editingMatch.player1?._id || null,
        player2Id: editingMatch.player2?._id || null,
        round: editingMatch.round ?? 1,
        status: editingMatch.status,
        court: editingMatch.court || '',
        score: editingMatch.score || '',
        winnerId: editingMatch.winnerId || null,
        // feeder-связки: выбор «Победитель матча #N» (id источника) или null (сброс).
        p1FeedsFrom: editingMatch.p1FeedsFrom || null,
        p2FeedsFrom: editingMatch.p2FeedsFrom || null,
        // scheduledAt из инпута приходит как локальная строка "YYYY-MM-DDTHH:mm"
        // (без зоны). new Date() трактует её как локальное время — то, что нужно.
        scheduledAt: editingMatch.scheduledAt ? new Date(editingMatch.scheduledAt).toISOString() : null,
      };
      if (isDoubles) {
        payload.player3Id = editingMatch.player3?._id || null;
        payload.player4Id = editingMatch.player4?._id || null;
      }
      const updated = await updateMatch(groupId, editingMatch._id, payload);
      setMatches(matches.map(m => String(m._id) === String(editingMatch._id) ? { ...m, ...updated, player1: editingMatch.player1, player2: editingMatch.player2 } : m));
      setEditingMatch(null);
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения матча');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMatch(id: string) {
    setSaving(true); setError('');
    try {
      await deleteMatch(groupId, id);
      setMatches(matches.filter(m => String(m._id) !== String(id)));
    } catch (e: any) {
      setError(e.message || 'Ошибка удаления матча');
    } finally {
      setSaving(false);
    }
  }

  const filteredMatches = matches.filter(m =>
    (roundFilter === '' || m.round === roundFilter) &&
    (!statusFilter || m.status === statusFilter)
  );

  // Подпись матча-источника для дропдауна feeder'а:
  // «#15 · Андреева / Киносян» (имена сторон; для doubles — капитаны пар).
  function sourceLabel(m: any): string {
    const a = m.player1?.fullName || (m.p1FeedsFrom ? `#${m.p1FeedsFrom}` : '?');
    const b = m.player2?.fullName || (m.p2FeedsFrom ? `#${m.p2FeedsFrom}` : '');
    const sides = b ? `${a} / ${b}` : a;
    return `#${m._id} · ${sides}`;
  }

  // Доступные матчи-источники для feeder'а: все обычные матчи из более ранних
  // раундов (не сам редактируемый матч). Победитель источника попадёт в сторону.
  const sourceMatches = editingMatch
    ? matches.filter((m: any) =>
        m.matchKind !== 'third_place' &&
        String(m._id) !== String(editingMatch._id) &&
        (m.round || 1) < (editingMatch.round || 1))
    : [];

  if (loading) return <div>Загрузка...</div>;

  return (
    <main className="max-w-3xl mx-auto py-8 px-2 pb-24">
      <AdminMenu className="hidden md:flex" />
      <h1 className="text-2xl font-extrabold mb-2">Редактор матчей группы</h1>
      <GroupHeader tournament={tournament} group={group} />
      {error && <div className="bg-red-100 text-red-700 px-3 py-2 rounded mb-4 text-sm">{error}</div>}
      {saving && <div className="text-blue-600 text-sm mb-2">Сохранение…</div>}
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
          {group?.system === 'round_robin' ? 'Сгенерировать матчи (круговая)' : 'Сгенерировать сетку'}
        </button>
        {group?.system !== 'round_robin' && (
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded"
            onClick={handleAdvance}
            title="Перенести победителей завершённых матчей в следующий раунд"
          >
            ↪ Заполнить победителями
          </button>
        )}
        <label className="flex items-center gap-2 text-sm">
          Раунд:
          <select
            className="border rounded px-2 py-1"
            value={newMatchRound}
            onChange={e => setNewMatchRound(Number(e.target.value))}
          >
            {ROUND_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={handleAddMatch}>
          + Добавить матч
        </button>
      </div>
      {group?.system === 'round_robin' && standings.length > 0 && (
        <div className="mb-6 bg-white rounded shadow p-4 overflow-x-auto">
          <h2 className="font-bold mb-3">Турнирная таблица</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Игрок</th>
                <th className="py-1 pr-2 text-center">И</th>
                <th className="py-1 pr-2 text-center">В</th>
                <th className="py-1 pr-2 text-center">П</th>
                <th className="py-1 pr-2 text-center">Сеты</th>
                <th className="py-1 pr-2 text-center">Геймы</th>
                <th className="py-1 text-center">Очки</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s: any) => (
                <tr key={s.unitId} className="border-b last:border-0">
                  <td className="py-1 pr-2 font-bold">{s.position}</td>
                  <td className="py-1 pr-2">
                    {s.player?.fullName}
                    {s.partner && <span className="text-gray-500"> / {s.partner.fullName}</span>}
                  </td>
                  <td className="py-1 pr-2 text-center">{s.matchesPlayed}</td>
                  <td className="py-1 pr-2 text-center">{s.wins}</td>
                  <td className="py-1 pr-2 text-center">{s.losses}</td>
                  <td className="py-1 pr-2 text-center">{s.setsWon}:{s.setsLost}</td>
                  <td className="py-1 pr-2 text-center">{s.gamesWon}:{s.gamesLost}</td>
                  <td className="py-1 text-center font-bold">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="space-y-4">
        {filteredMatches.map(m => (
          <div key={m._id} className="bg-white rounded shadow p-4 flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <span className="font-bold">
                {m.matchKind === 'third_place' ? 'Матч за 3-е место' : `Раунд ${m.round}`}
              </span>
              <span className="text-xs text-gray-500">Статус: {STATUS_LABELS[m.status] || m.status}</span>
              {m.player1 && m.player2 && (
                <Link
                  href={`/admin/groups/${groupId}/matches/${m._id}/judge`}
                  className="ml-auto px-2 py-1 bg-emerald-100 text-emerald-800 rounded"
                >
                  Судить
                </Link>
              )}
              <button className={`px-2 py-1 bg-yellow-100 text-yellow-800 rounded ${m.player1 && m.player2 ? '' : 'ml-auto'}`} onClick={() => handleEditMatch(m)}>Редактировать</button>
              <button
                className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center justify-center"
                onClick={() => handleDeleteMatch(m._id)}
                title="Удалить матч"
                aria-label="Удалить матч"
              >
                <FaTrash />
              </button>
            </div>
            <div className="flex gap-4">
              <span>
                {m.player1 ? m.player1.fullName
                  : m.p1FeedsFrom ? <span className="text-indigo-600 italic">↪ Победитель матча #{m.p1FeedsFrom}</span>
                  : <span className="text-gray-400">—</span>}
                {m.player3 && <span className="text-gray-500"> / {m.player3.fullName}</span>}
              </span>
              <span>vs</span>
              <span>
                {m.player2 ? m.player2.fullName
                  : m.p2FeedsFrom ? <span className="text-indigo-600 italic">↪ Победитель матча #{m.p2FeedsFrom}</span>
                  : <span className="text-gray-400">—</span>}
                {m.player4 && <span className="text-gray-500"> / {m.player4.fullName}</span>}
              </span>
            </div>
            <div>Счёт: {m.score || <span className="text-gray-400">—</span>}</div>
            <div>Победитель: {players.find((p: any) => p._id === m.winnerId)?.fullName || <span className="text-gray-400">—</span>}</div>
            <div>Дата: {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString('ru-RU', { hour12: false }) : <span className="text-gray-400">—</span>}</div>
          </div>
        ))}
      </div>
      {/* Модалка редактирования матча */}
      {editingMatch && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xs flex flex-col gap-3 animate-pop-in" onSubmit={e => { e.preventDefault(); handleSaveMatch(); }}>
            <h2 className="font-semibold text-lg mb-2">Редактировать матч</h2>
            {group?.format === 'doubles' ? (
              <>
                <label>Команда 1
                  <select
                    className="border rounded px-2 py-1 w-full"
                    value={editingMatch.player1?._id || ''}
                    onChange={e => {
                      const pair = pairs.find((p: any) => String(p.a._id) === e.target.value);
                      setEditingMatch((em: any) => {
                        // Если выбранная пара совпадает с командой 2 — сбрасываем её.
                        if (em.player2 && em.player2._id === pair?.a?._id) {
                          return { ...em, player1: pair?.a || null, player3: pair?.b || null, player2: null, player4: null };
                        }
                        return { ...em, player1: pair?.a || null, player3: pair?.b || null };
                      });
                    }}
                  >
                    <option value="">—</option>
                    {pairs.map((p: any) => <option key={p.a._id} value={p.a._id}>{p.a.fullName} / {p.b.fullName}</option>)}
                  </select>
                </label>
                <label>Команда 2
                  <select
                    className="border rounded px-2 py-1 w-full"
                    value={editingMatch.player2?._id || ''}
                    onChange={e => {
                      const pair = pairs.find((p: any) => String(p.a._id) === e.target.value);
                      setEditingMatch((em: any) => {
                        if (em.player1 && em.player1._id === pair?.a?._id) {
                          return { ...em, player2: pair?.a || null, player4: pair?.b || null, player1: null, player3: null };
                        }
                        return { ...em, player2: pair?.a || null, player4: pair?.b || null };
                      });
                    }}
                  >
                    <option value="">—</option>
                    {pairs.map((p: any) => <option key={p.a._id} value={p.a._id}>{p.a.fullName} / {p.b.fullName}</option>)}
                  </select>
                </label>
                <label className="text-xs text-indigo-600">Сторона 1: победитель матча
                  <select
                    className="border rounded px-2 py-1 w-full text-sm"
                    value={editingMatch.p1FeedsFrom || ''}
                    onChange={e => setEditingMatch((em: any) => ({
                      ...em,
                      p1FeedsFrom: e.target.value || null,
                      // выбор feeder'а обнуляет явного игрока (сторона ждёт победителя)
                      player1: null, player3: null,
                    }))}
                  >
                    <option value="">— выбрать команду вручную —</option>
                    {sourceMatches.map((m: any) => <option key={m._id} value={m._id}>{sourceLabel(m)}</option>)}
                  </select>
                </label>
                <label className="text-xs text-indigo-600">Сторона 2: победитель матча
                  <select
                    className="border rounded px-2 py-1 w-full text-sm"
                    value={editingMatch.p2FeedsFrom || ''}
                    onChange={e => setEditingMatch((em: any) => ({
                      ...em,
                      p2FeedsFrom: e.target.value || null,
                      player2: null, player4: null,
                    }))}
                  >
                    <option value="">— выбрать команду вручную —</option>
                    {sourceMatches.map((m: any) => <option key={m._id} value={m._id}>{sourceLabel(m)}</option>)}
                  </select>
                </label>
              </>
            ) : (
              <>
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
                <label className="text-xs text-indigo-600">Сторона 1: победитель матча
                  <select
                    className="border rounded px-2 py-1 w-full text-sm"
                    value={editingMatch.p1FeedsFrom || ''}
                    onChange={e => setEditingMatch((em: any) => ({
                      ...em,
                      p1FeedsFrom: e.target.value || null,
                      player1: null,
                    }))}
                  >
                    <option value="">— выбрать игрока вручную —</option>
                    {sourceMatches.map((m: any) => <option key={m._id} value={m._id}>{sourceLabel(m)}</option>)}
                  </select>
                </label>
                <label className="text-xs text-indigo-600">Сторона 2: победитель матча
                  <select
                    className="border rounded px-2 py-1 w-full text-sm"
                    value={editingMatch.p2FeedsFrom || ''}
                    onChange={e => setEditingMatch((em: any) => ({
                      ...em,
                      p2FeedsFrom: e.target.value || null,
                      player2: null,
                    }))}
                  >
                    <option value="">— выбрать игрока вручную —</option>
                    {sourceMatches.map((m: any) => <option key={m._id} value={m._id}>{sourceLabel(m)}</option>)}
                  </select>
                </label>
              </>
            )}
            <label>Дата
              <input type="datetime-local" className="border rounded px-2 py-1 w-full" value={toLocalDateTimeInput(editingMatch.scheduledAt)} onChange={e => setEditingMatch((em: any) => ({ ...em, scheduledAt: e.target.value }))} />
            </label>
            <label>Корт
              <input type="text" placeholder="Напр. Корт 1" className="border rounded px-2 py-1 w-full" value={editingMatch.court || ''} onChange={e => setEditingMatch((em: any) => ({ ...em, court: e.target.value }))} />
            </label>
            <label>Раунд
              <select className="border rounded px-2 py-1 w-full" value={editingMatch.round ?? 1} onChange={e => setEditingMatch((em: any) => ({ ...em, round: Number(e.target.value) }))}>
                {ROUND_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
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
                  .map((p: any) => {
                    const partner = p._id === editingMatch.player1?._id ? editingMatch.player3 : editingMatch.player4;
                    const label = partner ? `${p.fullName} / ${partner.fullName}` : p.fullName;
                    return <option key={p._id} value={p._id}>{label}</option>;
                  })}
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