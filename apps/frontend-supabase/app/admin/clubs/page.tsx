"use client";
import React, { useEffect, useState } from 'react';
import AdminMenu from 'components/AdminMenu';
import { Button, Card, Skeleton } from 'components/ui';
import { FaEdit, FaTrash, FaCheck, FaTimes, FaPlus } from 'react-icons/fa';
import { getClubs, createClub, updateClub, deleteClub } from 'app/lib/api';
export default function ClubsPage() {
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
      useEffect(() => {
    getClubs().then((c) => {
      setClubs(c);
      setLoading(false);
    });
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
    setSaving(true);
    try {
      await updateClub(id, { name: editName });
      setClubs(await getClubs());
      setEditingId(null);
      setEditName('');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить клуб?')) return;
    await deleteClub(id);
    setClubs(await getClubs());
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createClub({ name: newName });
      setClubs(await getClubs());
      setNewName('');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'border border-surface-border rounded-lg px-3 py-2 bg-surface-card text-content text-sm';

  return (
    <main className="max-w-xl mx-auto py-8 px-4 pb-24">
      <AdminMenu className="hidden md:flex" />
      <h1 className="text-2xl font-extrabold mb-6">Клубы</h1>

      <Card className="mb-4">
        <div className="p-3 flex gap-2">
          <input
            className={`${inputCls} flex-1`}
            placeholder="Название нового клуба"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={saving || !newName.trim()}>
            <FaPlus /> Добавить
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : clubs.length === 0 ? (
        <div className="text-center py-12 text-content-muted">
          <div className="text-5xl mb-3">🏟️</div>
          <p>Клубов пока нет</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-surface-border">
            {clubs.map((club) => (
              <div key={club._id} className="flex items-center gap-2 p-3">
                {editingId === club._id ? (
                  <>
                    <input
                      className={`${inputCls} flex-1`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(club._id)}
                    />
                    <Button variant="success" size="sm" onClick={() => saveEdit(club._id)} disabled={saving}>
                      <FaCheck />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={cancelEdit}>
                      <FaTimes />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium text-content">{club.name}</span>
                    <Button variant="outline" size="sm" onClick={() => startEdit(club)}>
                      <FaEdit /> Изм.
                    </Button>
                    <Button variant="ghost" size="sm" className="!text-red-600" onClick={() => handleDelete(club._id)}>
                      <FaTrash />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}
