
import "next-auth";
import "next-auth/jwt";
import type { AppRole } from "@/lib/security-db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appUserId?: string;
    role?: AppRole;
  }
}
