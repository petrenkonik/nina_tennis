"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getPlayers, getClubs, uploadPlayerAvatar, updatePlayer, getPlayerAvatarUrl, deletePlayerAvatar, createPlayer } from 'app/lib/api';
import AdminMenu from 'components/AdminMenu';
import { useSession } from 'next-auth/react';
import PlayerAvatarEditor from './PlayerAvatarEditor';

export default function PlayersPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;
  const [players, setPlayers] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterClub, setFilterClub] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterBirthYear, setFilterBirthYear] = useState('');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ fullName: '', birthYear: '', gender: '', club: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getPlayers().then(setPlayers);
    getClubs().then(setClubs);
    setLoading(false);
  }, []);

  function filteredPlayers() {
    return players.filter(p =>
      (!search || p.fullName.toLowerCase().includes(search.toLowerCase())) &&
      (!filterClub || p.club === filterClub) &&
      (!filterGender || p.gender === filterGender) &&
      (!filterBirthYear || String(p.birthYear) === filterBirthYear)
    );
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>, playerId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(playerId);
    await uploadPlayerAvatar(playerId, file, accessToken);
    setUploadingId(null);
    getPlayers().then(setPlayers);
  }

  function startEditPlayer(player: any) {
    setEditingPlayer(player);
    setEditForm({
      fullName: player.fullName || '',
      birthYear: player.birthYear || '',
      gender: player.gender || '',
      club: player.club || '',
    });
  }

  function cancelEdit() {
    setEditingPlayer(null);
    setEditForm({});
  }

  async function saveEdit() {
    if (!editingPlayer) return;
    await updatePlayer(editingPlayer._id, editForm, accessToken);
    setEditingPlayer(null);
    setEditForm({});
    getPlayers().then(setPlayers);
  }

  async function handleCreatePlayer() {
    setCreating(true);
    await createPlayer(createForm, accessToken);
    setCreating(false);
    setShowCreateModal(false);
    setCreateForm({ fullName: '', birthYear: '', gender: '', club: '' });
    getPlayers().then(setPlayers);
  }

  return (
    <main className="max-w-5xl mx-auto py-8 px-2 pb-24">
      <AdminMenu className="hidden md:flex" />
      <h1 className="text-2xl font-extrabold mb-6">Все пользователи</h1>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          className="border rounded px-3 py-2"
          placeholder="Поиск по ФИО..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2"
          value={filterClub}
          onChange={e => setFilterClub(e.target.value)}
        >
          <option value="">Клуб</option>
          {clubs.map((club: any) => (
            <option key={club._id || club.name} value={club.name}>{club.name}</option>
          ))}
        </select>
        <select
          className="border rounded px-3 py-2"
          value={filterGender}
          onChange={e => setFilterGender(e.target.value)}
        >
          <option value="">Пол</option>
          <option value="М">М</option>
          <option value="Ж">Ж</option>
        </select>
        <input
          className="border rounded px-3 py-2"
          placeholder="Год рождения"
          value={filterBirthYear}
          onChange={e => setFilterBirthYear(e.target.value)}
          type="number"
        />
        <button
          className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded"
          onClick={() => setShowCreateModal(true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
           
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded shadow">
          <thead>
            <tr>
              <th className="p-2 border-b">Аватар</th>
              <th className="p-2 border-b">ФИО</th>
              <th className="p-2 border-b">Год рождения</th>
              <th className="p-2 border-b">Пол</th>
              <th className="p-2 border-b">Клуб</th>
              <th className="p-2 border-b">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers().map(p => (
              <tr key={p._id} className="border-b hover:bg-gray-50">
                <td className="p-2 text-center">
                  <PlayerAvatarEditor player={p} accessToken={accessToken} onAvatarChanged={() => getPlayers().then(setPlayers)} />
                </td>
                <td className="p-2">{p.fullName}</td>
                <td className="p-2">{p.birthYear}</td>
                <td className="p-2">{p.gender}</td>
                <td className="p-2">{p.club}</td>
                
                <td className="p-2">
                  <button
                    className="px-3 py-1 bg-yellow-500 text-white rounded flex items-center justify-center"
                    onClick={() => startEditPlayer(p)}
                    title="Редактировать"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6-6m2 2l-6 6m2-2l-6 6m2-2l6-6" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 3.5a2.121 2.121 0 113 3L7 19.5 3 21l1.5-4L16.5 3.5z" /></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg min-w-[320px]">
            <h2 className="text-lg font-bold mb-4">Редактировать игрока</h2>
            <div className="mb-2">
              <label className="block text-sm">ФИО</label>
              <input
                className="border rounded px-2 py-1 w-full"
                value={editForm.fullName}
                onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm">Год рождения</label>
              <input
                className="border rounded px-2 py-1 w-full"
                value={editForm.birthYear}
                onChange={e => setEditForm({ ...editForm, birthYear: e.target.value })}
                type="number"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm">Пол</label>
              <select
                className="border rounded px-2 py-1 w-full"
                value={editForm.gender}
                onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
              >
                <option value="">Выбрать</option>
                <option value="М">М</option>
                <option value="Ж">Ж</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm">Клуб</label>
              <input
                className="border rounded px-2 py-1 w-full"
                value={editForm.club}
                onChange={e => setEditForm({ ...editForm, club: e.target.value })}
                list="clubs-list"
              />
              <datalist id="clubs-list">
                {clubs.map((club: any) => (
                  <option key={club._id || club.name} value={club.name} />
                ))}
              </datalist>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-1 bg-gray-300 rounded" onClick={cancelEdit}>Отмена</button>
              <button className="px-4 py-1 bg-blue-600 text-white rounded" onClick={saveEdit}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg min-w-[340px] relative">
            <button className="absolute top-2 right-2 text-gray-500" onClick={() => setShowCreateModal(false)}>&times;</button>
            <h2 className="text-lg font-bold mb-4 text-center">Добавить игрока</h2>
            <div className="mb-2">
              <label className="block text-sm">ФИО</label>
              <input
                className="border rounded px-2 py-1 w-full"
                value={createForm.fullName}
                onChange={e => setCreateForm({ ...createForm, fullName: e.target.value })}
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm">Год рождения</label>
              <input
                className="border rounded px-2 py-1 w-full"
                value={createForm.birthYear}
                onChange={e => setCreateForm({ ...createForm, birthYear: e.target.value })}
                type="number"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm">Пол</label>
              <select
                className="border rounded px-2 py-1 w-full"
                value={createForm.gender}
                onChange={e => setCreateForm({ ...createForm, gender: e.target.value })}
              >
                <option value="">Выбрать</option>
                <option value="М">М</option>
                <option value="Ж">Ж</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm">Клуб</label>
              <input
                className="border rounded px-2 py-1 w-full"
                value={createForm.club}
                onChange={e => setCreateForm({ ...createForm, club: e.target.value })}
                list="clubs-list-create"
              />
              <datalist id="clubs-list-create">
                {clubs.map((club: any) => (
                  <option key={club._id || club.name} value={club.name} />
                ))}
              </datalist>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-1 bg-gray-300 rounded" onClick={() => setShowCreateModal(false)}>Отмена</button>
              <button className="px-4 py-1 bg-green-600 text-white rounded" onClick={handleCreatePlayer} disabled={creating}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 