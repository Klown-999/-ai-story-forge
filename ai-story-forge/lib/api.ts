
import type { Story } from "@/types";

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
    runs: Array<{
      id: string;
      title: string;
      date: string;
      stories: number;
      jira: number;
    }>;
  }>;
}

export async function getRunDetails(runId: string) {
  const response = await fetch(`/api/runs/${runId}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to load run (${response.status})`);
  }

  return response.json() as Promise<{
    ok: true;
    run: {
      id: string;
      title: string;
      date: string;
      prd: string;
      majorDecision: string;
      stories: number;
      jira: number;
      status: string;
      sourceType?: string | null;
      sourceFileName?: string | null;
      createdAt: string;
      updatedAt: string;
      lastSavedAt: string | null;
    };
    stories: Story[];
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
    run: {
      id: string;
      title: string;
      createdAt: string;
      updatedAt: string;
      lastSavedAt: string | null;
      majorDecision: string;
      storyCount: number;
      jiraCount: number;
      status: string;
    };
    activities: Array<{
      id: string;
      type: "run_created" | "source_prd" | "export" | "jira_payload";
      title: string;
      description: string;
      timestamp: string;
    }>;
  }>;
}

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
    uploadToken: string;
    fileName: string;
    sourceType: string;
    prdText: string;
  }>;
}

export async function generateStories(payload: {
  prdText: string;
  userApprovedMajorChanges?: boolean | null;
  sourceFileName?: string;
  sourceType?: string;
  uploadToken?: string;
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
    stories: Story[];
    summary: {
      storyCount: number;
    };
    correctionPreview: {
      requiresApproval: boolean;
    };
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
      scope: options?.scope ?? "all",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to download export (${response.status})`);
  }

  const blob = await response.blob();

  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="(.+)"/);
  const filename = match?.[1] || `export.${format}`;

  return { blob, filename };
}
