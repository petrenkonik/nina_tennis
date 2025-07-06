import React from 'react';
import { getPlayerAvatarUrl } from 'app/lib/api';
import type { Player } from '@shared/models/tennis';

interface BracketPlayerMiniProps {
  player?: Player;
  _id?: string;
  fullName?: string;
  photoUrl?: string;
  club?: string;
  seed?: number;
}

const BracketPlayerMini: React.FC<BracketPlayerMiniProps> = (props) => {
  const { player, fullName, photoUrl, club, seed } = props;
  const displayName = player?.fullName ?? fullName ?? 'BYE';
  const displayPhoto = player?.photoUrl ?? photoUrl;
  const displayClub = player?.club ?? club;
  const displaySeed = player?.seed ?? seed;

  if (!displayPhoto) return (
    <span className="flex flex-col">
      <span className="font-medium">{displayName}{typeof displaySeed === 'number' && <span className="ml-1 text-xs text-orange-600">#{displaySeed}</span>}</span>
      {displayClub && <span className="text-xs text-gray-500">{displayClub}</span>}
    </span>
  );
  const photoSrc = getPlayerAvatarUrl(displayPhoto);
  return (
      <span className="flex items-center gap-1">
      <img src={photoSrc} alt={displayName} className="w-8 h-8 rounded-full border object-cover" />
      <span className="flex flex-col">
        <span className="font-medium">{displayName}{typeof displaySeed === 'number' && <span className="ml-1 text-xs text-orange-600">#{displaySeed}</span>}</span>
        {displayClub && <span className="text-xs text-gray-500">{displayClub}</span>}
      </span>
    </span>


  );
};

export default BracketPlayerMini; 