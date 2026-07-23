import { InternalServerErrorException } from '@nestjs/common';

/**
 * Безопасное получение JWT-секрета.
 *
 * В продакшене (NODE_ENV !== 'development') отсутствие JWT_SECRET — критическая
 * ошибка: приложение не должно запускаться с захардкоженным публичным секретом.
 * В dev/test допускается фиксированный секрет для локальной разработки.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new InternalServerErrorException(
      'JWT_SECRET не задан. Установите переменную окружения JWT_SECRET в продакшене.',
    );
  }

  // Только для локальной разработки / тестов — никогда не для прод.
  console.warn(
    '\x1b[33m⚠️  JWT_SECRET не задан — используется небезопасный dev-секрет. ' +
      'Не используйте в продакшене! Задайте JWT_SECRET.\x1b[0m',
  );
  return 'dev-insecure-secret-change-me';
}
