
import type { Story } from "@/types";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "viewer";
  provider?: string | null;
};

export type RunJiraIssue = {
  run_id: string;
  story_id: string;
  issue_key: string;
  issue_url: string;
  created_at: string;
};

export type RunListItem = {
  id: string;
  title: string;
  date: string;
  stories: number;
  jira: number;
};

export type RunActivityItem = {
  id: string;
  type: "run_created" | "source_prd" | "export" | "jira_payload";
  title: string;
  description: string;
  timestamp: string;
};

export type RequirementQualityReport = {
  summary: string;
  flags: Array<{
    severity: "Blocker" | "Warning" | "Suggestion";
    category:
      | "Ambiguous language"
      | "Contradiction"
      | "Undefined actor"
      | "Missing non-functional requirement"
      | "Passive voice"
      | "Missing measurable criteria"
      | "Incomplete requirement";
    quotedText: string;
    reason: string;
    suggestedFix: string;
    sectionHint?: string;
    requirementIds: string[];
  }>;
  blockerCount: number;
  warningCount: number;
  suggestionCount: number;
};

export type AutonomousRefinementSummary = {
  maxRefinementRounds: number;
  roundsUsed: number;
  stoppedReason:
    | "quality_threshold_met"
    | "max_rounds_reached"
    | "no_actionable_issues";
  originalCounts: {
    blockers: number;
    warnings: number;
    suggestions: number;
  };
  finalCounts: {
    blockers: number;
    warnings: number;
    suggestions: number;
  };
  finalCorrectedPrd: string;
  rounds: Array<{
    round: number;
    inputCounts: {
      blockers: number;
      warnings: number;
      suggestions: number;
    };
    outputCounts: {
      blockers: number;
      warnings: number;
      suggestions: number;
    };
    appliedChanges: string[];
    skippedIssues: string[];
    summary: string;
  }>;
};

export async function uploadPrdFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload/prd", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to upload PRD (${response.status})`);
  }

  return response.json() as Promise<{
    ok: true;
    fileName: string;
    sourceType: string;
    prdText: string;
    uploadToken: string;
  }>;
}

export async function generateStories(payload: {
  prdText: string;
  userApprovedMajorChanges?: boolean | null;
  sourceFileName?: string;
  sourceType?: string;
  uploadToken?: string;
  allowDuplicatePrd?: boolean;
}) {
  const response = await fetch("/api/stories/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to generate stories (${response.status})`);
  }

  return response.json() as Promise<{
    ok: true;
    runId: string;
    jobId?: string;
    status: "queued" | "processing";
  }>;
}

export async function getRuns() {
  const response = await fetch("/api/runs", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to load runs (${response.status})`);
  }

  return response.json() as Promise<{
    ok: true;
    runs: RunListItem[];
  }>;
}

export async function getRunDetails(runId: string) {
  const response = await fetch(`/api/runs/${runId}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to load run details (${response.status})`);
  }

  return response.json() as Promise<{
    ok: true;
    run: {
      id: string;
      title: string;
      date: string;
      stories: number;
      jira: number;
      prd: string;
      majorDecision?: string | null;
      sourceType?: string | null;
      sourceFileName?: string | null;
      lastSavedAt?: string | null;
    };
    stories: Story[];
    qualityReport: RequirementQualityReport | null;
    refinementSummary: AutonomousRefinementSummary | null;
    jiraIssues: RunJiraIssue[];
  }>;
}

export async function getRunActivity(runId: string) {
  const response = await fetch(`/api/runs/${runId}/activity`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to load run activity (${response.status})`);
  }

  return response.json() as Promise<{
    ok: true;
    activities: RunActivityItem[];
  }>;
}

export async function downloadOutputFile(
  runId: string,
  format: "json" | "md" | "csv" | "txt" | "docx" | "pdf",
  options?: {
    title?: string;
    scope?: "all" | "epics" | "stories";
  }
) {
  const response = await fetch("/api/exports/download", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      runId,
      format,
      title: options?.title,
      scope: options?.scope,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to download export (${response.status})`);
  }

  const blob = await response.blob();

  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename=\"?([^"]+)\"?/i);
  const filename = match?.[1] || `export.${format}`;

  return { blob, filename };
}

export async function previewQualityFixes(runId: string) {
  const response = await fetch(`/api/runs/${runId}/quality/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "preview",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to preview quality fixes (${response.status})`);
  }

  return response.json() as Promise<{
    ok: true;
    mode: "preview";
    correctedPrd: string;
    appliedChanges: string[];
    skippedIssues: string[];
    summary: string;
  }>;
}

export async function applyQualityFixesAndRegenerate(runId: string) {
  const response = await fetch(`/api/runs/${runId}/quality/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "apply",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      text || `Failed to apply quality fixes and regenerate (${response.status})`
    );
  }

  return response.json() as Promise<{
    ok: true;
    mode: "apply";
    runId: string;
    jobId?: string;
    status: "queued";
    correctedPrd: string;
    appliedChanges: string[];
    skippedIssues: string[];
    summary: string;
  }>;
}

export async function testJiraConnectionApi() {
  const response = await fetch("/api/jira/test", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to test Jira connection (${response.status})`);
  }

  return response.json() as Promise<{
    ok: true;
    message: string;
    result: {
      user: {
        accountId: string;
        displayName: string;
        emailAddress?: string;
      };
      project: {
        id: string;
        key: string;
        name: string;
      };
    };
  }>;
}

export async function exportRunToJira(
  runId: string,
  includeEpics = false,
  allowReExport = false,
  allowCrossRunDuplicateExport = false
) {
  const response = await fetch("/api/jira/export", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      runId,
      includeEpics,
      allowReExport,
      allowCrossRunDuplicateExport,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to export run to Jira (${response.status})`);
  }

  return response.json() as Promise<{
    ok: true;
    runId: string;
    createdCount: number;
    createdIssues: Array<{
      storyId: string;
      storyTitle: string;
      issueKey: string;
      issueUrl: string;
    }>;
    reExported?: boolean;
  }>;
}
