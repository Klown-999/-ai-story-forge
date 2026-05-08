
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import {
  grantViewerAccessToRun,
  listRunSharesForOwner,
  listViewerCandidatesForRun,
  userOwnsRun,
} from "@/lib/security-db";
import { logAuditEvent } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isOwner(userId: string, runId: string) {
  return userOwnsRun(userId, runId);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const authResult = await requireAppUser(["admin", "editor"]);
    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const { runId } = await context.params;

    if (!runId) {
      return NextResponse.json(
        { message: "runId is required" },
        { status: 400 }
      );
    }

    if (!isOwner(authResult.user.id, runId)) {
      return NextResponse.json(
        { message: "Run not found" },
        { status: 404 }
      );
    }

    const sharedViewers = listRunSharesForOwner(authResult.user.id, runId);
    const viewerCandidates = listViewerCandidatesForRun(authResult.user.id);

    return NextResponse.json({
      ok: true,
      runId,
      sharedViewers,
      viewerCandidates,
    });
  } catch (error) {
    console.error("GET /api/runs/[runId]/shares failed:", error);

    return NextResponse.json(
      { message: "Failed to load run shares" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const authResult = await requireAppUser(["admin", "editor"]);
    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const { runId } = await context.params;
    const body = (await request.json()) as { viewerUserId?: string };

    if (!runId) {
      return NextResponse.json(
        { message: "runId is required" },
        { status: 400 }
      );
    }

    if (!body.viewerUserId) {
      return NextResponse.json(
        { message: "viewerUserId is required" },
        { status: 400 }
      );
    }

    if (!isOwner(authResult.user.id, runId)) {
      return NextResponse.json(
        { message: "Run not found" },
        { status: 404 }
      );
    }

    const viewer = grantViewerAccessToRun(
      authResult.user.id,
      runId,
      body.viewerUserId
    );

    logAuditEvent({
      userId: authResult.user.id,
      userEmail: authResult.user.email,
      action: "run_shared",
      entityType: "run",
      entityId: runId,
      message: `Run ${runId} was shared with viewer ${viewer.email}.`,
      metadata: {
        viewerUserId: viewer.id,
        viewerEmail: viewer.email,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Viewer access granted",
    });
  } catch (error) {
    console.error("POST /api/runs/[runId]/shares failed:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to share run",
      },
      { status: 500 }
    );
  }
}
