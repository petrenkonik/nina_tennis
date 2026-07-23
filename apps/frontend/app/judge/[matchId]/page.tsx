"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getMatch } from 'app/lib/api';

/**
 * Шорткат-роут для судей: /judge/<matchId>.
 * Судья не знает groupId — определяем его по матчу и редиректим
 * на полноценную страницу судейства.
 */
export default function JudgeRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  const [error, setError] = useState('');

  useEffect(() => {
    async function resolve() {
      try {
        const m = await getMatch(matchId);
        // groupId не хранится на матче — ищем через известные источники.
        // Бэкенд-эндпоинт PUT требует groupId в URL, но сам матч его не несёт.
        // Решение: фронтенд передаёт groupId через search-параметр при переходе
        // из списка матчей. Если его нет — пытаемся через публичный fallback.
        const urlParams = new URLSearchParams(window.location.search);
        const gid = urlParams.get('groupId');
        if (gid) {
          router.replace(`/admin/groups/${gid}/matches/${matchId}/judge`);
          return;
        }
        // Без groupId —fallback на публичное табло (судья может попросить админа ссылку).
        router.replace(`/m/${matchId}`);
      } catch (e: any) {
        setError(e.message || 'Матч не найден');
      }
    }
    if (matchId) resolve();
  }, [matchId, router]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-rose-500 font-semibold mb-2">{error}</p>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <p className="text-content-muted">Открываем судейство…</p>
    </main>
  );
}
