import { API_URL } from 'app/lib/avatar';
import React from 'react';
import BracketPlayerMini from './BracketPlayerMini';
import { Player } from '@shared/models/tennis';

export type RoundProps = {
  title: string;
  seeds: Array<{
    id: string;
    teams: Player[];
    score?: string;
    scheduledAt?: string;
    playedAt?: string | null;
    winner?: string | null;
    court?: string;
    status?: string;
  }>;
};

interface SimpleBracketProps {
  rounds: RoundProps[];
}

const SimpleBracket: React.FC<SimpleBracketProps> = ({ rounds }) => {
  return (
    <div className="flex flex-row gap-0 overflow-x-auto py-4">
      {rounds.map((round, idx) => {
        const matchHeight = 120; // px
        const gap = 0; // px
        // Для первого раунда — обычный gap, для остальных — первый матч сдвигается на полкарточки вниз
        return (
          <div key={idx} className="flex flex-col items-center flex-1" data-testid={`round-${idx}`}
            style={{ minWidth: 320 }}
          >
            <div className="font-bold mb-2">{round.title}</div>
            {round.seeds.map((match, mIdx) => (
              <div
                key={mIdx}
                className="m-0 p-2 border rounded bg-white shadow min-w-[200px] w-full text-center flex flex-row items-center justify-between  gap-0"
                style={{
                  //marginTop: idx === 0 ? (mIdx === 0 ? 0 : gap) : (mIdx === 0 ? ((2 ** (idx-1))*(matchHeight + gap)) / 2 : (2 ** (idx-1))*(matchHeight + gap)),
                  height: matchHeight*(2 ** (idx)),
                  transition: 'margin 0.3s',
                }}
              >
                <div className="flex flex-col items-start gap-2 min-w-[110px]">
                  <BracketPlayerMini player={match.teams[0]} /> 
                  <BracketPlayerMini player={match.teams[1]} /> 
                </div>
                <div className="flex flex-row items-center justify-center flex-1 gap-0">

                  <div className="flex flex-col items-center justify-center flex-1">
                  {match.winner && typeof match.winner === 'string' && match.teams && (() => {
                      const winnerPlayer = match.teams.find(t => t._id === match.winner);
                      if (!winnerPlayer) return null;
                      return (
                        <div className="text-xs text-purple-700 font-semibold text-center">
                           {winnerPlayer.fullName}
                        </div>
                      );
                    })()}
                    {match.score && <div className="text-xs text-center text-gray-800">{match.score}</div>}
                    <div className="h-0.5 w-full bg-gray-400 my-1" />

                    {((match.playedAt || match.scheduledAt) && (
                      <div className="text-xs text-blue-500 mb-1">
                        {(() => {
                          const dt = new Date(match.playedAt || match.scheduledAt);
                          const dateStr = dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
                          const timeStr = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });
                          return `${timeStr}, ${dateStr}`;
                        })()}
                      </div>
                    ))}
                    {match.court && (
                      <div className="text-xs text-gray-600"> {match.court}</div>
                    )}
                  </div>
                  
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default SimpleBracket; 