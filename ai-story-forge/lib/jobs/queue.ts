
import { randomUUID } from "crypto";
import {
  addRunActivity,
  createGenerationJob,
  createRun,
  getGenerationJobByRunId,
} from "@/lib/security-db";
import db from "@/lib/sqlite";

export function enqueueGenerationJob(params: {
  ownerUserId: string;
  title: string;
  date: string;
  prdText: string;
  prdFingerprint: string;
  sourceType?: string | null;
  sourceFileName?: string | null;
  userApprovedMajorChanges?: boolean | null;
}) {
  const runId = createRun({
    ownerUserId: params.ownerUserId,
    title: params.title,
    date: params.date,
    prd: params.prdText,
    prdFingerprint: params.prdFingerprint,
    majorDecision:
      params.userApprovedMajorChanges == null
        ? "Pending"
        : params.userApprovedMajorChanges
        ? "Approved"
        : "Rejected",
    storyCount: 0,
    jiraCount: 0,
    sourceType: params.sourceType ?? null,
    sourceFileName: params.sourceFileName ?? null,
  });

  const jobId = randomUUID();

  const stmt = db.prepare(`
    INSERT INTO run_generation_jobs (
      job_id,
      run_id,
      owner_user_id,
      status,
      prd_text,
      user_approved_major_changes,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, 'queued', ?, ?, datetime('now'), datetime('now'))
  `);

  stmt.run(
    jobId,
    runId,
    params.ownerUserId,
    params.prdText,
    params.userApprovedMajorChanges == null
      ? null
      : params.userApprovedMajorChanges
      ? 1
      : 0
  );

  return {
    jobId,
    runId,
  };
}


export function getRunGenerationStatus(runId: string) {
  const job = getGenerationJobByRunId(runId);

  if (!job) {
    return {
      status: "unknown" as const,
      errorMessage: null,
    };
  }

  return {
    status: job.status,
    errorMessage: job.error_message,
  };
}
