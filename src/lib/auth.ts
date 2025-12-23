import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const defaultTenantId = "default-tenant";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: env.nextAuthSecret || process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            memberships: { include: { tenant: true }, take: 1 },
          },
        });
        if (!user) return null;

        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        const membership = user.memberships[0];
        const tenantId = membership?.tenantId ?? defaultTenantId;

        return {
          id: user.id,
          email: user.email,
          tenantId,
          role: membership?.role ?? "admin",
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as any).id;
        token.tenantId = (user as any).tenantId ?? defaultTenantId;
        token.role = (user as any).role ?? "admin";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId as string;
        (session.user as any).tenantId = token.tenantId as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};




