"use client";
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getGroupById, getPlayers, getPlayerById, updateGroup, createPlayer, getClubs, getTournaments } from 'app/lib/api';
import AdminMenu from 'components/AdminMenu';

export default function GroupUsersEditorPage() {
  const { groupId: rawGroupId } = useParams();
  const groupId = Array.isArray(rawGroupId) ? rawGroupId[0] : rawGroupId;
  const { data: session } = useSession();
  const accessToken = session?.accessToken;
  const router = useRouter();

  const [group, setGroup] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addPlayerId, setAddPlayerId] = useState('');
  const [showNewPlayerForm, setShowNewPlayerForm] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ fullName: '', gender: '', birthYear: '', club: '' });
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [seedEdit, setSeedEdit] = useState<{ playerId: string; seed: number } | null>(null);
  const [clubs, setClubs] = useState<any[]>([]);
  const [tournament, setTournament] = useState<any>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const group = await getGroupById(groupId);
      const allPlayers = await getPlayers();
      setGroup(group);
      setPlayers(allPlayers);
      setError('');
    } catch {
      setError('Ошибка загрузки данных');
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // Получаем турнир, в котором есть эта группа
    getTournaments().then(all => {
      const found = all.find((t: any) => (t.groups || []).some((g: any) => (g._id || g) === groupId));
      setTournament(found || null);
    });
  }, [groupId]);
  useEffect(() => { getClubs().then(setClubs); }, []);

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!addPlayerId) return;
    const updated = { ...group, players: [...(group.players || []), addPlayerId] };
    await updateGroup(groupId, updated, accessToken);
    setAddPlayerId('');
    fetchData();
  }

  async function handleRemovePlayer(playerId: string) {
    if (!confirm('Удалить пользователя из группы?')) return;
    const updated = { ...group, players: (group.players || []).filter((p: any) => (typeof p === 'string' ? p : p._id) !== playerId) };
    await updateGroup(groupId, updated, accessToken);
    fetchData();
  }

  async function handleCreatePlayer(e: React.FormEvent) {
    e.preventDefault();
    const created = await createPlayer(newPlayer, accessToken);
    const updated = { ...group, players: [...(group.players || []), created._id] };
    await updateGroup(groupId, updated, accessToken);
    setShowNewPlayerForm(false);
    setNewPlayer({ fullName: '', gender: '', birthYear: '', club: '' });
    fetchData();
  }

  return (
    <main className="max-w-xl mx-auto py-8 px-2 pb-24">
      <AdminMenu className="hidden md:flex" />
      <h1 className="text-2xl font-extrabold mb-6">
        Пользователи группы
        {tournament && group && (
          <span className="block text-base font-normal mt-1 text-gray-600">
            Турнир: {tournament.name} / Группа: {group.name}
          </span>
        )}
      </h1>
      <button onClick={() => router.back()} className="mb-4 px-4 py-2 bg-gray-200 rounded">Назад</button>
      {loading && <div>Загрузка...</div>}
      {error && <div className="text-red-500">{error}</div>}
      {group && (
        <>
          <button onClick={() => setShowNewPlayerForm(v => !v)} className="mb-4 px-4 py-2 bg-green-600 text-white rounded">
            {showNewPlayerForm ? 'Отмена' : 'Создать нового пользователя'}
          </button>
          <form onSubmit={handleAddPlayer} className="flex gap-2 mb-4 items-center">
          <div className="flex-1 relative">
          <div className="mb-4">
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="Поиск пользователя..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          autoComplete="off"
        />
      </div>
      <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Добавить</button>
      {searchFocused && search && (
                <div className="absolute z-10 bg-white border rounded w-full max-h-40 overflow-y-auto mt-1">
                  {players
                    .filter(pl =>
                      !(group.players || []).some((p: any) => (typeof p === 'string' ? p : p._id) === pl._id) &&
                      pl.fullName.toLowerCase().includes(search.toLowerCase())
                    )
                    .slice(0, 10)
                    .map(pl => (
                      <div
                        key={pl._id}
                        className={`px-3 py-2 cursor-pointer hover:bg-blue-100 ${addPlayerId === pl._id ? 'bg-blue-50' : ''}`}
                        onMouseDown={() => { setAddPlayerId(pl._id); setSearch(pl.fullName); setSearchFocused(false); }}
                      >
                        {pl.fullName} <span className="text-xs text-gray-500">{pl.birthYear} {pl.gender} {pl.club}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </form>

          {showNewPlayerForm && (
            <form onSubmit={handleCreatePlayer} className="bg-white rounded shadow p-4 mb-4">
              <input
                className="border rounded px-3 py-2 mb-2 w-full"
                placeholder="ФИО"
                value={newPlayer.fullName}
                onChange={e => setNewPlayer(f => ({ ...f, fullName: e.target.value }))}
                required
              />
              <input
                className="border rounded px-3 py-2 mb-2 w-full"
                placeholder="Год рождения"
                type="number"
                value={newPlayer.birthYear}
                onChange={e => setNewPlayer(f => ({ ...f, birthYear: e.target.value }))}
                required
              />
              <div className="mb-2">
                <select
                  className="border rounded px-3 py-2 w-full mb-1"
                  value={newPlayer.club || ''}
                  onChange={e => setNewPlayer(f => ({ ...f, club: e.target.value }))}
                >
                  <option value="">Выбрать клуб...</option>
                  {clubs.map((club: any) => (
                    <option key={club._id || club.name} value={club.name}>{club.name}</option>
                  ))}
                </select>
                <input
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Или введите свой клуб..."
                  value={newPlayer.club || ''}
                  onChange={e => setNewPlayer(f => ({ ...f, club: e.target.value }))}
                  list="clubs-list"
                />
                <datalist id="clubs-list">
                  {clubs.map((club: any) => (
                    <option key={club._id || club.name} value={club.name} />
                  ))}
                </datalist>
              </div>
              <select
                className="border rounded px-3 py-2 mb-2 w-full"
                value={newPlayer.gender}
                onChange={e => setNewPlayer(f => ({ ...f, gender: e.target.value }))}
                required
              >
                <option value="">Пол</option>
                <option value="М">М</option>
                <option value="Ж">Ж</option>
              </select>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Создать и добавить</button>
            </form>
          )}
          <h2 className="font-semibold mb-2">В группе:</h2>
          <ul className="mb-6">
            {(() => {
              const seeded = (group.seededPlayers || [])
                .map((s: any) => {
                  const player = (group.players || []).find((p: any) => (typeof p === 'string' ? p : p._id) === (s.player?._id || s.player));
                  return player ? { player, seed: s.seed } : null;
                })
                .filter(Boolean)
                .sort((a: any, b: any) => a.seed - b.seed);
              const seededIds = seeded.map((s: any) => s.player._id);
              const rest = (group.players || [])
                .filter((p: any) => !seededIds.includes(typeof p === 'string' ? p : p._id))
                .map((p: any) => ({ player: typeof p === 'string' ? players.find(pl => pl._id === p) : p }));
              return [
                ...seeded.map(({ player, seed }: any) => ({ player, seed })),
                ...rest.map(({ player }) => ({ player, seed: null })),
              ];
            })().map(({ player, seed }) => {
              if (!player) return null;
              const seedObj = seed ? { seed } : (group.seededPlayers || []).find((s: any) => (s.player?._id || s.player) === player._id);
              return (
                <li key={player._id} className="flex items-center gap-2 mb-2 bg-white rounded p-2 shadow">
                  <span>{player.fullName}</span>
                  <span className="text-xs text-gray-500">{player.birthYear}</span>
                  <span className="text-xs text-gray-500">{player.gender}</span>
                  <span className="text-xs text-gray-500">{player.club}</span>
                  {seedEdit && seedEdit.playerId === player._id ? (
                    <>
                      <input
                        type="number"
                        min={1}
                        className="border rounded px-2 py-1 w-16 text-xs"
                        value={seedEdit.seed}
                        onChange={e => setSeedEdit({ ...seedEdit, seed: Number(e.target.value) })}
                      />
                      <button
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                        onClick={async () => {
                          const others = (group.seededPlayers || []).filter((s: any) => (s.player?._id || s.player) !== player._id);
                          const updated = { ...group, seededPlayers: [...others, { player: player._id, seed: seedEdit.seed }] };
                          await updateGroup(groupId, updated, accessToken);
                          setSeedEdit(null);
                          fetchData();
                        }}
                      >Сохранить</button>
                      <button className="px-2 py-1 bg-gray-200 rounded text-xs" onClick={() => setSeedEdit(null)}>Отмена</button>
                    </>
                  ) : seedObj ? (
                    <>
                      <span className="text-xs bg-yellow-100 text-yellow-800 rounded px-2 py-1">Посев: {seedObj.seed}</span>
                      <button
                        className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs"
                        onClick={() => setSeedEdit({ playerId: player._id, seed: seedObj.seed })}
                      >Изм.</button>
                      <button
                        className="px-2 py-1 bg-gray-200 text-xs rounded"
                        onClick={async () => {
                          const updated = { ...group, seededPlayers: (group.seededPlayers || []).filter((s: any) => (s.player?._id || s.player) !== player._id) };
                          await updateGroup(groupId, updated, accessToken);
                          fetchData();
                        }}
                      >Убрать</button>
                    </>
                  ) : (
                    <button
                      className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs"
                      onClick={async () => {
                        const updated = { ...group, seededPlayers: [...(group.seededPlayers || []), { player: player._id, seed: 1 }] };
                        await updateGroup(groupId, updated, accessToken);
                        fetchData();
                      }}
                    >Сделать посеянным</button>
                  )}
                  <button onClick={() => handleRemovePlayer(player._id)} className="ml-auto px-2 py-1 bg-red-100 text-red-700 rounded">Удалить</button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
} 