'use client';

import { useEffect } from 'react';
import { supabaseBrowser } from './supabase/browser';
import type { Match } from '@shared/models/tennis';

/**
 * Подписка на Realtime-обновления матча.
 * Замена polling (setInterval каждые 4с) в live-табло и судействе.
 *
 * При любом UPDATE строки matches для данного id вызывает onUpdate с новой строкой
 * (сырая snake_case-строка — вызывающий код преобразует через toMatch или сам).
 *
 * Возвращает функцию отписки через useEffect cleanup.
 */
export function useMatchRealtime(
  matchId: string | undefined,
  onUpdate: (match: Match) => void,
) {
  useEffect(() => {
    if (!matchId) return;

    const channel = supabaseBrowser
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          // payload.new — частичная/полная строка matches.
          // Для полного объекта (с игроками) лучше перезагрузить через api,
          // но базовые поля счёта/статуса приходят сразу.
          onUpdate(payload.new as unknown as Match);
        },
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);
}
