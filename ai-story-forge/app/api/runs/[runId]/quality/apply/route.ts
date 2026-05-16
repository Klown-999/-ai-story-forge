
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import { enqueueGenerationJob } from "@/lib/jobs/queue";
import {
  addRunActivity,
  getRunById,
  getRunQualityReport,
  userCanAccessRun,
} from "@/lib/security-db";
import { applyRequirementQualityFixes } from "@/lib/ai/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApplyQualityFixesBody = {
  mode?: "preview" | "apply";
  acceptedFlagIndexes?: number[];
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const authResult = await requireAppUser(["admin", "editor"]);

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

    const qualityReport = getRunQualityReport(runId);
    if (!qualityReport) {
      return NextResponse.json(
        { message: "No requirement quality report found for this run" },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as ApplyQualityFixesBody;
    const mode = body.mode ?? "preview";

    const acceptedFlags =
      Array.isArray(body.acceptedFlagIndexes) &&
      body.acceptedFlagIndexes.length > 0
        ? qualityReport.flags.filter((_, index) =>
            body.acceptedFlagIndexes?.includes(index)
          )
        : qualityReport.flags;

    const fixed = await applyRequirementQualityFixes({
      originalPrd: run.prd,
      qualityReport: {
        ...qualityReport,
        flags: acceptedFlags,
        blockerCount: acceptedFlags.filter((f) => f.severity === "Blocker").length,
        warningCount: acceptedFlags.filter((f) => f.severity === "Warning").length,
        suggestionCount: acceptedFlags.filter((f) => f.severity === "Suggestion").length,
      },
      acceptedFlags,
    });

    if (mode === "preview") {
      return NextResponse.json({
        ok: true,
        mode: "preview",
        correctedPrd: fixed.correctedPrd,
        appliedChanges: fixed.appliedChanges,
        skippedIssues: fixed.skippedIssues,
        summary: fixed.summary,
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const title = `${run.title} (AI Fixed)`;

    const queued = enqueueGenerationJob({
      ownerUserId: authResult.user.id,
      title,
      date: today,
      prdText: fixed.correctedPrd,
      sourceType: run.source_type ?? null,
      sourceFileName: run.source_file_name ?? null,
      userApprovedMajorChanges: true,
    });

    addRunActivity({
      runId,
      type: "run_created",
      title: "AI fixes accepted",
      description: `A corrected PRD was generated and queued as a new run (${queued.runId}).`,
    });

    return NextResponse.json({
      ok: true,
      mode: "apply",
      runId: queued.runId,
      jobId: queued.jobId,
      status: "queued",
      correctedPrd: fixed.correctedPrd,
      appliedChanges: fixed.appliedChanges,
      skippedIssues: fixed.skippedIssues,
      summary: fixed.summary,
    });
  } catch (error) {
    console.error("POST /api/runs/[runId]/quality/apply failed:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to apply requirement quality fixes",
      },
      { status: 500 }
    );
  }
}
