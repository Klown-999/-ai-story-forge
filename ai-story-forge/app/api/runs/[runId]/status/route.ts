
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import { getRunGenerationStatus } from "@/lib/jobs/queue";
import { userCanAccessRun } from "@/lib/security-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const authResult = await requireAppUser();
    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const { runId } = await params;

    if (!userCanAccessRun(authResult.user.id, runId)) {
      return NextResponse.json(
        { message: "Run not found" },
        { status: 404 }
      );
    }

    const status = getRunGenerationStatus(runId);

    return NextResponse.json({
      ok: true,
      runId,
      status: status.status,
      errorMessage: status.errorMessage,
    });
  } catch (error) {
    console.error("GET /api/runs/[runId]/status failed:", error);
    return NextResponse.json(
      { message: "Failed to load generation status" },
      { status: 500 }
    );
  }
}
