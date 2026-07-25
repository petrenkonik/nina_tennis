"use client";
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, Suspense } from 'react';
import { supabaseBrowser } from 'app/lib/supabase/browser';
import { useSupabaseSession } from 'app/lib/useSupabaseSession';

function LoginInner() {
  const { role, status } = useSupabaseSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    // Если есть next (напр. /invite/<token>) — возвращаем туда после входа.
    if (next) {
      router.replace(next);
      return;
    }
    if (role === 'admin') {
      router.replace('/admin/tournaments');
    } else if (role === 'referee') {
      router.replace('/tournaments');
    } else {
      router.replace('/');
    }
  }, [role, status, router, next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError('Неверный логин или пароль');
    // при успехе onAuthStateChange в хуке обновит status → сработает useEffect выше
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow w-full max-w-xs">
        <h1 className="text-xl font-bold mb-4 text-center">Вход</h1>
        <input
          className="border rounded px-3 py-2 mb-2 w-full"
          placeholder="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          className="border rounded px-3 py-2 mb-4 w-full"
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        {error && <div className="text-red-500 mb-2 text-sm">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-50"
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams требует Suspense-обёртки в Next 15
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
