"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getTournaments } from 'app/lib/client';
import AdminMenu from 'components/AdminMenu';
import { Button } from 'components/ui';

/**
 * Шорткат /admin/groups: сразу перекидывает на последний турнир → его группы.
 * Если турниров нет — показывает подсказку со ссылкой на создание, а не висит
 * в бесконечном «Загрузка...».
 */
export default function AdminGroupsPage() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    getTournaments()
      .then((all) => {
        if (!all.length) {
          setError(true);
          return;
        }
        // Сортируем по дате начала, берём последний
        const sorted = all
          .slice()
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        const lastId = sorted[0]._id;
        router.replace(`/admin/tournaments/${lastId}/groups`);
      })
      .catch(() => setError(true));
  }, [router]);

  if (error) {
    return (
      <main className="max-w-xl mx-auto py-8 px-2 pb-24">
        <AdminMenu />
        <div className="text-center mt-8">
          <h1 className="text-xl font-bold mb-2 text-content">Группы</h1>
          <p className="text-content-muted mb-4">
            Нет турниров. Сначала создайте турнир и группы.
          </p>
          <Link href="/admin/tournaments">
            <Button variant="primary">К турнирам</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto py-8 px-2 pb-24">
      <AdminMenu />
      <div className="text-center mt-8 text-content-muted">Загрузка...</div>
    </main>
  );
}
