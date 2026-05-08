
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { saveTempUpload } from "@/lib/file-assets";
import { requireAppUser } from "@/lib/authz";
import { logAuditEvent } from "@/lib/audit-log";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".txt", ".md", ".docx", ".pdf"];

function getSourceType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".md")) return "md";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".pdf")) return "pdf";
  return "unknown";
}

function ensureAllowedFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  const allowed = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!allowed) {
    throw new Error("Unsupported PRD file type. Use .txt, .md, .docx, or .pdf");
  }
}

async function extractText(fileName: string, buffer: Buffer) {
  const sourceType = getSourceType(fileName);

  if (sourceType === "txt" || sourceType === "md") {
    return buffer.toString("utf8");
  }

  if (sourceType === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  if (sourceType === "pdf") {
    const pdfModule = await import("pdf-parse");
    const pdfParse =
      (pdfModule as unknown as { default?: (data: Buffer) => Promise<{ text: string }> }).default ??
      (pdfModule as unknown as (data: Buffer) => Promise<{ text: string }>);

    const result = await pdfParse(buffer);
    return result.text || "";
  }

  throw new Error("Unsupported PRD file type. Use .txt, .md, .docx, or .pdf");
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

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "A file is required" },
        { status: 400 }
      );
    }

    if (!file.name?.trim()) {
      return NextResponse.json(
        { message: "File name is required" },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { message: "Uploaded file is empty" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { message: "File exceeds the 10 MB upload limit" },
        { status: 400 }
      );
    }

    ensureAllowedFileName(file.name);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const prdText = await extractText(file.name, buffer);

    if (!prdText.trim()) {
      return NextResponse.json(
        { message: "Could not extract text from uploaded file" },
        { status: 400 }
      );
    }

    const saved = saveTempUpload(file.name, buffer);

    logAuditEvent({
      userId: authResult.user.id,
      userEmail: authResult.user.email,
      action: "source_uploaded",
      entityType: "temp_upload",
      entityId: saved.uploadToken,
      message: `User uploaded source PRD file ${file.name}.`,
      metadata: {
        fileName: file.name,
        sourceType: getSourceType(file.name),
        sizeBytes: file.size,
      },
    });

    return NextResponse.json({
      ok: true,
      uploadToken: saved.uploadToken,
      fileName: saved.fileName,
      sourceType: getSourceType(file.name),
      prdText,
    });
  } catch (error) {
    console.error("POST /api/upload/prd failed:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to upload PRD file",
      },
      { status: 500 }
    );
  }
}
