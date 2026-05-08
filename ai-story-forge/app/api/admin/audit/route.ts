
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import { listAuditEvents } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireAppUser(["admin"]);

  if (!authResult.ok) {
    return NextResponse.json(
      { message: authResult.message },
      { status: authResult.status }
    );
  }

  const events = listAuditEvents(200);

  return NextResponse.json({
    ok: true,
    events,
  });
}
``
