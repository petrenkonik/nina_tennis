"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Scoreboard from 'components/Scoreboard';
import { Skeleton, StatusBadge } from 'components/ui';
import { Button } from 'components/ui';
import { FaExpand, FaCompress } from 'react-icons/fa';
import { getMatch, getGroupById } from 'app/lib/client';
import { supabaseBrowser } from 'app/lib/supabase/browser';
import type { Match } from '@shared/models/tennis';

export default function PublicScoreboardPage() {
  const params = useParams();
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  const [match, setMatch] = useState<Match | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const loadMatch = useCallback(async () => {
    try {
      const m = await getMatch(matchId);
      setMatch(m as Match);
      // Достаём название группы, если матч к ней привязан — пробуем по groupId
      if (m?.groupId) {
        getGroupById(String(m.groupId))
          .then((g: any) => setGroupName(g?.name || ''))
          .catch(() => {});
      }
      setError('');
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки матча');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadMatch();

    // Realtime: мгновенные обновления при изменении строки matches.
    // payload.new содержит поля строки (без игроков), поэтому перезагружаем
    // полный объект через api, чтобы получить имена/фото игроков.
    const channel = supabaseBrowser
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        () => loadMatch(),
      )
      .subscribe();

    // Fallback polling на случай проблем с Realtime-соединением (15с вместо 4с).
    const timer = setInterval(loadMatch, 15000);
    return () => {
      clearInterval(timer);
      supabaseBrowser.removeChannel(channel);
    };
  }, [loadMatch, matchId]);

  // Отслеживание fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // fullscreen может быть недоступен (iOS) — игнорируем
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <Skeleton className="h-[60vh] w-full max-w-3xl rounded-2xl" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center gap-4">
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {error || 'Матч не найден'}
        </div>
        <Link href="/" className="text-brand-600 dark:text-brand-400 underline">На главную</Link>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen p-2 sm:p-4 flex flex-col bg-surface-muted">
      {/* Верхняя панель управления (скрывается в fullscreen) */}
      {!isFullscreen && (
        <div className="flex items-center justify-between gap-2 mb-2 max-w-5xl mx-auto w-full">
          <Link href="/" className="text-xs text-content-muted hover:text-content">
            ← Все турниры
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-content-muted hidden sm:inline">
              Автообновление в реальном времени
            </span>
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              <FaExpand /> Полный экран
            </Button>
          </div>
        </div>
      )}

      {/* Кнопка выхода из fullscreen */}
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="fixed top-3 right-3 z-50 text-white/70 hover:text-white transition"
          aria-label="Выйти из полноэкранного режима"
        >
          <FaCompress className="w-5 h-5" />
        </button>
      )}

      {/* Табло */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-5xl" style={{ height: isFullscreen ? '100vh' : '70vh' }}>
          <Scoreboard
            match={match}
            large={isFullscreen}
            context={{ groupName }}
          />
        </div>
      </div>
    </div>
  );
}
