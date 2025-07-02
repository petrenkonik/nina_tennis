"use client";
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function GroupAdminPage() {
  const { groupId } = useParams() as { groupId: string };
  return (
    <main>
      <Link href={`/admin/groups/${groupId}/bracket`} className="px-4 py-2 bg-blue-600 text-white rounded mb-4 inline-block">Редактор матчей</Link>
    </main>
  );
} 