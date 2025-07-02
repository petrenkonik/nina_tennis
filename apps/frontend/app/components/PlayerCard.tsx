import React from 'react';
import { API_URL } from 'app/lib/api';
import { Player } from '@shared/models/tennis';

export default function PlayerCard({ player }: { player: Player }) {
  // Формируем полный путь к фото
  const photoSrc = player.photoUrl?.startsWith('/') ? `${API_URL}${player.photoUrl}` : player.photoUrl;
  return (
    <li key={player._id} className="border rounded p-3 bg-gray-50 flex items-center gap-3">
      <img
        src={photoSrc}
        alt={player.fullName}
        className="w-10 h-10 rounded-full object-cover border"
      />
      <div>
        <div className="font-medium">{player.fullName}</div>
        <div>
          <span className="text-xs text-gray-500">{player.gender} {player.birthYear}</span>
          <span className="text-xxs pl-2">{player.club}</span>
        </div>
      </div>
    </li>
  );
} 