"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import MainLayout from 'app/main-layout';
import { Card, CardBody, Button, Skeleton } from 'components/ui';
import { FaUser, FaSave, FaCheckCircle, FaExclamationTriangle, FaSignOutAlt } from 'react-icons/fa';
import { getMyProfile, updateMyProfile } from 'app/lib/api';
import { signOut } from 'next-auth/react';

interface ProfileData {
  _id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const accessToken = (session as any)?.accessToken;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Поля формы
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.replace('/login?next=/profile');
      return;
    }
    setLoading(true);
    getMyProfile(accessToken)
      .then((p) => {
        setProfile(p);
        setFirstName(p.firstName || '');
        setLastName(p.lastName || '');
        setEmail(p.email || '');
      })
      .catch((e) => setError(e.message || 'Ошибка загрузки профиля'))
      .finally(() => setLoading(false));
  }, [session, status, accessToken, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const data: any = { firstName, lastName, email };
      if (password.trim()) data.password = password;
      const updated = await updateMyProfile(data, accessToken);
      setProfile(updated);
      setPassword('');
      setSaved(true);
      // Если сменили email — старый токен может стать невалидным после перелогина.
      // Показываем успех; пользователь перезайдёт при желании.
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.replace('/login');
  };

  if (status === 'loading' || loading) {
    return (
      <MainLayout header="Профиль">
        <Skeleton className="h-40 w-full max-w-md" />
      </MainLayout>
    );
  }

  if (!session) return null;

  const inputCls = 'border border-surface-border rounded-lg px-3 py-2 bg-surface-card text-content text-sm w-full focus:ring-2 focus:ring-brand-200 outline-none transition';

  const roleLabel = profile?.role === 'admin' ? 'Администратор'
    : profile?.role === 'referee' ? 'Судья'
    : 'Пользователь';

  return (
    <MainLayout header="Профиль">
      {/* Карточка пользователя */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-2xl">
              <FaUser className="text-brand-500" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-lg text-content truncate">
                {[profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.email || 'Профиль'}
              </div>
              <div className="text-sm text-content-muted truncate">{profile?.email}</div>
              <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
                {roleLabel}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Форма редактирования */}
      <Card className="mb-6">
        <CardBody>
          <h2 className="font-bold text-content mb-4">Изменить данные</h2>
          <form onSubmit={handleSave} className="space-y-3 max-w-md">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-content-muted mb-1">Имя</label>
                <input
                  className={inputCls}
                  placeholder="Имя"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-content-muted mb-1">Фамилия</label>
                <input
                  className={inputCls}
                  placeholder="Фамилия"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-content-muted mb-1">Email (логин)</label>
              <input
                className={inputCls}
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-content-muted mb-1">
                Новый пароль <span className="text-content-muted/70">(оставьте пустым, чтобы не менять)</span>
              </label>
              <input
                className={inputCls}
                type="password"
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={password ? 6 : undefined}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm bg-rose-50 dark:bg-rose-900/20 px-3 py-2 rounded-lg">
                <FaExclamationTriangle /> {error}
              </div>
            )}
            {saved && (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg">
                <FaCheckCircle /> Данные сохранены
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={saving}>
                <FaSave /> {saving ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="flex gap-2">
        <Link href="/">
          <Button variant="outline">На главную</Button>
        </Link>
        <Button variant="ghost" className="!text-rose-600" onClick={handleLogout}>
          <FaSignOutAlt /> Выйти
        </Button>
      </div>
    </MainLayout>
  );
}
