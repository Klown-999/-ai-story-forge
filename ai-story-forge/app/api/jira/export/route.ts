
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import { createJiraIssueFromStory } from "@/lib/jira";
import {
  addRunActivity,
  getRunById,
  getRunJiraIssues,
  getStoriesForRun,
  recomputeRunJiraCount,
  upsertRunJiraIssue,
  userCanAccessRun,
} from "@/lib/security-db";
import type { Story } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportJiraBody = {
  runId?: string;
  includeEpics?: boolean;
  allowReExport?: boolean;
};

export async function POST(request: Request) {
  try {
    const authResult = await requireAppUser(["admin", "editor"]);

    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const body = (await request.json()) as ExportJiraBody;
    const runId = body.runId;

    if (!runId) {
      return NextResponse.json(
        { message: "runId is required" },
        { status: 400 }
      );
    }

    if (!userCanAccessRun(authResult.user.id, runId)) {
      return NextResponse.json(
        { message: "Run not found" },
        { status: 404 }
      );
    }

    const run = getRunById(runId);
    if (!run) {
      return NextResponse.json(
        { message: "Run not found" },
        { status: 404 }
      );
    }

    // ✅ Duplicate export protection
    const existingIssues = getRunJiraIssues(runId);

    if (existingIssues.length > 0 && !body.allowReExport) {
      return NextResponse.json(
        {
          message:
            "This run has already been exported to Jira. Re-export is blocked unless allowReExport is set to true.",
          existingCount: existingIssues.length,
          existingIssues,
        },
        { status: 409 }
      );
    }

    const allStories = getStoriesForRun(runId);

    const exportableStories = allStories.filter((story: Story) => {
      if (body.includeEpics) return true;
      return story.kind === "Story";
    });

    if (exportableStories.length === 0) {
      return NextResponse.json(
        { message: "No exportable stories found for this run" },
        { status: 400 }
      );
    }

    const createdIssues: Array<{
      storyId: string;
      storyTitle: string;
      issueKey: string;
      issueUrl: string;
    }> = [];

    for (const story of exportableStories) {
      const created = await createJiraIssueFromStory(story);

      upsertRunJiraIssue({
        runId,
        storyId: story.id,
        issueKey: created.key,
        issueUrl: created.browseUrl,
      });

      createdIssues.push({
        storyId: story.id,
        storyTitle: story.title,
        issueKey: created.key,
        issueUrl: created.browseUrl,
      });
    }

    recomputeRunJiraCount(runId);

    addRunActivity({
      runId,
      type: "jira_payload",
      title: body.allowReExport
        ? "Jira re-export completed"
        : "Jira export completed",
      description: `${
        body.allowReExport ? "Re-exported" : "Exported"
      } ${createdIssues.length} issue(s) to Jira.`,
    });

    return NextResponse.json({
      ok: true,
      runId,
      createdCount: createdIssues.length,
      createdIssues,
      reExported: !!body.allowReExport,
    });
  } catch (error) {
    console.error("POST /api/jira/export failed:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to export to Jira",
      },
      { status: 500 }
    );
  }
}
