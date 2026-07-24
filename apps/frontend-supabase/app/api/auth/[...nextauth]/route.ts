import NextAuth from 'next-auth';
import { authOptions } from 'app/lib/authOptions';

// Дополнения типов next-auth: роль и id пользователя в сессии/JWT.
declare module 'next-auth' {
  interface Session {
    // accessToken не используется в новой версии (Server Actions сами знают сессию),
    // но оставлен как optional для совместимости со старым UI, который его читает.
    accessToken?: string;
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    role?: string;
  }
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
