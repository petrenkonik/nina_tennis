import React from 'react';

export default function GroupHeader({ tournament, group }: { tournament: any, group: any }) {
  if (!tournament || !group) return null;
  return (
    <span className="block text-base font-normal mt-1 text-gray-600">
      Турнир: {tournament.name} / Группа: {group.name}
    </span>
  );
} 