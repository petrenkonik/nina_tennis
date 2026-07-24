import { getServerSession } from 'next-auth';
import { authOptions } from './authOptions';
import type { AuthUser } from './auth';

/**
 * Получение текущего пользователя на сервере (Server Actions / Server Components).
 * Замена ReqContext user из NestJS (req.user = { userId, role }).
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email || '',
    role: (session.user.role as AuthUser['role']) || 'user',
    firstName: null,
    lastName: null,
  };
}
