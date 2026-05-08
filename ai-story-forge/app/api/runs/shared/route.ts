
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import { listSharedRunIdsForUser } from "@/lib/security-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requireAppUser();

    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const runIds = listSharedRunIdsForUser(authResult.user.id);

    return NextResponse.json({
      ok: true,
      runIds,
    });
  } catch (error) {
    console.error("GET /api/runs/shared failed:", error);

    return NextResponse.json(
      { message: "Failed to load shared runs" },
      { status: 500 }
    );
  }
}
