
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import { testJiraConnection } from "@/lib/jira";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requireAppUser(["admin", "editor"]);

    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const result = await testJiraConnection();

    return NextResponse.json({
      ok: true,
      message: "Jira connection successful",
      result,
    });
  } catch (error) {
    console.error("GET /api/jira/test failed:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to test Jira connection",
      },
      { status: 500 }
    );
  }
}
