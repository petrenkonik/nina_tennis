export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3101';

// Турниры
export async function getTournaments() {
  const res = await fetch(`${API_URL}/tournaments`);
  if (!res.ok) throw new Error('Ошибка загрузки турниров');
  return res.json();
}

export async function getTournamentById(id: string) {
  const res = await fetch(`${API_URL}/tournaments/${id}`);
  if (!res.ok) throw new Error('Ошибка загрузки турнира');
  return res.json();
}

// Игроки
export async function getPlayers() {
  const res = await fetch(`${API_URL}/players`);
  if (!res.ok) throw new Error('Ошибка загрузки игроков');
  return res.json();
}

export async function getPlayerById(id: string) {
  const res = await fetch(`${API_URL}/players/${id}`);
  if (!res.ok) throw new Error('Ошибка загрузки игрока');
  return res.json();
}

// Группы
export async function getGroups() {
  const res = await fetch(`${API_URL}/groups`);
  if (!res.ok) throw new Error('Ошибка загрузки групп');
  return res.json();
}

export async function getGroupById(id: string) {
  const res = await fetch(`${API_URL}/groups/${id}`);
  if (!res.ok) throw new Error('Ошибка загрузки группы');
  return res.json();
}

// Посеянные игроки группы
export async function getSeededPlayers(groupId: string) {
  const res = await fetch(`${API_URL}/groups/${groupId}/players/seeded`);
  if (!res.ok) throw new Error('Ошибка загрузки посеянных игроков');
  return res.json();
}

// Турнирная сетка группы
export async function getGroupBracket(groupId: string) {
  const res = await fetch(`${API_URL}/tournaments/groups/${groupId}/bracket`);
  if (!res.ok) throw new Error('Ошибка загрузки турнирной сетки группы');
  return res.json();
}

// Клубы
export async function getClubs() {
  const res = await fetch(`${API_URL}/clubs`);
  if (!res.ok) throw new Error('Ошибка загрузки клубов');
  return res.json();
}

export async function createTournament(data: any, accessToken?: string) {
  const res = await fetch(`${API_URL}/tournaments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Ошибка создания турнира');
  return res.json();
}

export async function updateTournament(id: string, data: any, accessToken?: string) {
  const res = await fetch(`${API_URL}/tournaments/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Ошибка обновления турнира');
  return res.json();
}

export async function deleteTournament(id: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/tournaments/${id}`, {
    method: 'DELETE',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!res.ok) throw new Error('Ошибка удаления турнира');
  return res.json();
}

export async function loginUser(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Ошибка авторизации');
  return res.json(); // { access_token, user }
}

export async function createGroup(data: any, accessToken?: string) {
  const res = await fetch(`${API_URL}/groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Ошибка создания группы');
  return res.json();
}

export async function updateGroup(id: string, data: any, accessToken?: string) {
  const res = await fetch(`${API_URL}/groups/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Ошибка обновления группы');
  return res.json();
}

export async function deleteGroup(id: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/groups/${id}`, {
    method: 'DELETE',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!res.ok) throw new Error('Ошибка удаления группы');
  return res.json();
}

export async function createPlayer(data: any, accessToken?: string) {
  const res = await fetch(`${API_URL}/players`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Ошибка создания пользователя');
  return res.json();
}

export async function createClub(data: { name: string }, accessToken?: string) {
  const res = await fetch(`${API_URL}/clubs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Ошибка создания клуба');
  return res.json();
}

export async function updateClub(id: string, data: { name: string }, accessToken?: string) {
  const res = await fetch(`${API_URL}/clubs/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Ошибка обновления клуба');
  return res.json();
}

export async function deleteClub(id: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/clubs/${id}`, {
    method: 'DELETE',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!res.ok) throw new Error('Ошибка удаления клуба');
  return res.json();
}

export async function getGroupMatches(groupId: string) {
  const res = await fetch(`${API_URL}/groups/${groupId}/matches`);
  if (!res.ok) throw new Error('Ошибка загрузки матчей группы');
  return res.json();
} 