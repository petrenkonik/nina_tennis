"use client";
import React, { useEffect, useState } from 'react';
import { createGroup, getTournaments, updateGroup, deleteGroup, getTournamentById } from 'app/lib/api';
import { useParams, useRouter } from 'next/navigation';
import AdminMenu from 'components/AdminMenu';
import { Button, Card } from 'components/ui';
import { FaPlus, FaEdit, FaTrash, FaTimes, FaCheck, FaUsers, FaStream } from 'react-icons/fa';
import { formatDate } from '@shared/utils';

interface GroupRow {
  _id: string;
  name: string;
  playersCount: number;
}

export default function GroupsEditorPage() {
  const { id: rawId } = useParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const [groups, setGroups] = useState<GroupRow[]>([]);
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
      setGroups(
        (tournament.groups || []).map((g: any) => ({
          _id: String(g._id),
          name: g.name,
          playersCount: typeof g.playersCount === 'number' ? g.playersCount : (g.players?.length || 0),
        })),
      );
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

  const inputCls = 'border border-surface-border rounded-lg px-3 py-2 bg-surface-card text-content text-sm w-full focus:ring-2 focus:ring-brand-200 outline-none transition';

  return (
    <main className="max-w-2xl mx-auto py-8 px-4 pb-24">
      <AdminMenu className="hidden md:flex" />
      <h1 className="text-2xl font-extrabold mb-6">Группы турнира</h1>
      {/* Комбобокс выбора турнира */}
      <div className="mb-6">
        <label className="block mb-1 font-semibold">Выбрать турнир:</label>
        <select
          className={`${inputCls} max-w-xs`}
          value={id}
          onChange={e => router.push(`/admin/tournaments/${e.target.value}/groups`)}
        >
          {tournaments.map(t => (
            <option key={t._id} value={t._id}>{t.name} ({formatDate(t.startDate)} — {formatDate(t.endDate)})</option>
          ))}
        </select>
      </div>
      <Button onClick={() => setShowForm(true)} className="mb-4">
        <FaPlus /> Добавить группу
      </Button>
      {loading && <div className="text-content-muted">Загрузка...</div>}
      {error && <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{error}</div>}
      <div className="space-y-3 mb-8">
        {groups.map(g => (
          <Card key={g._id} className="p-4">
            {editGroupId === g._id ? (
              <form onSubmit={handleEditSubmit} className="flex gap-2 w-full">
                <input
                  className={inputCls}
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                />
                <Button type="submit" variant="success" size="sm">
                  <FaCheck />
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditGroupId(null)}>
                  <FaTimes />
                </Button>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold text-content truncate">{g.name}</div>
                  <div className="text-xs text-content-muted flex items-center gap-1 mt-0.5">
                    <FaUsers /> {g.playersCount} уч.
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/admin/groups/${g._id}/users`)} title="Участники группы">
                    <FaUsers /> Участники
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/admin/groups/${g._id}/bracket`)} title="Матчи и сетка группы">
                    <FaStream /> Матчи
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditGroupId(g._id); setEditForm({ name: g.name }); }}
                    title="Переименовать группу"
                  >
                    <FaEdit />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!text-red-600"
                    onClick={() => handleDeleteGroup(g._id)}
                    title="Удалить группу"
                    aria-label="Удалить группу"
                  >
                    <FaTrash />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {!loading && !error && groups.length === 0 && (
          <div className="text-center py-12 text-content-muted">
            <div className="text-5xl mb-3">📋</div>
            <p>В турнире пока нет групп</p>
          </div>
        )}
      </div>
      {showForm && (
        <Card className="p-4 mb-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><FaPlus /> Новая группа</h3>
            <input
              className={inputCls}
              placeholder="Название группы"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="submit">Сохранить</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Отмена</Button>
            </div>
          </form>
        </Card>
      )}
    </main>
  );
} 