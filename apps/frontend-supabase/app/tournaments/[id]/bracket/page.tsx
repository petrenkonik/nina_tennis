"use client";
// @ts-ignore
import { RoundProps } from "@/components/SimpleBracket";
import SimpleBracket from "components/SimpleBracket";

const rounds: RoundProps[] = [
  {
    title: "1/4 финала",
    seeds: [
      {
        id: "1",
        teams: [{ name: "Игрок 1" }, { name: "Игрок 2" }],
        score: "6:4, 7:5",
        scheduledAt: "2024-06-01T10:00:00Z",
        playedAt: "2024-06-01T10:05:00Z",
        winner: "Игрок 1",
        court: "Корт 1",
      },
      {
        id: "2",
        teams: [{ name: "Игрок 3" }, { name: "Игрок 4" }],
        score: "6:2, 6:3",
        scheduledAt: "2024-06-01T11:00:00Z",
        playedAt: "2024-06-01T11:10:00Z",
        winner: "Игрок 3",
        court: "Корт 2",
      },
      {
        id: "3",
        teams: [{ name: "Игрок 5" }, { name: "Игрок 6" }],
        score: "7:5, 6:7, 6:2",
        scheduledAt: "2024-06-01T12:00:00Z",
        playedAt: null,
        winner: null,
        court: "Корт 3",
      },
      {
        id: "4",
        teams: [{ name: "Игрок 7" }, { name: "Игрок 8" }],
        score: "6:0, 6:1",
        scheduledAt: "2024-06-01T13:00:00Z",
        playedAt: null,
        winner: null,
        court: "Корт 4",
      },
    ],
  },
  {
    title: "1/2 финала",
    seeds: [
      {
        id: "5",
        teams: [{ name: "Игрок 1" }, { name: "Игрок 3" }],
        score: "6:3, 6:4",
        scheduledAt: "2024-06-02T10:00:00Z",
        playedAt: null,
        winner: null,
      },
      {
        id: "6",
        teams: [{ name: "Игрок 5" }, { name: "Игрок 7" }],
        score: "6:2, 6:2",
        scheduledAt: "2024-06-02T11:00:00Z",
        playedAt: null,
        winner: null,
      },
    ],
  },
  {
    title: "Финал",
    seeds: [
      {
        id: "7",
        teams: [{ name: "Игрок 1" }, { name: "Игрок 5" }],
        score: "6:4, 6:4",
        scheduledAt: "2024-06-03T10:00:00Z",
        playedAt: null,
        winner: null,
      },
    ],
  },
];

export default function BracketPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Турнирная сетка</h1>
      <SimpleBracket rounds={rounds} />
    </div>
  );
} 