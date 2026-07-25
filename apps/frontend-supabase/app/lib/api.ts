/**
 * Единая точка импорта API-функций для UI.
 *
 * Старый фронт импортировал всё из 'app/lib/api'. Здесь реэкспортируем
 * доменные модули, сохраняя те же имена функций, что и раньше —
 * поэтому UI-страницы копируются из apps/frontend почти без правок.
 *
 * Функции — Server Actions ('use server' в модулях), вызываются с клиента.
 *
 * Авторизация: в новой версии работает через next-auth credentials-провайдер
 * (app/api/auth/[...nextauth]/route.ts) напрямую, поэтому отдельного
 * loginUser() здесь нет. Регистрация — createUser из ./api/users.
 */

export * from './api/tournaments';
export * from './api/groups';
export * from './api/matches';
export * from './api/players';
export * from './api/clubs';
export * from './api/referees';
export * from './api/users';
