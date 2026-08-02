"use client";
import React, { useEffect, useState, useRef } from 'react';
import { getPlayers, getClubs, createPlayer, updatePlayer, deletePlayer } from 'app/lib/client';
import AdminMenu from 'components/AdminMenu';
import { Button, Card, Skeleton } from 'components/ui';
import { FaPlus, FaEdit, FaTimes, FaTrash } from 'react-icons/fa';
import PlayerAvatarEditor from './PlayerAvatarEditor';

export default function PlayersPage() {
      const [players, setPlayers] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterClub, setFilterClub] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterBirthYear, setFilterBirthYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingPlayer, setEditingPlayer] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ fullName: '', birthYear: '', gender: '', club: '' });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([getPlayers(), getClubs()]).then(([p, c]) => {
      setPlayers(p);
      // Объединяем клубы из таблицы clubs и уникальные значения players.club:
      // игрокам клуб задаётся свободным текстом, поэтому список подсказок
      // (datalist) должен включать и реально используемые названия.
      const used = new Map<string, string>();
      for (const club of c) used.set(club.name, club.name);
      for (const pl of p) {
        const name = (pl.club || '').trim();
        if (name) used.set(name, name);
      }
      const all = [...used.values()].sort((a, b) => a.localeCompare(b, 'ru'));
      setClubs(all.map((name) => ({ name })));
      setLoading(false);
    });
  }, []);

  function filteredPlayers() {
    return players.filter(
      (p) =>
        (!search || p.fullName.toLowerCase().includes(search.toLowerCase())) &&
        (!filterClub || p.club === filterClub) &&
        (!filterGender || p.gender === filterGender) &&
        (!filterBirthYear || String(p.birthYear) === filterBirthYear),
    );
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>, playerId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { uploadPlayerAvatar } = await import('app/lib/avatar');
    await uploadPlayerAvatar(playerId, file);
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

  async function saveEdit() {
    if (!editingPlayer) return;
    setSaving(true);
    try {
      await updatePlayer(editingPlayer._id, editForm);
      setEditingPlayer(null);
      setEditForm({});
      getPlayers().then(setPlayers);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlayer(player: any) {
    if (!confirm(`Удалить игрока «${player.fullName}»?\n\nВнимание: если игрок участвует в турнирах, матчи могут остаться без него.`)) return;
    setSaving(true);
    try {
      await deletePlayer(player._id);
      getPlayers().then(setPlayers);
    } catch (e: any) {
      setError(e.message || 'Ошибка удаления игрока');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePlayer() {
    setCreating(true);
    try {
      await createPlayer(createForm);
      setShowCreateModal(false);
      setCreateForm({ fullName: '', birthYear: '', gender: '', club: '' });
      getPlayers().then(setPlayers);
    } finally {
      setCreating(false);
    }
  }

  const inputCls = 'border border-surface-border rounded-lg px-3 py-2 bg-surface-card text-content text-sm';
  const labelCls = 'block text-xs text-content-muted mb-1';

  return (
    <main className="max-w-5xl mx-auto py-8 px-4 pb-24">
      <AdminMenu className="hidden md:flex" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">Игроки</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <FaPlus /> Добавить
        </Button>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Фильтры */}
      <Card className="mb-4">
        <div className="p-3 flex flex-wrap gap-2 items-center">
          <input
            className={`${inputCls} flex-1 min-w-[180px]`}
            placeholder="Поиск по ФИО..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={inputCls} value={filterClub} onChange={(e) => setFilterClub(e.target.value)}>
            <option value="">Все клубы</option>
            {clubs.map((club: any) => (
              <option key={club._id || club.name} value={club.name}>{club.name}</option>
            ))}
          </select>
          <select className={inputCls} value={filterGender} onChange={(e) => setFilterGender(e.target.value)}>
            <option value="">Любой пол</option>
            <option value="М">М</option>
            <option value="Ж">Ж</option>
          </select>
          <input
            className={`${inputCls} w-32`}
            placeholder="Год"
            value={filterBirthYear}
            onChange={(e) => setFilterBirthYear(e.target.value)}
            type="number"
          />
        </div>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filteredPlayers().length === 0 ? (
        <div className="text-center py-12 text-content-muted">
          <div className="text-5xl mb-3">🎾</div>
          <p>Игроки не найдены</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="p-3 text-left text-xs font-semibold text-content-muted uppercase">Аватар</th>
                  <th className="p-3 text-left text-xs font-semibold text-content-muted uppercase">ФИО</th>
                  <th className="p-3 text-left text-xs font-semibold text-content-muted uppercase">Год</th>
                  <th className="p-3 text-left text-xs font-semibold text-content-muted uppercase">Пол</th>
                  <th className="p-3 text-left text-xs font-semibold text-content-muted uppercase">Клуб</th>
                  <th className="p-3 text-left text-xs font-semibold text-content-muted uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filteredPlayers().map((p) => (
                  <tr key={p._id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="p-3">
                      <PlayerAvatarEditor
                        player={p}
                        onAvatarChanged={() => getPlayers().then(setPlayers)}
                      />
                    </td>
                    <td className="p-3 font-medium text-content">{p.fullName}</td>
                    <td className="p-3 text-content-muted">{p.birthYear}</td>
                    <td className="p-3 text-content-muted">{p.gender}</td>
                    <td className="p-3 text-content-muted">{p.club}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => startEditPlayer(p)} title="Редактировать">
                          <FaEdit />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!text-red-600"
                          onClick={() => handleDeletePlayer(p)}
                          disabled={saving}
                          title="Удалить игрока"
                          aria-label="Удалить игрока"
                        >
                          <FaTrash />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Модалка редактирования */}
      {editingPlayer && (
        <Modal onClose={() => setEditingPlayer(null)} title="Редактировать игрока">
          <div className="space-y-3">
            <div>
              <label className={labelCls}>ФИО</label>
              <input className={`${inputCls} w-full`} value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Год рождения</label>
              <input className={`${inputCls} w-full`} type="number" value={editForm.birthYear} onChange={(e) => setEditForm({ ...editForm, birthYear: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Пол</label>
              <select className={`${inputCls} w-full`} value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                <option value="">Выбрать</option>
                <option value="М">М</option>
                <option value="Ж">Ж</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Клуб</label>
              <input className={`${inputCls} w-full`} value={editForm.club} onChange={(e) => setEditForm({ ...editForm, club: e.target.value })} list="clubs-list" />
              <datalist id="clubs-list">
                {clubs.map((club: any) => (
                  <option key={club._id || club.name} value={club.name} />
                ))}
              </datalist>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setEditingPlayer(null)}>Отмена</Button>
              <Button onClick={saveEdit} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Модалка создания */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} title="Добавить игрока">
          <div className="space-y-3">
            <div>
              <label className={labelCls}>ФИО</label>
              <input className={`${inputCls} w-full`} value={createForm.fullName} onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Год рождения</label>
              <input className={`${inputCls} w-full`} type="number" value={createForm.birthYear} onChange={(e) => setCreateForm({ ...createForm, birthYear: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Пол</label>
              <select className={`${inputCls} w-full`} value={createForm.gender} onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })}>
                <option value="">Выбрать</option>
                <option value="М">М</option>
                <option value="Ж">Ж</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Клуб</label>
              <input className={`${inputCls} w-full`} value={createForm.club} onChange={(e) => setCreateForm({ ...createForm, club: e.target.value })} list="clubs-list-create" />
              <datalist id="clubs-list-create">
                {clubs.map((club: any) => (
                  <option key={club._id || club.name} value={club.name} />
                ))}
              </datalist>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Отмена</Button>
              <Button variant="success" onClick={handleCreatePlayer} disabled={creating}>{creating ? 'Создание…' : 'Создать'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="p-6 min-w-[320px] max-w-md w-full" elevated>
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">{title}</h2>
            <button onClick={onClose} className="text-content-muted hover:text-content" aria-label="Закрыть">
              <FaTimes />
            </button>
          </div>
          {children}
        </div>
      </Card>
    </div>
  );
}
