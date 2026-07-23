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

// Все матчи турнира (по всем группам) — для календаря/расписания
export async function getTournamentMatches(id: string) {
  const res = await fetch(`${API_URL}/tournaments/${id}/matches`);
  if (!res.ok) throw new Error('Ошибка загрузки матчей турнира');
  return res.json();
}

// ===== СУДЬИ (referees) =====

// Список судей турнира (с кол-вом отсуженных матчей)
export async function getTournamentReferees(id: string) {
  const res = await fetch(`${API_URL}/tournaments/${id}/referees`);
  if (!res.ok) throw new Error('Ошибка загрузки судей');
  return res.json();
}

// Сгенерировать ссылку-приглашение судей (админ)
export async function generateRefereeInvite(id: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/tournaments/${id}/referee-invite`, {
    method: 'POST',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!res.ok) throw new Error('Ошибка генерации приглашения');
  return res.json();
}

// Принять приглашение стать судьёй (авторизованный пользователь)
export async function acceptRefereeInvite(token: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/tournaments/referee-invite/${token}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(res.status === 404 ? 'Приглашение недействительно' : (txt || 'Ошибка принятия приглашения'));
  }
  return res.json();
}

// Удалить судью из турнира (админ)
export async function removeReferee(id: string, userId: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/tournaments/${id}/referees/${userId}`, {
    method: 'DELETE',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!res.ok) throw new Error('Ошибка удаления судьи');
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

// Все матчи игрока (player1 или player2) — для страницы участника
export async function getPlayerMatches(id: string) {
  const res = await fetch(`${API_URL}/players/${id}/matches`);
  if (!res.ok) throw new Error('Ошибка загрузки матчей игрока');
  return res.json();
}

export async function updatePlayer(id: string, data: any, accessToken?: string) {
  const res = await fetch(`${API_URL}/players/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Ошибка обновления игрока');
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

// Профиль текущего пользователя
export async function getMyProfile(accessToken?: string) {
  const res = await fetch(`${API_URL}/users/me`, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!res.ok) throw new Error('Ошибка загрузки профиля');
  return res.json();
}

// Обновление собственного профиля
export async function updateMyProfile(data: { firstName?: string; lastName?: string; email?: string; password?: string }, accessToken?: string) {
  const res = await fetch(`${API_URL}/users/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(res.status === 409 ? 'Email уже используется' : (txt || 'Ошибка обновления профиля'));
  }
  return res.json();
}

// Обновление пользователя администратором (имя, фамилия)
export async function updateUser(id: string, data: { firstName?: string; lastName?: string }, accessToken?: string) {
  const res = await fetch(`${API_URL}/users/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Ошибка обновления пользователя');
  return res.json();
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

export async function getMatch(id: string) {
  const res = await fetch(`${API_URL}/matches/${id}`);
  if (!res.ok) throw new Error('Ошибка загрузки матча');
  return res.json();
}

export async function addMatch(groupId: string, data: any, accessToken?: string) {
  const res = await fetch(`${API_URL}/groups/${groupId}/matches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Ошибка добавления матча');
  return res.json();
}

export async function updateMatch(groupId: string, matchId: string, data: any, accessToken?: string) {
  const res = await fetch(`${API_URL}/groups/${groupId}/matches/${matchId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Ошибка обновления матча');
  return res.json();
}

export async function deleteMatch(groupId: string, matchId: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/groups/${groupId}/matches/${matchId}`, {
    method: 'DELETE',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!res.ok) throw new Error('Ошибка удаления матча');
  return res.json();
}

export async function generateMatches(groupId: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/groups/${groupId}/generate-matches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!res.ok) throw new Error('Ошибка генерации матчей');
  return res.json();
}

export async function uploadPlayerAvatar(playerId: string, file: File, accessToken?: string) {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await fetch(`${API_URL}/players/${playerId}/avatar`, {
    method: 'POST',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) throw new Error('Ошибка загрузки аватара');
  return res.json();
}

export function getPlayerAvatarUrl(photoUrl: string): string {
  if (!photoUrl) return '';
  if (photoUrl.startsWith('http')) return photoUrl;
  return `${API_URL}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;
}

export async function deletePlayerAvatar(playerId: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/players/${playerId}/avatar`, {
    method: 'DELETE',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!res.ok) throw new Error('Ошибка удаления аватара');
  return res.json();
} 