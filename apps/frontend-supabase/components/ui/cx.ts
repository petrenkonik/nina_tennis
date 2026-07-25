import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Компонует классы: clsx (условные/массивы) + tailwind-merge (убирает
 * конфликтующие Tailwind-классы, последний побеждает).
 *
 * @example cx('px-2', condition && 'bg-red-500', { 'text-white': active })
 */
export function cx(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
