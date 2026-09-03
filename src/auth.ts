import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import type { Role } from "@/generated/prisma/client";

// Learner/Facilitator/Admin accounts live entirely in our own DB, separate from
// BookStack's editor accounts — BookStack can only ever be an OIDC/SAML *client*,
// never a provider, so there's no session to share. See architecture plan, section 01.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Email or username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const identifier = credentials?.identifier;
        const password = credentials?.password;
        if (typeof identifier !== "string" || typeof password !== "string") {
          return null;
        }

        // Most accounts log in with their email; accounts created without one (see
        // learner_email_optional / facilitator_email_optional flags) use a username
        // instead — one field on the login form covers both.
        const value = identifier.trim().toLowerCase();
        const user = await prisma.user.findFirst({
          where: { OR: [{ email: value }, { username: value }] },
        });
        if (!user) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        // Defense in depth — loginAction already checks this with a friendlier
        // message before ever calling signIn, but this is the actual gate: nothing
        // reaches a session without it, regardless of which code path calls signIn.
        if (!user.emailVerifiedAt) return null;

        return {
          id: user.id,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          username: user.username,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.username = user.username;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.organizationId = token.organizationId as string;
      session.user.username = token.username as string;
      return session;
    },
  },
});
