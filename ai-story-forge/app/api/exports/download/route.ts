
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import { createExportFile } from "@/lib/export-utils";
import { getRunById, getStoriesForRun, userCanAccessRun } from "@/lib/security-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportBody = {
  runId?: string;
  format?: "json" | "md" | "csv" | "txt" | "docx" | "pdf";
  title?: string;
  scope?: "all" | "epics" | "stories";
};

export async function POST(request: Request) {
  try {
    const authResult = await requireAppUser();

    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const body = (await request.json()) as ExportBody;

    if (!body.runId) {
      return NextResponse.json(
        { message: "runId is required" },
        { status: 400 }
      );
    }

    const format = body.format ?? "json";
    const scope = body.scope ?? "all";

    if (!userCanAccessRun(authResult.user.id, body.runId)) {
      return NextResponse.json(
        { message: "Run not found" },
        { status: 404 }
      );
    }

    const run = getRunById(body.runId);
    if (!run) {
      return NextResponse.json(
        { message: "Run not found" },
        { status: 404 }
      );
    }

    const stories = getStoriesForRun(body.runId);

    const exportFile = await createExportFile({
      format,
      scope,
      title: body.title?.trim() || run.title,
      date: run.date,
      stories,
    });

    return new NextResponse(exportFile.buffer, {
      status: 200,
      headers: {
        "Content-Type": exportFile.contentType,
        "Content-Disposition": `attachment; filename="${exportFile.filename}"`,
      },
    });
  } catch (error) {
    console.error("POST /api/exports/download failed:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to export run",
      },
      { status: 500 }
    );
  }
}
