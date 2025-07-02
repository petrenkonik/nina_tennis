export interface Group {
  _id?: string;
  name: string;
  players: any[]; // или Player[] если нужно
  matches: any[]; // или Match[] если нужно
  seededPlayers?: { player: string; seed: number }[];
} 