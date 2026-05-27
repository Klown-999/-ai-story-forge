
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import { enqueueGenerationJob } from "@/lib/jobs/queue";
import { createPrdFingerprint } from "@/lib/prd-fingerprint";
import { findRunsByPrdFingerprint } from "@/lib/security-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateBody = {
  prdText?: string;
  userApprovedMajorChanges?: boolean | null;
  sourceFileName?: string;
  sourceType?: string;
  uploadToken?: string;
  allowDuplicatePrd?: boolean;
};

function titleFromPrd(prdText: string) {
  const lines = prdText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const productNameLine = lines.find((line) =>
    line.toLowerCase().startsWith("product name:")
  );

  if (productNameLine) {
    return productNameLine.replace(/product name:/i, "").trim();
  }

  return lines[0] || "Generated PRD Run";
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAppUser(["admin", "editor"]);
    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const body = (await request.json()) as GenerateBody;
    const prdText = body.prdText?.trim();

    if (!prdText) {
      return NextResponse.json(
        { message: "prdText is required" },
        { status: 400 }
      );
    }

    const title = titleFromPrd(prdText);
    const today = new Date().toISOString().split("T")[0];
    const prdFingerprint = createPrdFingerprint(body.prdText || "");
    const matchingRuns = findRunsByPrdFingerprint(
      authResult.user.id,
      prdFingerprint
    );

    if (matchingRuns.length > 0 && !body.allowDuplicatePrd) {
      const latest = matchingRuns[0];

      return NextResponse.json(
        {
          message:
            "A matching PRD has already been processed before. Duplicate generation is blocked unless allowDuplicatePrd is set to true.",
          duplicatePrd: true,
          fingerprint: prdFingerprint,
          existingRun: {
            id: latest.run_id,
            title: latest.title,
            date: latest.date,
            jira: latest.jira_count,
            stories: latest.story_count,
            lastSavedAt: latest.last_saved_at,
          },
        },
        { status: 409 }
      );
    }

    const queued = enqueueGenerationJob({
      ownerUserId: authResult.user.id,
      title,
      date: today,
      prdText,
      prdFingerprint,
      sourceType: body.sourceType ?? null,
      sourceFileName: body.sourceFileName ?? null,
      userApprovedMajorChanges: body.userApprovedMajorChanges ?? null,
    });

    return NextResponse.json({
      ok: true,
      runId: queued.runId,
      jobId: queued.jobId,
      status: "queued",
    });
  } catch (error) {
    console.error("POST /api/stories/generate failed:", error);
    return NextResponse.json(
      { message: "Failed to queue generation job" },
      { status: 500 }
    );
  }
}
