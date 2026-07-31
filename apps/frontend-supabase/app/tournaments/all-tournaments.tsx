"use client";
import { Tournament } from '@shared/models/tennis';
import React, { useState, useEffect } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import MainMenu from '../../components/MainMenu';
import Link from 'next/link';
import { getTournaments, getClubs } from 'app/lib/client';
import MainLayout from 'app/main-layout';

const ageOptions = ["Все", "U18", "U21"];
const genderOptions = ["Все", "М", "Ж"];

export default function AllTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [age, setAge] = useState('Все');
  const [gender, setGender] = useState('Все');

  useEffect(() => {
    const fetchTournaments = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getTournaments();
        setTournaments(data);
        setClubs(await getClubs());
      } catch (e: any) {
        setError(e.message || 'Ошибка');
      } finally {
        setLoading(false);
      }
    };
    fetchTournaments();
  }, []);

  const filtered = tournaments.filter(t => {
    const nameMatch = t.name.toLowerCase().includes(search.toLowerCase());
    if (age === 'Все' && gender === 'Все') return nameMatch;
    if (!t.groups || t.groups.length === 0) return false;
    const groupMatch = t.groups.some(g => {
      const ageOk = age === 'Все' || g.name.includes(age);
      const genderOk = gender === 'Все' || g.name.includes(gender);
      return ageOk && genderOk;
    });
    return nameMatch && groupMatch;
  });

  return (
    <section>
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Поиск по названию..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-2 w-full max-w-xs"
        />
        <Select value={age} onValueChange={setAge} data-testid="age-select">
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Возраст" />
          </SelectTrigger>
          <SelectContent>
            {ageOptions.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={gender} onValueChange={setGender} data-testid="gender-select">
          <SelectTrigger className="w-[80px]">
            <SelectValue placeholder="Пол" />
          </SelectTrigger>
          <SelectContent>
            {genderOptions.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-4">
        {loading && <div className="text-gray-500">Загрузка...</div>}
        {error && <div className="text-red-500">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-gray-500">Нет турниров</div>
        )}
        {!loading && !error && filtered.map(t => {
          const clubName = t.clubId ? clubs.find(c => c._id === t.clubId)?.name : null;
          return (
            <Link
              key={t._id}
              href={`/tournaments/${t._id}/`}
              className="block border rounded p-4 shadow hover:shadow-md transition hover:bg-blue-50"
            >
              <div className="font-semibold text-lg">{t.name}</div>
              {clubName && <div className="text-blue-700 text-xs mb-1">Клуб: {clubName}</div>}
              <div className="text-sm text-gray-500">
                {new Date(t.startDate).toLocaleDateString('ru-RU')} — {new Date(t.endDate).toLocaleDateString('ru-RU')}
              </div>
              {t.groups && t.groups.length > 0 && (
                <div className="text-xs text-gray-600 mt-2">
                  Группы: {t.groups.map(g => g.name).join(', ')}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
} 