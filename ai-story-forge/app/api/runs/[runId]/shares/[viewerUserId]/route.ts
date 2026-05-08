
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import { revokeViewerAccessFromRun, userOwnsRun } from "@/lib/security-db";
import { logAuditEvent } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isOwner(userId: string, runId: string) {
  return userOwnsRun(userId, runId);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ runId: string; viewerUserId: string }> }
) {
  try {
    const authResult = await requireAppUser(["admin", "editor"]);
    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const { runId, viewerUserId } = await context.params;

    if (!runId || !viewerUserId) {
      return NextResponse.json(
        { message: "runId and viewerUserId are required" },
        { status: 400 }
      );
    }

    if (!isOwner(authResult.user.id, runId)) {
      return NextResponse.json(
        { message: "Run not found" },
        { status: 404 }
      );
    }

    revokeViewerAccessFromRun(authResult.user.id, runId, viewerUserId);

    logAuditEvent({
      userId: authResult.user.id,
      userEmail: authResult.user.email,
      action: "run_share_revoked",
      entityType: "run",
      entityId: runId,
      message: `Run ${runId} share was revoked for viewer ${viewerUserId}.`,
      metadata: {
        viewerUserId,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Viewer access revoked",
    });
  } catch (error) {
    console.error("DELETE /api/runs/[runId]/shares/[viewerUserId] failed:", error);

    return NextResponse.json(
      { message: "Failed to revoke run share" },
      { status: 500 }
    );
  }
}
