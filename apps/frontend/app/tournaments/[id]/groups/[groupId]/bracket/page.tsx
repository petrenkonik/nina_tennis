"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MainLayout from "app/main-layout";
import SimpleBracket, { RoundProps } from "components/SimpleBracket";
import { getClubs, getGroupBracket, getGroupById, getTournamentById } from 'app/lib/api';
import { Tournament } from "@shared/models/tennis";


export default function BracketPage() {
  const params = useParams();
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [rounds, setRounds] = useState<RoundProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [group, setGroup] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchTournament() {
      setError('');
      try {
        const foundGroup = await getGroupById(groupId);
        if (!foundGroup) throw new Error('Группа не найдена');
        setGroup(foundGroup);
        setTournament(await getTournamentById(id));
        //setClubs(await getClubs());
      } catch (e: any) {
        setError(e.message || 'Ошибка');
      }
      setLoading(false);
    }
    if (id) fetchTournament();

    if (!groupId) return;
    getGroupBracket(groupId)
      .then(data => {
        setRounds(data.rounds || []);
        setLoading(false);
      });
      
  }, [id,groupId]);
  if (loading) return <MainLayout header="Сетка">Загрузка...</MainLayout>;

  return (
    <MainLayout header={"Турнирная сетка-"+tournament?.name+":"+group?.name}>
      <div className="mb-4">
        <Link href="./" className="text-blue-600 underline">← К списку участников</Link>
      </div>
      <div className="p-4">
        <SimpleBracket rounds={rounds} />
      </div>
    </MainLayout>
  );
} 