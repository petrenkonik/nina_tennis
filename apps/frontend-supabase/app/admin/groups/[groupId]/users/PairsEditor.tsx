"use client";
/**
 * Редактор пар парной группы (doubles).
 *
 * Единица турнира — пара (капитан a + партнёр b). Посев хранится по капитану.
 * Переиспользует чистые функции посева из libs/shared (normalizeSeeds/swapSeeds/
 * seedsByPairs) — те же, что и для одиночного режима, но ключ — капитан пары.
 *
 * Парный турнир собирает пары админ: выбирает двух игроков → пара.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  getGroupById,
  getPlayers,
  updateGroup,
  createPlayer,
  getClubs,
} from "app/lib/client";
import { Button, Card, CardBody, Skeleton, StatusBadge } from "components/ui";
import { SeedBadge } from "components/ui/SeedBadge";
import { FaArrowUp, FaArrowDown, FaPlus, FaStar, FaTrash, FaEdit, FaCheck, FaUsers } from "react-icons/fa";
import {
  normalizeSeeds,
  nextSeedNumber,
  seedsByPairs,
  removeAndRenumber,
  swapSeeds,
} from "@shared/seeding";

interface Pair {
  a: any; // капитан
  b: any; // партнёр
  seed?: number;
}

export default function PairsEditor({ groupId }: { groupId: string }) {
  const [group, setGroup] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Создание пары: выбранные капитан + партнёр
  const [selA, setSelA] = useState("");
  const [selB, setSelB] = useState("");

  // Создание нового игрока
  const [showNewPlayerForm, setShowNewPlayerForm] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ fullName: "", gender: "", birthYear: "", club: "" });
  const [clubs, setClubs] = useState<any[]>([]);

  async function fetchData() {
    setLoading(true);
    try {
      const [groupData, players] = await Promise.all([getGroupById(groupId), getPlayers()]);
      setGroup(groupData);
      setAllPlayers(players);
      setError("");
    } catch {
      setError("Ошибка загрузки данных");
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [groupId]);
  useEffect(() => {
    getClubs().then(setClubs);
  }, []);

  // Пары группы
  const pairs: Pair[] = useMemo(() => group?.pairs || [], [group]);

  // Нормализованный посев по капитану (без дублей, отсортирован)
  const seeds = useMemo(() => {
    const raw = pairs.map((p: Pair) => ({ playerId: String(p.a?._id), seed: Number(p.seed) })).filter((s) => s.playerId);
    return normalizeSeeds(raw.filter((s) => Number.isFinite(s.seed)));
  }, [pairs]);

  const seedMap = useMemo(() => {
    const m = new Map<string, number>();
    seeds.forEach((s) => m.set(s.playerId, s.seed));
    return m;
  }, [seeds]);

  // Пары, отсортированные по посеву (посеянные вперёд, потом непосеянные)
  const sortedPairs = useMemo(() => {
    return [...pairs].sort((a, b) => {
      const sa = seedMap.get(String(a.a?._id));
      const sb = seedMap.get(String(b.a?._id));
      if (sa != null && sb != null) return sa - sb;
      if (sa != null) return -1;
      if (sb != null) return 1;
      return 0;
    });
  }, [pairs, seedMap]);

  // Игроки, уже задействованные в каких-либо парах (нельзя повторно)
  const usedPlayerIds = useMemo(() => {
    const s = new Set<string>();
    for (const p of pairs) {
      if (p.a?._id) s.add(String(p.a._id));
      if (p.b?._id) s.add(String(p.b._id));
    }
    return s;
  }, [pairs]);

  const hasRatings = useMemo(
    () => pairs.some((p) => typeof p.a?.rating === "number" || typeof p.b?.rating === "number"),
    [pairs],
  );

  async function persistPairs(newPairs: { aId: string; bId: string }[]) {
    setSaving(true);
    setError("");
    try {
      await updateGroup(groupId, { ...group, pairs: newPairs });
      setSaved(true);
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Ошибка сохранения пар");
    } finally {
      setSaving(false);
    }
  }

  async function persistPairSeeds(newSeeds: { playerId: string; seed: number }[]) {
    setSaving(true);
    setError("");
    try {
      await updateGroup(groupId, { ...group, pairSeeds: newSeeds });
      setSaved(true);
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Ошибка сохранения посева пар");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePair(e: React.FormEvent) {
    e.preventDefault();
    if (!selA || !selB || selA === selB) {
      setError("Выберите двух разных игроков");
      return;
    }
    if (usedPlayerIds.has(selA) || usedPlayerIds.has(selB)) {
      setError("Один из игроков уже состоит в паре");
      return;
    }
    const newPairs = [...pairs.map((p) => ({ aId: String(p.a._id), bId: String(p.b._id) })), { aId: selA, bId: selB }];
    await persistPairs(newPairs);
    setSelA("");
    setSelB("");
  }

  async function handleDeletePair(captainId: string) {
    if (!confirm("Удалить пару из группы?")) return;
    const remaining = pairs.filter((p) => String(p.a._id) !== captainId).map((p) => ({ aId: String(p.a._id), bId: String(p.b._id) }));
    await persistPairs(remaining);
    // Синхронно снимаем посев с удалённой пары
    const remainingSeeds = removeAndRenumber(seeds, captainId);
    if (remainingSeeds.length !== seeds.length) await persistPairSeeds(remainingSeeds);
  }

  async function handleMakeSeeded(captainId: string) {
    const seed = nextSeedNumber(seeds);
    await persistPairSeeds([...seeds, { playerId: captainId, seed }]);
  }

  async function handleRemoveSeed(captainId: string) {
    await persistPairSeeds(removeAndRenumber(seeds, captainId));
  }

  async function handleMove(captainId: string, direction: "up" | "down") {
    const currentSeed = seedMap.get(captainId);
    if (currentSeed == null) return;
    const sorted = [...seeds].sort((a, b) => a.seed - b.seed);
    const idx = sorted.findIndex((s) => s.playerId === captainId);
    const swapWith = direction === "up" ? sorted[idx - 1] : sorted[idx + 1];
    if (!swapWith) return;
    await persistPairSeeds(swapSeeds(seeds, currentSeed, swapWith.seed));
  }

  async function handleAutoSeedByRating() {
    if (!confirm("Распределить посев автоматически по сумме рейтингов партнёров? Текущий посев будет заменён.")) return;
    const pairForSeeding = pairs.map((p) => ({ a: { _id: p.a._id, rating: p.a.rating }, b: { rating: p.b.rating } }));
    const newSeeds = seedsByPairs(pairForSeeding);
    if (newSeeds.length === 0) {
      setError("У пар нет рейтинга — авто-посев невозможен");
      return;
    }
    await persistPairSeeds(newSeeds);
  }

  async function handleCreatePlayer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createPlayer(newPlayer);
      setShowNewPlayerForm(false);
      setNewPlayer({ fullName: "", gender: "", birthYear: "", club: "" });
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Ошибка создания игрока");
    } finally {
      setSaving(false);
    }
  }

  // Свободные игроки для селекторов
  const freePlayers = useMemo(
    () => allPlayers.filter((p) => !usedPlayerIds.has(String(p._id))),
    [allPlayers, usedPlayerIds],
  );

  const inputCls = "border border-surface-border rounded-lg px-3 py-2 bg-surface-card text-content text-sm w-full focus:ring-2 focus:ring-brand-200 outline-none transition";

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {/* Панель посева */}
      <Card>
        <CardBody className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm text-content-muted">
            Пар: <span className="font-bold text-content">{pairs.length}</span> · Посеяно:{" "}
            <span className="font-bold text-content">{seeds.length}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAutoSeedByRating}
              disabled={saving || !hasRatings}
              title={hasRatings ? "Распределить посев по сумме рейтингов" : "Нет игроков с рейтингом"}
            >
              <FaStar /> Авто по рейтингу
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowNewPlayerForm((v) => !v)} disabled={saving}>
              <FaPlus /> Новый игрок
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Форма создания пары */}
      <Card>
        <CardBody>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FaUsers className="text-brand-500" /> Собрать пару
          </h3>
          <form onSubmit={handleCreatePair} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-content-muted">
                Капитан (единица турнира)
                <select className={inputCls} value={selA} onChange={(e) => setSelA(e.target.value)} required>
                  <option value="">—</option>
                  {freePlayers.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.fullName} {p.birthYear} {p.gender}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-content-muted">
                Партнёр
                <select className={inputCls} value={selB} onChange={(e) => setSelB(e.target.value)} required>
                  <option value="">—</option>
                  {freePlayers
                    .filter((p) => p._id !== selA)
                    .map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.fullName} {p.birthYear} {p.gender}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <Button type="submit" size="sm" disabled={saving || !selA || !selB}>
              <FaPlus /> Добавить пару
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Форма создания нового игрока */}
      {showNewPlayerForm && (
        <Card>
          <CardBody>
            <h3 className="font-semibold mb-3">Новый игрок</h3>
            <form onSubmit={handleCreatePlayer} className="space-y-2">
              <input
                className={inputCls}
                placeholder="ФИО"
                value={newPlayer.fullName}
                onChange={(e) => setNewPlayer((f) => ({ ...f, fullName: e.target.value }))}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputCls}
                  placeholder="Год рождения"
                  type="number"
                  value={newPlayer.birthYear}
                  onChange={(e) => setNewPlayer((f) => ({ ...f, birthYear: e.target.value }))}
                  required
                />
                <select
                  className={inputCls}
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
                className={inputCls}
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
                Создать игрока
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Список пар */}
      <div className="space-y-2">
        {sortedPairs.map((pair, idx) => {
          const captainId = String(pair.a._id);
          const seed = seedMap.get(captainId);
          return (
            <Card key={captainId}>
              <CardBody className="flex items-center gap-3 flex-wrap py-3">
                {/* Номер посева / стрелки */}
                <div className="flex items-center gap-1">
                  {seed != null && (
                    <div className="flex flex-col">
                      <Button variant="ghost" size="sm" className="!px-1 !py-0" disabled={saving || idx === 0} onClick={() => handleMove(captainId, "up")} aria-label="Выше">
                        <FaArrowUp className="text-xs" />
                      </Button>
                      <Button variant="ghost" size="sm" className="!px-1 !py-0" disabled={saving || idx === seeds.length - 1} onClick={() => handleMove(captainId, "down")} aria-label="Ниже">
                        <FaArrowDown className="text-xs" />
                      </Button>
                    </div>
                  )}
                  <SeedBadge seed={seed ?? undefined} className="!min-w-[2rem] !px-2" />
                </div>

                {/* Состав пары */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-content truncate">
                    {pair.a.fullName} <span className="text-content-muted font-normal">+ {pair.b.fullName}</span>
                  </div>
                  <div className="text-xs text-content-muted">
                    Капитан: {pair.a.birthYear} {pair.a.gender} {pair.a.club ? `· ${pair.a.club}` : ""}
                    {typeof pair.a.rating === "number" ? ` · рейтинг ${pair.a.rating}` : ""}
                    {" · "}
                    Партнёр: {pair.b.birthYear} {pair.b.gender} {pair.b.club ? `· ${pair.b.club}` : ""}
                    {typeof pair.b.rating === "number" ? ` · ${pair.b.rating}` : ""}
                  </div>
                </div>

                {/* Действия над посевом */}
                <div className="flex items-center gap-1 flex-wrap">
                  {seed != null ? (
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveSeed(captainId)} disabled={saving}>
                      <FaStar className="opacity-40" /> Снять
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => handleMakeSeeded(captainId)} disabled={saving}>
                      <FaStar /> В посев
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="!text-red-600" onClick={() => handleDeletePair(captainId)} disabled={saving}>
                    <FaTrash />
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}
        {sortedPairs.length === 0 && (
          <div className="text-center py-8 text-content-muted">
            <div className="text-4xl mb-2">👥</div>
            В группе пока нет пар
          </div>
        )}
      </div>
    </div>
  );
}
