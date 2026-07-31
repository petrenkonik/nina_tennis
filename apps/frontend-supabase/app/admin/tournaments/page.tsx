"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { Tournament } from '@shared/models/tennis';
import AdminMenu from '../../../components/AdminMenu';
import RequireAdmin from '../../../components/RequireAdmin';
import { Button, Card, Skeleton } from 'components/ui';
import { FaPlus, FaEdit, FaTrash, FaTrophy, FaTimes } from 'react-icons/fa';
import {
  getTournaments,
  createTournament,
  updateTournament,
  deleteTournament,
  getClubs,
} from 'app/lib/client';
import { useRouter } from 'next/navigation';
import {
  formatDate,
  toDateInputValue,
  getTournamentStatus,
  getParticipantsCount,
  getGroupsCount,
} from '@shared/utils';

function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Tournament>>({ name: '', startDate: '', endDate: '', clubId: '', format: 'singles' });
  const [editId, setEditId] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'active' | 'finished'>('all');
  const [search, setSearch] = useState('');
  const [clubs, setClubs] = useState<{ _id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
      const router = useRouter();

  async function fetchTournaments() {
    setLoading(true);
    try {
      setTournaments(await getTournaments());
      setError('');
    } catch {
      setError('Ошибка загрузки турниров');
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchTournaments();
    getClubs().then(setClubs).catch(() => setClubs([]));
  }, []);

  function openCreate() {
    setForm({ name: '', startDate: '', endDate: '', clubId: '', format: 'singles' });
    setEditId(null);
    setShowForm(true);
  }
  function openEdit(t: Tournament) {
    setForm({ name: t.name, startDate: t.startDate, endDate: t.endDate, clubId: t.clubId || '', format: t.format || 'singles' });
    setEditId(t._id);
    setShowForm(true);
  }
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Удалить турнир «${name}»?`)) return;
    await deleteTournament(id);
    fetchTournaments();
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await updateTournament(editId, form);
      } else {
        await createTournament(form);
      }
      setShowForm(false);
      fetchTournaments();
    } finally {
      setSaving(false);
    }
  }

  const filteredTournaments = useMemo(() => {
    let filtered = tournaments;
    const now = new Date();
    if (tab === 'active') {
      filtered = tournaments.filter((t) => new Date(t.startDate) > now);
    } else if (tab === 'finished') {
      filtered = tournaments.filter((t) => getTournamentStatus(t) === 'Завершён');
    }
    if (search.trim()) {
      filtered = filtered.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()));
    }
    return filtered.slice().sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [tournaments, tab, search]);

  const inputCls = 'border border-surface-border rounded-lg px-3 py-2 bg-surface-card text-content text-sm w-full focus:ring-2 focus:ring-brand-200 outline-none transition';

  return (
    <main className="max-w-3xl mx-auto py-8 px-4 pb-24 relative">
      <AdminMenu className="hidden md:flex" />
      <h1 className="text-2xl font-extrabold mb-6 flex items-center gap-2">
        <FaTrophy className="text-court-500" /> Турниры
      </h1>

      {/* Вкладки */}
      <div className="flex gap-2 mb-3">
        {(['all', 'active', 'finished'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-brand-600 text-white'
                : 'bg-surface-card text-content-muted hover:bg-surface-muted border border-surface-border'
            }`}
          >
            {t === 'all' ? 'Все' : t === 'active' ? 'Активные' : 'Завершённые'}
          </button>
        ))}
      </div>

      {/* Поиск */}
      <input
        className={`${inputCls} mb-4`}
        placeholder="Поиск по названию турнира"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Button onClick={openCreate} className="mb-6">
        <FaPlus /> Создать турнир
      </Button>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="text-center py-12 text-content-muted">
          <div className="text-5xl mb-3">🏆</div>
          <p>Турниров не найдено</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredTournaments.map((t) => (
            <Card key={t._id} className="p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <FaTrophy className="text-brand-500" />
                <span className="font-bold text-lg text-content">{t.name}</span>
              </div>
              <div className="text-content-muted text-sm mb-2">
                {formatDate(t.startDate)} — {formatDate(t.endDate)}
              </div>
              <div className="flex gap-2 text-xs mb-2 flex-wrap">
                <span className="bg-brand-100 dark:bg-brand-900/30 text-brand-800 dark:text-brand-300 rounded px-2 py-1">
                  {getTournamentStatus(t)}
                </span>
                {t.format === 'doubles' && (
                  <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded px-2 py-1" title="Парный турнир (2×2)">
                    👥 Парный
                  </span>
                )}
                <button
                  className="bg-surface-muted text-content rounded px-2 py-1 hover:text-brand-600"
                  title="Участники распределены по группам"
                  onClick={() => router.push(`/admin/tournaments/${t._id}/groups`)}
                >
                  {getParticipantsCount(t)} участников
                </button>
                <button
                  className="bg-surface-muted text-content rounded px-2 py-1 hover:text-brand-600"
                  onClick={() => router.push(`/admin/tournaments/${t._id}/groups`)}
                >
                  {getGroupsCount(t)} групп
                </button>
                <button
                  className="bg-surface-muted text-content rounded px-2 py-1 hover:text-brand-600"
                  onClick={() => router.push(`/admin/tournaments/${t._id}/referees`)}
                >
                  🎾 Судьи
                </button>
              </div>
              <div className="text-xs text-content-muted mb-1">
                {clubs.find((c) => c._id === t.clubId)?.name || 'Без клуба'}
              </div>
              <div className="flex gap-2 mt-auto">
                <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                  <FaEdit /> Изм.
                </Button>
                <Button variant="ghost" size="sm" className="!text-red-600" onClick={() => handleDelete(t._id, t.name)}>
                  <FaTrash />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Модалка формы */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <Card className="p-6 w-full max-w-sm" elevated>
            <form
              onSubmit={handleSubmit}
              onClick={(e) => e.stopPropagation()}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  {editId ? <FaEdit /> : <FaPlus />} {editId ? 'Редактировать' : 'Создать'} турнир
                </h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-content-muted hover:text-content">
                  <FaTimes />
                </button>
              </div>
              <div>
                <label className="block text-xs text-content-muted mb-1">Название</label>
                <input
                  className={inputCls}
                  placeholder="Название"
                  value={form.name || ''}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-content-muted mb-1">Начало</label>
                  <input
                    className={inputCls}
                    type="date"
                    value={toDateInputValue(form.startDate)}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-content-muted mb-1">Конец</label>
                  <input
                    className={inputCls}
                    type="date"
                    value={toDateInputValue(form.endDate)}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-content-muted mb-1">Клуб</label>
                <select
                  className={inputCls}
                  value={form.clubId || ''}
                  onChange={(e) => setForm((f) => ({ ...f, clubId: e.target.value }))}
                >
                  <option value="">Без клуба</option>
                  {clubs.map((club) => (
                    <option key={club._id} value={club._id}>{club.name}</option>
                  ))}
                </select>
              </div>
              {/* Формат турнира: менять нельзя после создания (формат наследуют группы). */}
              <div>
                <label className="block text-xs text-content-muted mb-1">Формат</label>
                <select
                  className={inputCls}
                  value={form.format || 'singles'}
                  onChange={(e) => setForm((f) => ({ ...f, format: e.target.value as 'singles' | 'doubles' }))}
                  disabled={!!editId}
                  title={editId ? 'Формат нельзя изменить у существующего турнира' : 'Одиночный или парный турнир'}
                >
                  <option value="singles">Одиночный (1×1)</option>
                  <option value="doubles">Парный (2×2)</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Отмена</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </main>
  );
}

export default function AdminTournamentsPageWrapper() {
  return (
    <RequireAdmin>
      <AdminTournamentsPage />
    </RequireAdmin>
  );
}
