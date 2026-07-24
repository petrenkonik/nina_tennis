"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { acceptRefereeInvite } from 'app/lib/api';
import { Skeleton, Button } from 'components/ui';
import { FaCheckCircle, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import { useSupabaseSession } from 'app/lib/useSupabaseSession';

type State =
  | { kind: 'loading' }
  | { kind: 'unauth' }   // не авторизован → просим войти
  | { kind: 'success'; tournamentName: string; tournamentId: string }
  | { kind: 'error'; message: string };

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const { status } = useSupabaseSession();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'authenticated') {
      // Не авторизован → на логин с возвратом сюда же
      router.replace(`/login?next=/invite/${token}`);
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    acceptRefereeInvite(token)
      .then((res) => {
        if (cancelled) return;
        setState({
          kind: 'success',
          tournamentName: res.tournamentName || 'турнир',
          tournamentId: res.tournamentId,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ kind: 'error', message: e.message || 'Не удалось принять приглашение' });
      });
    return () => { cancelled = true; };
  }, [token, status, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-muted p-4">
      <div className="bg-surface-card rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {state.kind === 'loading' && (
          <>
            <FaSpinner className="w-10 h-10 mx-auto mb-4 text-brand-500 animate-spin" />
            <p className="text-content-muted">Принимаем приглашение…</p>
          </>
        )}

        {state.kind === 'success' && (
          <>
            <FaCheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
            <h1 className="text-xl font-bold text-content mb-2">Вы стали судьёй!</h1>
            <p className="text-content-muted mb-6">
              Турнир: <span className="font-semibold text-content">{state.tournamentName}</span>
            </p>
            <div className="flex flex-col gap-2">
              <Link href={`/tournaments/${state.tournamentId}`}>
                <Button variant="primary" className="w-full">Перейти к турниру</Button>
              </Link>
              <Link href="/tournaments">
                <Button variant="outline" className="w-full">Все турниры</Button>
              </Link>
            </div>
          </>
        )}

        {state.kind === 'error' && (
          <>
            <FaExclamationTriangle className="w-16 h-16 mx-auto mb-4 text-rose-500" />
            <h1 className="text-xl font-bold text-content mb-2">Приглашение недействительно</h1>
            <p className="text-content-muted mb-6">{state.message}</p>
            <Link href="/">
              <Button variant="outline" className="w-full">На главную</Button>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
