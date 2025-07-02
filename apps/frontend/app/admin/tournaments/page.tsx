"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { Tournament } from '@shared/models/tennis';
import AdminMenu from '../../../components/AdminMenu';
import RequireAdmin from '../../../components/RequireAdmin';
import { FaPlus, FaEdit, FaTrash, FaTrophy } from 'react-icons/fa';
import MainMenu from '../../../components/MainMenu';
import { getTournaments, getTournamentById, createTournament, updateTournament, deleteTournament, getClubs } from 'app/lib/api';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { formatDate, toDateInputValue, getTournamentStatus, getParticipantsCount, getGroupsCount } from '@shared/utils';

function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Tournament>>({ name: '', startDate: '', endDate: '', clubId: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'active' | 'finished'>('all');
  const [search, setSearch] = useState('');
  const [clubs, setClubs] = useState<{ _id: string; name: string }[]>([]);
  const { data: session } = useSession();
  const accessToken = session?.accessToken;
  const router = useRouter();
  
  async function fetchTournaments() {
    setLoading(true);
    try {
      const tournaments = await getTournaments();
      setTournaments(tournaments);
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
    setForm({ name: '', startDate: '', endDate: '', clubId: '' });
    setEditId(null);
    setShowForm(true);
  }
  function openEdit(t: Tournament) {
    setForm({ name: t.name, startDate: t.startDate, endDate: t.endDate, clubId: t.clubId || '' });
    setEditId(t._id);
    setShowForm(true);
  }
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Удалить турнир «${name}»?`)) return;
    await deleteTournament(id, accessToken);
    fetchTournaments();
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      await updateTournament(editId, form, accessToken);
    } else {
      await createTournament(form, accessToken);
    }
    setShowForm(false);
    fetchTournaments();
  }

  // Фильтрация и сортировка турниров по вкладкам и поиску
  const filteredTournaments = useMemo(() => {
    let filtered = tournaments;
    const now = new Date();
    if (tab === 'active') {
      // Активные — те, что скоро начнутся (startDate > сейчас)
      filtered = tournaments.filter(t => new Date(t.startDate) > now);
    } else if (tab === 'finished') {
      filtered = tournaments.filter(t => getTournamentStatus(t) === 'Завершён');
    }
    if (search.trim()) {
      filtered = filtered.filter(t => t.name.toLowerCase().includes(search.trim().toLowerCase()));
    }
    // Сортировка: новые (по дате начала) — первые
    filtered = filtered.slice().sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    return filtered;
  }, [tournaments, tab, search]);

  return (
    <main className="max-w-3xl mx-auto py-8 px-2 pb-24 relative">
      <AdminMenu className="hidden md:flex" />
      <h1 className="text-2xl font-extrabold mb-6 flex items-center gap-2"><FaTrophy className="text-yellow-500" /> Теннисные турниры</h1>
      {/* Вкладки */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('all')} className={`px-4 py-2 rounded ${tab === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Все</button>
        <button onClick={() => setTab('active')} className={`px-4 py-2 rounded ${tab === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Активные</button>
        <button onClick={() => setTab('finished')} className={`px-4 py-2 rounded ${tab === 'finished' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Завершённые</button>
      </div>
      {/* Поиск */}
      <input
        className="border rounded px-3 py-2 mb-4 w-full focus:ring-2 focus:ring-blue-200 outline-none transition"
        placeholder="Поиск по названию турнира"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <button
        onClick={openCreate}
        className="fixed md:static bottom-20 right-4 z-50 flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full shadow-lg transition-all duration-200 md:mb-6 md:ml-0 md:mr-4"
      >
        <FaPlus /> <span className="hidden sm:inline">Создать турнир</span>
      </button>
      {loading && <div>Загрузка...</div>}
      {error && <div className="text-red-500">{error}</div>}
      <div className="grid gap-6 sm:grid-cols-2">
        {filteredTournaments.map(t => (
          <div key={t._id} className="bg-white rounded-2xl shadow-md p-5 flex flex-col gap-2 hover:shadow-xl transition-shadow border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <FaTrophy className="text-green-500" />
              <span className="font-bold text-lg">{t.name}</span>
            </div>
            <div className="text-gray-500 text-sm mb-2">{formatDate(t.startDate)} — {formatDate(t.endDate)}</div>
            <div className="flex gap-2 text-xs mb-2">
              <span className="bg-blue-100 text-blue-800 rounded px-2 py-1">{getTournamentStatus(t)}</span>
              <span
                className="bg-gray-100 text-gray-800 rounded px-2 py-1 cursor-pointer underline hover:text-blue-600"
                onClick={() => router.push(`/admin/tournaments/${t._id}/users`)}
              >
                {getParticipantsCount(t)} участников
              </span>
              <span
                className="bg-gray-100 text-gray-800 rounded px-2 py-1 cursor-pointer underline hover:text-blue-600"
                onClick={() => router.push(`/admin/tournaments/${t._id}/groups`)}
              >
                {getGroupsCount(t)} групп
              </span>
            </div>
            <div className="text-xs text-gray-500 mb-1">{clubs.find(c => c._id === t.clubId)?.name || 'Без клуба'}</div>
            <div className="flex gap-2 mt-auto">
              <button onClick={() => openEdit(t)} className="flex items-center gap-1 px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded transition"><FaEdit /> Редактировать</button>
              <button onClick={() => handleDelete(t._id, t.name)} className="flex items-center gap-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded transition"><FaTrash /> Удалить</button>
            </div>
          </div>
        ))}
      </div>
      {/* Модальное окно для формы */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xs animate-pop-in">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">{editId ? <FaEdit /> : <FaPlus />} {editId ? 'Редактировать' : 'Создать'} турнир</h2>
            <input
              className="border rounded px-3 py-2 mb-2 w-full focus:ring-2 focus:ring-blue-200 outline-none transition"
              placeholder="Название"
              value={form.name || ''}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
            <input
              className="border rounded px-3 py-2 mb-2 w-full focus:ring-2 focus:ring-blue-200 outline-none transition"
              type="date"
              placeholder="Дата начала"
              value={toDateInputValue(form.startDate)}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              required
            />
            <input
              className="border rounded px-3 py-2 mb-4 w-full focus:ring-2 focus:ring-blue-200 outline-none transition"
              type="date"
              placeholder="Дата окончания"
              value={toDateInputValue(form.endDate)}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              required
            />
            {/* Выбор клуба */}
            <select
              className="border rounded px-3 py-2 mb-4 w-full focus:ring-2 focus:ring-blue-200 outline-none transition"
              value={form.clubId || ''}
              onChange={e => setForm(f => ({ ...f, clubId: e.target.value }))}
            >
              <option value="">Без клуба</option>
              {clubs.map(club => (
                <option key={club._id} value={club._id}>{club.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition">Сохранить</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded transition">Отмена</button>
            </div>
          </form>
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