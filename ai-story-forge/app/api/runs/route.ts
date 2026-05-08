
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import { listRunsForUser } from "@/lib/security-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requireAppUser();
    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const runs = listRunsForUser(authResult.user.id).map((run) => ({
      id: run.id,
      title: run.title,
      date: run.date,
      stories: run.stories,
      jira: run.jira,
    }));

    return NextResponse.json({ ok: true, runs });
  } catch (error) {
    console.error("GET /api/runs failed:", error);
    return NextResponse.json(
      { message: "Failed to load runs" },
      { status: 500 }
    );
  }
}
