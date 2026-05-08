
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

import { auth, signOut } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logAuditEvent } from "@/lib/audit-log";

export const metadata: Metadata = {
  title: "AI Story Forge",
  description: "PRD to Stories with authenticated run management",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  const displayName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "Signed-in user";

  const displayEmail = session?.user?.email || "";
  const displayRole = session?.user?.role || "viewer";

  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <div className="min-h-screen">
          <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                  AI
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-tight md:text-base">
                    AI Story Forge
                  </p>
                  <p className="text-xs text-slate-500">
                    Authenticated workspace
                  </p>
                </div>
              </div>

              {session?.user ? (
                <div className="flex items-center gap-3">
                  <Link href="/">
                    <Button className="rounded-2xl">Dashboard</Button>
                  </Link>

                  {displayRole === "admin" ? (
                    <Link href="/admin">
                      <Button className="rounded-2xl">Admin</Button>
                    </Link>
                  ) : null}

                  <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 sm:flex">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                      {initials}
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">
                        {displayName}
                      </p>
                      <p className="text-xs text-slate-500">{displayEmail}</p>
                    </div>
                  </div>

                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {displayRole}
                  </Badge>

                  <form
                    action={async () => {
                      "use server";

                      if (session?.user?.id || session?.user?.email) {
                        logAuditEvent({
                          userId: session.user.id || null,
                          userEmail: session.user.email || null,
                          action: "sign_out",
                          entityType: "session",
                          entityId: null,
                          message: "User signed out.",
                        });
                      }

                      await signOut({ redirectTo: "/login" });
                    }}
                  >
                    <Button type="submit" className="rounded-2xl">
                      Sign out
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    guest
                  </Badge>
                  <Link href="/login">
                    <Button className="rounded-2xl">Sign in</Button>
                  </Link>
                </div>
              )}
            </div>
          </header>

          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
