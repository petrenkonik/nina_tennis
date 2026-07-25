"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getGroupById,
  getPlayers,
  updateGroup,
  createPlayer,
  getClubs,
  getTournaments,
} from 'app/lib/api';
import AdminMenu from 'components/AdminMenu';
import { Button, Card, CardBody, Skeleton, StatusBadge } from 'components/ui';
import { SeedBadge } from 'components/ui/SeedBadge';
import { FaArrowUp, FaArrowDown, FaPlus, FaStar, FaTrash, FaEdit, FaCheck } from 'react-icons/fa';
import {
  normalizeSeeds,
  nextSeedNumber,
  seedsByRating,
  removeAndRenumber,
  swapSeeds,
} from '@shared/seeding';

export default function GroupUsersEditorPage() {
  const { groupId: rawGroupId } = useParams();
  const groupId = Array.isArray(rawGroupId) ? rawGroupId[0] : rawGroupId;
      const router = useRouter();

  const [group, setGroup] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [addPlayerId, setAddPlayerId] = useState('');
  const [showNewPlayerForm, setShowNewPlayerForm] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ fullName: '', gender: '', birthYear: '', club: '' });
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [clubs, setClubs] = useState<any[]>([]);
  const [tournament, setTournament] = useState<any>(null);
  const [seedEdit, setSeedEdit] = useState<{ playerId: string; seed: number } | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const [groupData, allPlayers] = await Promise.all([getGroupById(groupId), getPlayers()]);
      setGroup(groupData);
      setPlayers(allPlayers);
      setError('');
    } catch {
      setError('Ошибка загрузки данных');
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    getTournaments().then((all) => {
      const found = (all as any[]).find((t) =>
        (t.groups || []).some((g) => (g._id || g) === groupId),
      );
      setTournament(found || null);
    });
  }, [groupId]);
  useEffect(() => {
    getClubs().then(setClubs);
  }, []);

  // Нормализованный посев (без дублей, отсортирован)
  const seeds = useMemo(() => {
    const raw: { playerId: string; seed: number }[] = (group?.seededPlayers || []).map((s: any) => ({
      playerId: String(s.player?._id || s.player),
      seed: Number(s.seed),
    }));
    return normalizeSeeds(raw);
  }, [group]);

  // Карта playerId → seed для быстрого доступа
  const seedMap = useMemo(() => {
    const m = new Map<string, number>();
    seeds.forEach((s) => m.set(s.playerId, s.seed));
    return m;
  }, [seeds]);

  // Список игроков в группе, отсортированный: посеянные по seed, потом непосеянные
  const groupPlayersList = useMemo(() => {
    if (!group) return [];
    const inGroup = (group.players || []).map((p: any) =>
      typeof p === 'string' ? players.find((pl) => pl._id === p) : p,
    );
    return inGroup
      .filter(Boolean)
      .map((p: any) => ({ player: p, seed: seedMap.get(String(p._id)) }))
      .sort((a, b) => {
        if (a.seed != null && b.seed != null) return a.seed - b.seed;
        if (a.seed != null) return -1;
        if (b.seed != null) return 1;
        return 0;
      });
  }, [group, players, seedMap]);

  // Есть ли игроки с рейтингом (для авто-посева)?
  const hasRatings = useMemo(
    () => groupPlayersList.some((g) => typeof g.player.rating === 'number'),
    [groupPlayersList],
  );

  async function persistSeeds(newSeeds: { playerId: string; seed: number }[]) {
    setSaving(true);
    setError('');
    try {
      await updateGroup(groupId, { ...group, seededPlayers: newSeeds });
      setSaved(true);
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения посева');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!addPlayerId) return;
    setSaving(true);
    try {
      await updateGroup(
        groupId,
        { ...group, players: [...(group.players || []), addPlayerId] },
      );
      setAddPlayerId('');
      setSearch('');
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Ошибка добавления');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemovePlayer(playerId: string) {
    if (!confirm('Удалить игрока из группы?')) return;
    setSaving(true);
    try {
      const updatedPlayers = (group.players || []).filter((p: any) =>
        (typeof p === 'string' ? p : p._id) !== playerId,
      );
      const updatedSeeds = removeAndRenumber(seeds, playerId);
      await updateGroup(
        groupId,
        { ...group, players: updatedPlayers, seededPlayers: updatedSeeds },
      );
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Ошибка удаления');
    } finally {
      setSaving(false);
    }
  }

  async function handleMakeSeeded(playerId: string) {
    const seed = nextSeedNumber(seeds);
    await persistSeeds([...seeds, { playerId, seed }]);
  }

  async function handleRemoveSeed(playerId: string) {
    await persistSeeds(removeAndRenumber(seeds, playerId));
  }

  async function handleSaveSeedEdit() {
    if (!seedEdit) return;
    // Заменяем seed игрока на новое значение; конфликтующие удаляем
    const without = seeds.filter((s) => s.playerId !== seedEdit.playerId);
    const target = Number(seedEdit.seed);
    const withoutConflict = without.filter((s) => s.seed !== target);
    await persistSeeds([...withoutConflict, { playerId: seedEdit.playerId, seed: target }]);
    setSeedEdit(null);
  }

  async function handleAutoSeedByRating() {
    if (!confirm('Распределить посев автоматически по рейтингу? Текущий посев будет заменён.')) return;
    const playerObjs = groupPlayersList.map((g) => ({ _id: g.player._id, rating: g.player.rating }));
    const newSeeds = seedsByRating(playerObjs);
    if (newSeeds.length === 0) {
      setError('У игроков нет рейтинга — авто-посев невозможен');
      return;
    }
    await persistSeeds(newSeeds);
  }

  async function handleMove(playerId: string, direction: 'up' | 'down') {
    const currentSeed = seedMap.get(playerId);
    if (currentSeed == null) return;
    const sorted = [...seeds].sort((a, b) => a.seed - b.seed);
    const idx = sorted.findIndex((s) => s.playerId === playerId);
    const swapWith = direction === 'up' ? sorted[idx - 1] : sorted[idx + 1];
    if (!swapWith) return;
    await persistSeeds(swapSeeds(seeds, currentSeed, swapWith.seed));
  }

  async function handleCreatePlayer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await createPlayer(newPlayer);
      await updateGroup(
        groupId,
        { ...group, players: [...(group.players || []), created._id] },
      );
      setShowNewPlayerForm(false);
      setNewPlayer({ fullName: '', gender: '', birthYear: '', club: '' });
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Ошибка создания игрока');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto py-8 px-4 pb-24">
      <AdminMenu className="hidden md:flex" />
      <h1 className="text-2xl font-extrabold mb-1">
        Участники группы
        {tournament && group && (
          <span className="block text-sm font-normal mt-1 text-content-muted">
            {tournament.name} / {group.name}
          </span>
        )}
      </h1>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
        ← Назад
      </Button>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-3 py-2 rounded mb-4 text-sm">
          Сохранено ✓
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : group ? (
        <div className="space-y-4">
          {/* Панель действий над посевом */}
          <Card>
            <CardBody className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm text-content-muted">
                Посеяно: <span className="font-bold text-content">{seeds.length}</span> из{' '}
                {(group.players || []).length}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAutoSeedByRating}
                  disabled={saving || !hasRatings}
                  title={hasRatings ? 'Распределить посев по рейтингу' : 'Нет игроков с рейтингом'}
                >
                  <FaStar /> Авто по рейтингу
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewPlayerForm((v) => !v)}
                  disabled={saving}
                >
                  <FaPlus /> Новый игрок
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Форма добавления существующего игрока */}
          <form onSubmit={handleAddPlayer} className="relative">
            <div className="flex gap-2 items-center">
              <input
                className="border border-surface-border rounded-lg px-3 py-2 w-full bg-surface-card text-content text-sm"
                placeholder="Поиск игрока для добавления..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                autoComplete="off"
              />
              <Button type="submit" size="md" disabled={saving || !addPlayerId}>
                Добавить
              </Button>
            </div>
            {searchFocused && search && (
              <div className="absolute z-10 bg-surface-card border border-surface-border rounded-lg w-full max-h-48 overflow-y-auto mt-1 shadow-lg">
                {players
                  .filter(
                    (pl) =>
                      !(group.players || []).some((p: any) =>
                        (typeof p === 'string' ? p : p._id) === pl._id,
                      ) && pl.fullName.toLowerCase().includes(search.toLowerCase()),
                  )
                  .slice(0, 10)
                  .map((pl) => (
                    <button
                      type="button"
                      key={pl._id}
                      className={`w-full text-left px-3 py-2 hover:bg-surface-muted text-sm ${addPlayerId === pl._id ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}
                      onMouseDown={() => {
                        setAddPlayerId(pl._id);
                        setSearch(pl.fullName);
                        setSearchFocused(false);
                      }}
                    >
                      {pl.fullName}
                      <span className="text-xs text-content-muted ml-2">
                        {pl.birthYear} {pl.gender} {pl.club}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </form>

          {/* Форма создания нового игрока */}
          {showNewPlayerForm && (
            <Card>
              <CardBody>
                <h3 className="font-semibold mb-3">Новый игрок</h3>
                <form onSubmit={handleCreatePlayer} className="space-y-2">
                  <input
                    className="border border-surface-border rounded-lg px-3 py-2 w-full bg-surface-card text-content text-sm"
                    placeholder="ФИО"
                    value={newPlayer.fullName}
                    onChange={(e) => setNewPlayer((f) => ({ ...f, fullName: e.target.value }))}
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="border border-surface-border rounded-lg px-3 py-2 bg-surface-card text-content text-sm"
                      placeholder="Год рождения"
                      type="number"
                      value={newPlayer.birthYear}
                      onChange={(e) => setNewPlayer((f) => ({ ...f, birthYear: e.target.value }))}
                      required
                    />
                    <select
                      className="border border-surface-border rounded-lg px-3 py-2 bg-surface-card text-content text-sm"
                      value={newPlayer.gender}
                      onChange={(e) => setNewPlayer((f) => ({ ...f, gender: e.target.value }))}
                      required
                    >
                      <option value="">Пол</option>
                      <option value="М">М</option>
                      <option value="Ж">Ж</option>
                    </select>
                  </div>
                  <input
                    className="border border-surface-border rounded-lg px-3 py-2 w-full bg-surface-card text-content text-sm"
                    placeholder="Клуб"
                    value={newPlayer.club}
                    onChange={(e) => setNewPlayer((f) => ({ ...f, club: e.target.value }))}
                    list="clubs-list"
                  />
                  <datalist id="clubs-list">
                    {clubs.map((club) => (
                      <option key={club._id || club.name} value={club.name} />
                    ))}
                  </datalist>
                  <Button type="submit" size="sm" disabled={saving}>
                    Создать и добавить
                  </Button>
                </form>
              </CardBody>
            </Card>
          )}

          {/* Список игроков группы */}
          <div className="space-y-2">
            {groupPlayersList.map(({ player, seed }, idx) => (
              <Card key={player._id}>
                <CardBody className="flex items-center gap-3 flex-wrap py-3">
                  {/* Номер посева /drag-индикатор */}
                  <div className="flex items-center gap-1">
                    {seed != null && (
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!px-1 !py-0"
                          disabled={saving || idx === 0}
                          onClick={() => handleMove(player._id, 'up')}
                          aria-label="Выше"
                        >
                          <FaArrowUp className="text-xs" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!px-1 !py-0"
                          disabled={saving || idx === seeds.length - 1}
                          onClick={() => handleMove(player._id, 'down')}
                          aria-label="Ниже"
                        >
                          <FaArrowDown className="text-xs" />
                        </Button>
                      </div>
                    )}
                    <SeedBadge seed={seed ?? undefined} className="!min-w-[2rem] !px-2" />
                  </div>

                  {/* Информация об игроке */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-content truncate">{player.fullName}</div>
                    <div className="text-xs text-content-muted">
                      {player.birthYear} {player.gender} {player.club ? `· ${player.club}` : ''}
                      {typeof player.rating === 'number' ? ` · рейтинг ${player.rating}` : ''}
                    </div>
                  </div>

                  {/* Действия над посевом */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {seedEdit && seedEdit.playerId === player._id ? (
                      <>
                        <input
                          type="number"
                          min={1}
                          className="border border-surface-border rounded px-2 py-1 w-16 text-sm bg-surface-card text-content"
                          value={seedEdit.seed}
                          onChange={(e) => setSeedEdit({ ...seedEdit, seed: Number(e.target.value) })}
                        />
                        <Button variant="success" size="sm" onClick={handleSaveSeedEdit} disabled={saving}>
                          <FaCheck />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSeedEdit(null)}>
                          Отмена
                        </Button>
                      </>
                    ) : seed != null ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSeedEdit({ playerId: player._id, seed: seed })}
                          disabled={saving}
                        >
                          <FaEdit /> Изм.
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveSeed(player._id)} disabled={saving}>
                          <FaStar className="opacity-40" /> Снять
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => handleMakeSeeded(player._id)} disabled={saving}>
                        <FaStar /> В посев
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!text-red-600"
                      onClick={() => handleRemovePlayer(player._id)}
                      disabled={saving}
                    >
                      <FaTrash />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
            {groupPlayersList.length === 0 && (
              <div className="text-center py-8 text-content-muted">
                <div className="text-4xl mb-2">👥</div>
                В группе пока нет игроков
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
