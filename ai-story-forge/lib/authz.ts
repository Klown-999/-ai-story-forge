
import { auth } from "@/auth";
import { getAppUserByEmail } from "@/lib/security-db";

export async function requireAppUser(
  roles?: Array<"admin" | "editor" | "viewer">
) {
  const session = await auth();

  if (!session?.user?.email) {
    return {
      ok: false as const,
      status: 401,
      message: "Authentication required",
    };
  }

  const appUser = getAppUserByEmail(session.user.email);

  if (!appUser) {
    return {
      ok: false as const,
      status: 403,
      message: "User record not found",
    };
  }

  if (roles && !roles.includes(appUser.role)) {
    return {
      ok: false as const,
      status: 403,
      message: "Forbidden",
    };
  }

  return {
    ok: true as const,
    user: {
      id: appUser.id,
      email: appUser.email,
      name: appUser.name,
      role: appUser.role,
      provider: appUser.provider,
    },
  };
}
