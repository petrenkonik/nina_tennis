"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTournaments } from 'app/lib/api';
import GroupsEditorPage from '../tournaments/[id]/groups/page';

export default function AdminGroupsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTournaments().then(all => {
      if (!all.length) return;
      // Сортируем по дате начала, берём последний
      const sorted = all.slice().sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      const lastId = sorted[0]._id;
      router.replace(`/admin/tournaments/${lastId}/groups`);
    });
  }, [router]);

  return (
    <main className="max-w-xl mx-auto py-8 px-2 pb-24">
      {loading && <div>Загрузка...</div>}
    </main>
  );
} 