
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import {
  getRunById,
  getStoriesForRun,
  getRunQualityReport,
  getRunRefinementSummary,
  userCanAccessRun,
} from "@/lib/security-db";

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
      return NextResponse.json({ message: "Run not found" }, { status: 404 });
    }

    const run = getRunById(runId);
    if (!run) {
      return NextResponse.json({ message: "Run not found" }, { status: 404 });
    }

    const stories = getStoriesForRun(runId);
    const qualityReport = getRunQualityReport(runId);
    const refinementSummary = getRunRefinementSummary(runId);

    return NextResponse.json({
      ok: true,
      run: {
        id: run.run_id,
        title: run.title,
        date: run.date,
        stories: run.story_count,
        jira: run.jira_count,
        prd: run.prd,
        majorDecision: run.major_decision,
        sourceType: run.source_type,
        sourceFileName: run.source_file_name,
        lastSavedAt: run.last_saved_at,
      },
      stories,
      qualityReport,
      refinementSummary,
    });
  } catch (error) {
    console.error("GET /api/runs/[runId] failed:", error);
    return NextResponse.json(
      { message: "Failed to load run details" },
      { status: 500 }
    );
  }
}
