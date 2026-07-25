"use client";
import React, { useEffect, useState } from 'react';
import { getGroups, createGroup, getTournaments, updateGroup, deleteGroup, getTournamentById } from 'app/lib/api';
import { useParams, useRouter } from 'next/navigation';
import AdminMenu from 'components/AdminMenu';
import { Group } from '@shared/models/group';
import { formatDate } from '@shared/utils';

export default function GroupsEditorPage() {
  const { id: rawId } = useParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '' });
  const [tournaments, setTournaments] = useState<any[]>([]);
  const router = useRouter();
      const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '' });

  useEffect(() => {
    // Получаем турниры для комбобокса
    getTournaments().then(all => {
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      setTournaments(
        all.filter((t: any) => {
          const end = new Date(t.endDate);
          return end > twoWeeksAgo;
        })
      );
    });
  }, []);

  async function fetchGroups() {
    setLoading(true);
    try {
      const tournament = await getTournamentById(id);
      // tournament.groups — массив объектов групп
      setGroups(tournament.groups || []);
      setError('');
    } catch {
      setError('Ошибка загрузки групп');
    }
    setLoading(false);
  }

  useEffect(() => { fetchGroups(); }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createGroup({ ...form, tournamentId: id });
    setShowForm(false);
    fetchGroups();
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editGroupId) return;
    await updateGroup(editGroupId, editForm);
    setEditGroupId(null);
    setEditForm({ name: '' });
    fetchGroups();
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm('Удалить группу?')) return;
    await deleteGroup(id);
    fetchGroups();
  }

  return (
    <main className="max-w-xl mx-auto py-8 px-2 pb-24">
      <AdminMenu className="hidden md:flex" />
      <h1 className="text-2xl font-extrabold mb-6">Группы турнира</h1>
      {/* Комбобокс выбора турнира */}
      <div className="mb-6">
        <label className="block mb-1 font-semibold">Выбрать турнир:</label>
        <select
          className="border rounded px-3 py-2 w-full max-w-xs"
          value={id}
          onChange={e => router.push(`/admin/tournaments/${e.target.value}/groups`)}
        >
          {tournaments.map(t => (
            <option key={t._id} value={t._id}>{t.name} ({formatDate(t.startDate)} — {formatDate(t.endDate)})</option>
          ))}
        </select>
      </div>
      <button onClick={() => setShowForm(true)} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded">Добавить группу</button>
      {loading && <div>Загрузка...</div>}
      {error && <div className="text-red-500">{error}</div>}
      <ul className="mb-8">
        {groups.map(g => (
          <li key={g._id} className="mb-2 p-3 bg-white rounded shadow flex items-center justify-between">
            {editGroupId === g._id ? (
              <form onSubmit={handleEditSubmit} className="flex gap-2 w-full">
                <input
                  className="border rounded px-2 py-1 flex-1"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
                <button type="submit" className="px-2 py-1 bg-blue-600 text-white rounded">Сохранить</button>
                <button type="button" onClick={() => setEditGroupId(null)} className="px-2 py-1 bg-gray-200 rounded">Отмена</button>
              </form>
            ) : (
              <>
                <span>{g.name}</span>
                <div className="flex gap-2 items-center">
                  <button
                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 text-xs"
                    onClick={() => router.push(`/admin/groups/${g._id}/users`)}
                  >
                    {g.players?.length || 0} пользователей
                  </button>
                  <button
                    className="px-2 py-1 bg-purple-100 text-purple-800 rounded hover:bg-purple-200 text-xs"
                    onClick={() => router.push(`/admin/groups/${g._id}/bracket`)}
                  >
                    Матчи
                  </button>
                  <button onClick={() => { setEditGroupId(g._id); setEditForm({ name: g.name }); }} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Редактировать</button>
                  <button onClick={() => handleDeleteGroup(g._id)} className="px-2 py-1 bg-red-100 text-red-700 rounded">Удалить</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded shadow p-4 mb-4">
          <input
            className="border rounded px-3 py-2 mb-2 w-full"
            placeholder="Название группы"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-200 rounded">Отмена</button>
          </div>
        </form>
      )}
    </main>
  );
} 