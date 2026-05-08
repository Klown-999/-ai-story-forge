
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import { getActivityForRun, getRunById, userCanAccessRun } from "@/lib/security-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const authResult = await requireAppUser();
    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const { runId } = await context.params;

    if (!userCanAccessRun(authResult.user.id, runId)) {
      return NextResponse.json(
        { message: "Run activity not found" },
        { status: 404 }
      );
    }

    const run = getRunById(runId);
    if (!run) {
      return NextResponse.json(
        { message: "Run activity not found" },
        { status: 404 }
      );
    }

    const activities = getActivityForRun(runId).map((activity) => ({
      id: activity.activity_id,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      timestamp: activity.timestamp,
    }));

    return NextResponse.json({
      ok: true,
      run: {
        id: run.run_id,
        title: run.title,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        lastSavedAt: run.last_saved_at,
        majorDecision: run.major_decision,
        storyCount: run.story_count,
        jiraCount: run.jira_count,
        status: run.status,
      },
      activities,
    });
  } catch (error) {
    console.error("GET /api/runs/[runId]/activity failed:", error);
    return NextResponse.json(
      { message: "Failed to load run activity" },
      { status: 500 }
    );
  }
}
