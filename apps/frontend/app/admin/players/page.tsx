"use client";
import React, { useEffect, useState, useRef } from 'react';
import { getPlayers, getClubs } from 'app/lib/api';
import AdminMenu from 'components/AdminMenu';

export default function PlayersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterClub, setFilterClub] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterBirthYear, setFilterBirthYear] = useState('');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

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
    const formData = new FormData();
    formData.append('avatar', file);
    // TODO: заменить на реальный API для загрузки аватара
    await fetch(`/api/players/${playerId}/avatar`, {
      method: 'POST',
      body: formData,
    });
    setUploadingId(null);
    getPlayers().then(setPlayers);
  }

  return (
    <main className="max-w-5xl mx-auto py-8 px-2 pb-24">
      <AdminMenu className="hidden md:flex" />
      <h1 className="text-2xl font-extrabold mb-6">Все пользователи</h1>
      <div className="flex flex-wrap gap-2 mb-4">
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
              <th className="p-2 border-b">Загрузка аватара</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers().map(p => (
              <tr key={p._id} className="border-b hover:bg-gray-50">
                <td className="p-2 text-center">
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt="avatar" className="w-12 h-12 object-cover rounded-full mx-auto" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto flex items-center justify-center text-gray-400">?</div>
                  )}
                </td>
                <td className="p-2">{p.fullName}</td>
                <td className="p-2">{p.birthYear}</td>
                <td className="p-2">{p.gender}</td>
                <td className="p-2">{p.club}</td>
                <td className="p-2">
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={e => handleAvatarUpload(e, p._id)}
                  />
                  <button
                    className="px-3 py-1 bg-blue-600 text-white rounded"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingId === p._id}
                  >
                    {uploadingId === p._id ? 'Загрузка...' : 'Загрузить аватар'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
} 