import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { NextAuthOptions, User } from 'next-auth';
import { loginUser } from 'app/lib/api';

declare module 'next-auth' {
  interface Session {
    accessToken: string,
    user: {
      name?: string;
      email?: string;
      image?: string;
      role?: string;
    };
  }
  interface User {
    access_token?: string;
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken: string,
    role?: string;
  }
}

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Используем loginUser из lib/api
        try {
          const data = await loginUser(credentials?.username, credentials?.password);
          return {
            ...data.user,
            access_token: data.access_token,
            role: data.user.role,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
   
    async session({ session, token, user }) {
      // Добавляем роль в сессию
      session.accessToken = token.accessToken
      session.user.role = token.role || 'user';
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.access_token
      }
      if (user) token.role = user.role;
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
});

export { handler as GET, handler as POST }; 