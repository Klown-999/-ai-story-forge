
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireAppUser } from "@/lib/authz";
import AdminUserManagement from "@/components/admin/AdminUserManagement";
import AdminAuditLog from "@/components/admin/AdminAuditLog";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authResult = await requireAppUser(["admin"]);

  if (!authResult.ok) {
    if (authResult.status === 401) {
      redirect("/login");
    }

    redirect("/forbidden");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Admin Control Center
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage access roles, inspect users, and review security activity.
            </p>
          </div>

          <Link href="/">
            <Button className="rounded-2xl">← Back to Dashboard</Button>
          </Link>
        </div>

        <div className="space-y-6">
          <AdminUserManagement />
          <AdminAuditLog />
        </div>
      </div>
    </div>
  );
}
