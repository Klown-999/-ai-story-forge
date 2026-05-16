
import { auth } from "@/auth";

export type AppRole = "admin" | "editor" | "viewer";

function parseEmailList(value?: string) {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getRoleFromEmail(email?: string | null): AppRole {
  const normalized = (email || "").trim().toLowerCase();

  const admins = parseEmailList(process.env.ADMIN_EMAILS);
  const editors = parseEmailList(process.env.EDITOR_EMAILS);
  const viewers = parseEmailList(process.env.VIEWER_EMAILS);

  if (admins.includes(normalized)) return "admin";
  if (editors.includes(normalized)) return "editor";
  if (viewers.includes(normalized)) return "viewer";

  // Default fallback role
  return "viewer";
}

export async function requireAppUser(
  allowedRoles?: AppRole[]
): Promise<
  | {
      ok: true;
      user: {
        id: string;
        email: string;
        name: string;
        role: AppRole;
      };
    }
  | {
      ok: false;
      message: string;
      status: number;
    }
> {
  const session = await auth();

  if (!session?.user?.email) {
    return {
      ok: false,
      message: "Unauthorized",
      status: 401,
    };
  }

  const role = getRoleFromEmail(session.user.email);

  const user = {
    id: session.user.email,
    email: session.user.email,
    name: session.user.name || session.user.email,
    role,
  };

  if (allowedRoles && !allowedRoles.includes(role)) {
    return {
      ok: false,
      message: "Forbidden",
      status: 403,
    };
  }

  return {
    ok: true,
    user,
  };
}
