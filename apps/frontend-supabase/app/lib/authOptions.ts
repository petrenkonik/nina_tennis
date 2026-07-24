import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyCredentials } from './auth';
import type { AuthUser } from './auth';

/**
 * Конфигурация next-auth. Вынесена в отдельный модуль, потому что Next.js требует,
 чтобы в файле Route Handler (app/api/.../route.ts) экспортировались только
 * разрешённые имена (GET/POST/etc). См. session.ts — импортирует authOptions отсюда.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Логин', type: 'text' },
        password: { label: 'Пароль', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const user: AuthUser | null = await verifyCredentials(
          credentials.username,
          credentials.password,
        );
        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as AuthUser & { role?: string }).role || 'user';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid;
        session.user.role = token.role || 'user';
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
