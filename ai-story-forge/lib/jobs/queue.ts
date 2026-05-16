
import { randomUUID } from "crypto";
import {
  addRunActivity,
  createGenerationJob,
  createRun,
  getGenerationJobByRunId,
} from "@/lib/security-db";

export function enqueueGenerationJob(params: {
  ownerUserId: string;
  title: string;
  date: string;
  prdText: string;
  sourceType?: string | null;
  sourceFileName?: string | null;
  userApprovedMajorChanges?: boolean | null;
}) {
  const runId = createRun({
    ownerUserId: params.ownerUserId,
    title: params.title,
    date: params.date,
    prd: params.prdText,
    majorDecision: "Pending",
    sourceType: params.sourceType ?? null,
    sourceFileName: params.sourceFileName ?? null,
  });

  const jobId = randomUUID();

  createGenerationJob({
    jobId,
    runId,
    ownerUserId: params.ownerUserId,
    prdText: params.prdText,
    userApprovedMajorChanges: params.userApprovedMajorChanges ?? null,
    sourceType: params.sourceType ?? null,
    sourceFileName: params.sourceFileName ?? null,
  });

  addRunActivity({
    runId,
    type: "run_created",
    title: "Generation queued",
    description: "The AI generation job has been queued.",
  });

  return { runId, jobId };
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
