
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import {
  getRunById,
  getStoriesForRun,
  userCanAccessRun,
} from "@/lib/security-db";
import {
  buildCsvExport,
  buildDocxExport,
  buildJsonExport,
  buildMarkdownExport,
  buildPdfExport,
  buildTextExport,
  ExportFormat,
  ExportScope,
  filterStoriesByScope,
  slugify,
} from "@/lib/export-utils";

export const runtime = "nodejs";

type DownloadBody = {
  runId?: string;
  format?: ExportFormat;
  title?: string;
  scope?: ExportScope;
};

function contentTypeForFormat(format: ExportFormat) {
  switch (format) {
    case "json":
      return "application/json";
    case "md":
      return "text/markdown; charset=utf-8";
    case "csv":
      return "text/csv; charset=utf-8";
    case "txt":
      return "text/plain; charset=utf-8";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

function extensionForFormat(format: ExportFormat) {
  switch (format) {
    case "json":
      return "json";
    case "md":
      return "md";
    case "csv":
      return "csv";
    case "txt":
      return "txt";
    case "docx":
      return "docx";
    case "pdf":
      return "pdf";
    default:
      return "bin";
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAppUser();

    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const body = (await request.json()) as DownloadBody;

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

    const allStories = getStoriesForRun(body.runId);
    const filteredStories = filterStoriesByScope(allStories, scope);
    const exportTitle = body.title?.trim() || run.title || "AI Story Forge Export";

    let fileBuffer: Buffer;
    let fileName = `${slugify(exportTitle)}.${extensionForFormat(format)}`;

    try {
      switch (format) {
        case "json":
          fileBuffer = Buffer.from(
            buildJsonExport(exportTitle, filteredStories),
            "utf8"
          );
          break;
        case "md":
          fileBuffer = Buffer.from(
            buildMarkdownExport(exportTitle, filteredStories),
            "utf8"
          );
          break;
        case "csv":
          fileBuffer = Buffer.from(buildCsvExport(filteredStories), "utf8");
          break;
        case "txt":
          fileBuffer = Buffer.from(
            buildTextExport(exportTitle, filteredStories),
            "utf8"
          );
          break;
        case "docx":
          fileBuffer = await buildDocxExport(exportTitle, filteredStories);
          break;
        case "pdf":
          fileBuffer = await buildPdfExport(exportTitle, filteredStories);
          break;
        default:
          return NextResponse.json(
            { message: "Unsupported format" },
            { status: 400 }
          );
      }
    } catch (innerError) {
      console.error(
        `Export generation failed for format=${format}, runId=${body.runId}:`,
        innerError
      );
      throw innerError;
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentTypeForFormat(format),
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("POST /api/exports/download failed:", error);
    return NextResponse.json(
      { message: "Failed to generate export" },
      { status: 500 }
    );
  }
}
