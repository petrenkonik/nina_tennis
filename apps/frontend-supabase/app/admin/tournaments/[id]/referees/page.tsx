"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import RequireAdmin from 'components/RequireAdmin';
import AdminMenu from 'components/AdminMenu';
import { Card, CardBody, Button, Skeleton } from 'components/ui';
import { FaLink, FaCopy, FaCheck, FaTrash, FaUserTie, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import {
  getTournamentById,
  getTournamentReferees,
  generateRefereeInvite,
  removeReferee,
  updateUser,
} from 'app/lib/api';
import type { Tournament } from '@shared/models/tennis';

interface Referee {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  matchesJudged: number;
}

export default function RefereesPage() {
  return (
    <RequireAdmin>
      <RefereesContent />
    </RequireAdmin>
  );
}

function RefereesContent() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
      const [tournament, setTournament] = useState<Tournament | null>(null);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [t, refs] = await Promise.all([
        getTournamentById(id).catch(() => null),
        getTournamentReferees(id),
      ]);
      if (t) setTournament(t as Tournament);
      setReferees((refs || []) as Referee[]);
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const { token } = await generateRefereeInvite(id);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setInviteUrl(`${origin}/invite/${token}`);
      setCopied(false);
    } catch (e: any) {
      setError(e.message || 'Не удалось создать ссылку');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard может быть недоступен
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Удалить судью из турнира?')) return;
    try {
      await removeReferee(id, userId);
      setReferees((rs) => rs.filter((r) => r._id !== userId));
    } catch (e: any) {
      setError(e.message || 'Ошибка удаления');
    }
  };

  // Inline-редактирование имени/фамилии судьи
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (r: Referee) => {
    setEditingId(r._id);
    setEditFirst(r.firstName || '');
    setEditLast(r.lastName || '');
    setError('');
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditFirst('');
    setEditLast('');
  };
  const saveEdit = async (userId: string) => {
    setSavingEdit(true);
    setError('');
    try {
      const updated = await updateUser(userId, { firstName: editFirst, lastName: editLast });
      setReferees((rs) => rs.map((r) => r._id === userId ? { ...r, firstName: updated.firstName, lastName: updated.lastName } : r));
      setEditingId(null);
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSavingEdit(false);
    }
  };

  const title = `Судьи${tournament?.name ? ' · ' + tournament.name : ''}`;

  return (
    <main className="max-w-4xl mx-auto py-8 px-4 pb-24 md:pt-24">
      <AdminMenu />
      <h1 className="text-2xl font-bold mb-6">{title}</h1>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4">
        <Link href="/admin/tournaments" className="text-brand-600 dark:text-brand-400 underline text-sm">
          ← К турнирам
        </Link>
      </div>

      {/* Приглашение */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center gap-2 mb-3">
            <FaLink className="text-brand-500" />
            <h2 className="font-bold text-content">Ссылка-приглашение</h2>
          </div>
          <p className="text-sm text-content-muted mb-3">
            Отправьте эту ссылку судьям. Любой, кто зарегистрируется или войдёт по ней, станет судьёй этого турнира и сможет судить любые матчи.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? 'Создаём…' : (inviteUrl ? 'Обновить ссылку' : 'Создать ссылку')}
            </Button>
            {inviteUrl && (
              <Button variant={copied ? 'success' : 'outline'} onClick={handleCopy}>
                {copied ? <><FaCheck /> Скопировано</> : <><FaCopy /> Копировать</>}
              </Button>
            )}
          </div>
          {inviteUrl && (
            <div className="mt-3 rounded-lg border border-surface-border bg-surface-muted px-3 py-2 font-mono text-xs break-all text-content">
              {inviteUrl}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Список судей */}
      <h2 className="font-bold text-content mb-2 flex items-center gap-2">
        <FaUserTie /> Судьи
        <span className="text-sm font-normal text-content-muted">({referees.length})</span>
      </h2>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : referees.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12 text-content-muted">
            <FaUserTie className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Судей пока нет</p>
            <p className="text-xs mt-1">Создайте ссылку-приглашение выше и отправьте судьям</p>
          </CardBody>
        </Card>
      ) : (
        <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-content-muted text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Фамилия и имя</th>
                <th className="text-center px-3 py-2 font-semibold">Отсужено</th>
                <th className="text-right px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {referees.map((r) => {
                const name = [r.lastName, r.firstName].filter(Boolean).join(' ').trim() || r.email;
                const isEditing = editingId === r._id;
                return (
                  <tr key={r._id} className="border-t border-surface-border">
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <input
                            className="border border-surface-border rounded px-2 py-1 text-sm bg-surface-card text-content w-32"
                            placeholder="Фамилия"
                            value={editLast}
                            onChange={(e) => setEditLast(e.target.value)}
                            autoFocus
                          />
                          <input
                            className="border border-surface-border rounded px-2 py-1 text-sm bg-surface-card text-content w-32"
                            placeholder="Имя"
                            value={editFirst}
                            onChange={(e) => setEditFirst(e.target.value)}
                          />
                        </div>
                      ) : (
                        <div className="font-medium text-content">{name}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center justify-center min-w-[1.75rem] px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-bold text-xs">
                        {r.matchesJudged}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {isEditing ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => saveEdit(r._id)}
                            disabled={savingEdit}
                            className="text-emerald-600 hover:text-emerald-700 transition-colors p-1 disabled:opacity-40"
                            title="Сохранить"
                            aria-label="Сохранить"
                          >
                            <FaSave />
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={savingEdit}
                            className="text-content-muted hover:text-content transition-colors p-1 disabled:opacity-40"
                            title="Отмена"
                            aria-label="Отмена"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => startEdit(r)}
                            className="text-content-muted hover:text-brand-600 transition-colors p-1"
                            title="Изменить"
                            aria-label="Изменить"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleRemove(r._id)}
                            className="text-content-muted hover:text-rose-500 transition-colors p-1"
                            title="Удалить судью"
                            aria-label="Удалить судью"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
