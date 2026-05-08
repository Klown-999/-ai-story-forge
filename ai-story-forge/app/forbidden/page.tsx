
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Forbidden</h1>
        <p className="mt-3 text-sm text-slate-600">
          You do not have permission to access this page.
        </p>

        <div className="mt-6">
          <Link href="/">
            <Button className="rounded-2xl">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
