import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { getDb } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const db = getDb();
        const user = db
          .prepare("SELECT * FROM users WHERE email = ?")
          .get(credentials.email) as any;

        if (!user || !user.password_hash) return null;

        const valid = bcrypt.compareSync(credentials.password, user.password_hash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId;
        (session.user as any).role = token.role;
      }
      return session;
    },
    async signIn({ user, account }) {
      // For GitHub login, link to existing user by email or create one
      if (account?.provider === "github" && user.email) {
        const db = getDb();
        const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(user.email) as any;
        if (!existing) {
          const id = `usr-${user.email.split("@")[0]}`;
          db.prepare("INSERT INTO users (id, name, email, role, image) VALUES (?, ?, ?, ?, ?)").run(
            id,
            user.name || user.email.split("@")[0],
            user.email,
            "user",
            user.image || null
          );
        }
      }
      return true;
    },
  },
};
