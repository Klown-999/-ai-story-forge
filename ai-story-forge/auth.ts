
import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import type { AppRole } from "@/lib/security-db";
import { getAppUserByEmail, upsertAppUserFromOAuth } from "@/lib/security-db";
import { logAuditEvent } from "@/lib/audit-log";

type GoogleProfileLike = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

function splitEmails(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function resolveRoleForEmail(email: string): AppRole {
  const normalized = email.toLowerCase();

  const adminEmails = splitEmails(process.env.ADMIN_EMAILS);
  const editorEmails = splitEmails(process.env.EDITOR_EMAILS);
  const viewerEmails = splitEmails(process.env.VIEWER_EMAILS);

  if (adminEmails.includes(normalized)) return "admin";
  if (editorEmails.includes(normalized)) return "editor";
  if (viewerEmails.includes(normalized)) return "viewer";

  // default fallback
  return "viewer";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;

      const googleProfile = (profile ?? {}) as GoogleProfileLike;

      const email =
        typeof googleProfile.email === "string" ? googleProfile.email : "";

      const emailVerified =
        typeof googleProfile.email_verified === "boolean"
          ? googleProfile.email_verified
          : false;

      if (!email || !emailVerified) {
        return false;
      }

      const role = resolveRoleForEmail(email);

      const appUser = upsertAppUserFromOAuth({
        email,
        name:
          typeof googleProfile.name === "string" && googleProfile.name.trim()
            ? googleProfile.name
            : email,
        image:
          typeof googleProfile.picture === "string" &&
          googleProfile.picture.trim()
            ? googleProfile.picture
            : null,
        provider: "google",
        role,
      });

      logAuditEvent({
        userId: appUser.id,
        userEmail: appUser.email,
        action: "sign_in",
        entityType: "session",
        entityId: null,
        message: `User signed in with Google as ${appUser.role}.`,
      });

      return true;
    },

    async jwt({ token }) {
      if (typeof token.email === "string" && token.email) {
        const appUser = getAppUserByEmail(token.email);

        if (appUser) {
          token.role = appUser.role;
          token.appUserId = appUser.id;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id =
          typeof token.appUserId === "string" ? token.appUserId : "";

        session.user.role =
          typeof token.role === "string"
            ? (token.role as AppRole)
            : "viewer";
      }

      return session;
    },
  },
});
``
