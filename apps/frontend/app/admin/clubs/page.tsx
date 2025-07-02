"use client";
import React, { useEffect, useState } from 'react';
import AdminMenu from 'components/AdminMenu';
import { getClubs, createClub, updateClub, deleteClub } from 'app/lib/api';
import { useSession } from 'next-auth/react';

export default function ClubsPage() {
  const [clubs, setClubs] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  useEffect(() => {
    getClubs().then(setClubs);
  }, []);

  function startEdit(club: any) {
    setEditingId(club._id);
    setEditName(club.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
  }

  async function saveEdit(id: string) {
    await updateClub(id, { name: editName }, accessToken);
    getClubs().then(setClubs);
    setEditingId(null);
    setEditName('');
  }

  async function handleDelete(id: string) {
    await deleteClub(id, accessToken);
    getClubs().then(setClubs);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    await createClub({ name: newName }, accessToken);
    getClubs().then(setClubs);
    setNewName('');
  }

  return (
    <main className="max-w-xl mx-auto py-8 px-2 pb-24">
      <AdminMenu className="hidden md:flex" />
      <h1 className="text-2xl font-extrabold mb-6">Клубы</h1>
      <div className="mb-4 flex gap-2">
        <input
          className="border rounded px-3 py-2"
          placeholder="Новый клуб"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={handleAdd}
        >Добавить</button>
      </div>
      <div className="bg-white rounded shadow divide-y">
        {clubs.map(club => (
          <div key={club._id} className="flex items-center gap-2 p-3">
            {editingId === club._id ? (
              <>
                <input
                  className="border rounded px-2 py-1 flex-1"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  autoFocus
                />
                <button className="px-2 py-1 bg-green-500 text-white rounded" onClick={() => saveEdit(club._id)}>Сохранить</button>
                <button className="px-2 py-1 bg-gray-200 rounded" onClick={cancelEdit}>Отмена</button>
              </>
            ) : (
              <>
                <span className="flex-1">{club.name}</span>
                <button className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded" onClick={() => startEdit(club)}>Редактировать</button>
                <button className="px-2 py-1 bg-red-100 text-red-700 rounded" onClick={() => handleDelete(club._id)}>Удалить</button>
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
} 