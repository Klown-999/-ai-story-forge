
import { redirect, notFound } from "next/navigation";
import { requireAppUser } from "@/lib/authz";
import {
  getActivityForRun,
  getRunById,
  getStoriesForRun,
  userCanAccessRun,
} from "@/lib/security-db";
import RunDetailsClient from "./RunDetailsClient";

export const dynamic = "force-dynamic";

export default async function RunDetailsPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const authResult = await requireAppUser();

  if (!authResult.ok) {
    if (authResult.status === 401) {
      redirect("/login");
    }
    redirect("/forbidden");
  }

  const { runId } = await params;

  if (!userCanAccessRun(authResult.user.id, runId)) {
    notFound();
  }

  const run = getRunById(runId);
  if (!run) {
    notFound();
  }

  const stories = getStoriesForRun(runId);
  const activities = getActivityForRun(runId).map((activity) => ({
    id: activity.activity_id,
    type: activity.type,
    title: activity.title,
    description: activity.description,
    timestamp: activity.timestamp,
  }));

  return (
    <RunDetailsClient
      run={{
        id: run.run_id,
        title: run.title,
        date: run.date,
        prd: run.prd,
        majorDecision: run.major_decision,
        stories: run.story_count,
        jira: run.jira_count,
        status: run.status,
        sourceType: run.source_type,
        sourceFileName: run.source_file_name,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        lastSavedAt: run.last_saved_at,
      }}
      stories={stories}
      activities={activities}
    />
  );
}
