"use client";
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, Suspense } from 'react';

function LoginInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading' || !session) return;
    // Если есть next (напр. /invite/<token>) — возвращаем туда после входа.
    if (next) {
      router.replace(next);
      return;
    }
    if (session?.user?.role === 'admin') {
      router.replace('/admin/tournaments');
    } else if (session?.user?.role === 'referee') {
      router.replace('/tournaments');
    }
  }, [session, status, router, next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });
    if (res?.error) setError('Неверный логин или пароль');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow w-full max-w-xs">
        <h1 className="text-xl font-bold mb-4 text-center">Вход</h1>
        <input
          className="border rounded px-3 py-2 mb-2 w-full"
          placeholder="Логин"
          value={username}
          onChange={e => setUsername(e.target.value)}
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
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-semibold">Войти</button>
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