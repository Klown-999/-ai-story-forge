
"use client";import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit,
  ChevronRight,
  FileDown,
  FileText,
  GitBranch,
  History,
  LayoutDashboard,
  Link2,
  MonitorSmartphone,
  Shield,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import Stat from "@/components/shared/Stat";
import SidebarItem from "@/components/shared/SidebarItem";
import StoryCard from "@/components/stories/StoryCard";
import DependencyGraph from "@/components/stories/DependencyGraph";
import RunShareManager from "@/components/runs/RunShareManager";

import type { StoredRun, Story } from "@/types";
import { DEFAULT_PRD_TEXT, WORD_LIMIT } from "@/lib/constants";
import {
  downloadOutputFile,
  exportRunToJira,
  generateStories,
  getRunActivity,
  getRunDetails,
  getRuns,
  testJiraConnectionApi,
  uploadPrdFile,
  type CurrentUser,
  type RequirementQualityReport,
  type AutonomousRefinementSummary,
  type RunJiraIssue,
} from "@/lib/api";

function getRunTitleFromPrd(prdText: string) {
  const lines = prdText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const productNameLine = lines.find((line) =>
    line.toLowerCase().startsWith("product name:")
  );

  if (productNameLine) {
    return productNameLine.replace(/product name:/i, "").trim();
  }

  if (lines.length > 0) {
    return lines[0].slice(0, 80);
  }

  return "Generated PRD Run";
}

function toStoredRunSkeleton(run: {
  id: string;
  title: string;
  date: string;
  stories: number;
  jira: number;
}): StoredRun {
  return {
    ...run,
    prd: DEFAULT_PRD_TEXT,
    generatedStories: [],
    majorDecision: "Pending",
    exportedFormats: [],
    lastSavedAt: new Date().toISOString(),
  };
}

function upsertRun(run: StoredRun, previous: StoredRun[]) {
  const index = previous.findIndex((item) => item.id === run.id);

  if (index === -1) {
    return [run, ...previous];
  }

  const next = [...previous];
  next[index] = {
    ...next[index],
    ...run,
  };
  return next;
}

function qualitySeverityTone(severity: "Blocker" | "Warning" | "Suggestion") {
  switch (severity) {
    case "Blocker":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "Warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-sky-200 bg-sky-50 text-sky-700";
  }
}

export default function AIAgileStoryForgeWebsite() {
  const [tab, setTab] = useState("dashboard");
  const [processing, setProcessing] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [majorDecision, setMajorDecision] = useState("Pending");
  const [runJiraIssues, setRunJiraIssues] = useState<RunJiraIssue[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [runs, setRuns] = useState<StoredRun[]>([]);

  const [currentRunId, setCurrentRunId] = useState("");
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);

  const [runActivity, setRunActivity] = useState<
    Array<{
      id: string;
      type: "run_created" | "source_prd" | "export" | "jira_payload";
      title: string;
      description: string;
      timestamp: string;
    }>
  >([]);

  const [prd, setPrd] = useState(DEFAULT_PRD_TEXT);

  const [duplicatePrdWarning, setDuplicatePrdWarning] = useState<{
    existingRun: {
      id: string;
      title: string;
      date: string;
      jira: number;
      stories: number;
      lastSavedAt?: string | null;
    };
  } | null>(null);

  const [allowDuplicatePrdGeneration, setAllowDuplicatePrdGeneration] =
    useState(false);

  const [uploadedSourceFileName, setUploadedSourceFileName] = useState("");
  const [uploadedSourceType, setUploadedSourceType] = useState("");
  const [uploadToken, setUploadToken] = useState("");
  const [uploading, setUploading] = useState(false);

  const [jiraTesting, setJiraTesting] = useState(false);
  const [jiraExporting, setJiraExporting] = useState(false);
  const [jiraConnectionInfo, setJiraConnectionInfo] = useState<{
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
  } | null>(null);
  const [jiraConnectionError, setJiraConnectionError] = useState("");
  const [jiraExportError, setJiraExportError] = useState("");
  const [jiraExportResult, setJiraExportResult] = useState<{
    runId: string;
    createdCount: number;
    createdIssues: Array<{
      storyId: string;
      storyTitle: string;
      issueKey: string;
      issueUrl: string;
    }>;
  } | null>(null);
  const [jiraAllowReExport, setJiraAllowReExport] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [currentUserLoading, setCurrentUserLoading] = useState(true);

  const [exportFormat, setExportFormat] = useState<
    "json" | "md" | "csv" | "txt" | "docx" | "pdf"
  >("json");
  const [exportScope, setExportScope] = useState<"all" | "epics" | "stories">(
    "all"
  );
  const [exportTitle, setExportTitle] = useState("AI Story Forge Export");
  const [downloading, setDownloading] = useState(false);

  const [generationStatus, setGenerationStatus] = useState<
    "idle" | "queued" | "processing" | "ready" | "failed"
  >("idle");
  const [generationError, setGenerationError] = useState("");

  const [qualityReport, setQualityReport] =
    useState<RequirementQualityReport | null>(null);
  const [refinementSummary, setRefinementSummary] =
    useState<AutonomousRefinementSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const wordCount = useMemo(
    () => (prd.trim() ? prd.trim().split(/\s+/).length : 0),
    [prd]
  );
  const remaining = Math.max(0, WORD_LIMIT - wordCount);
  const overLimit = wordCount > WORD_LIMIT;

  const selectableStories = stories.filter((story) => story.kind === "Story");

  const canWrite =
    currentUser?.role === "admin" || currentUser?.role === "editor";
  const isViewer = currentUser?.role === "viewer";

  const currentRun = runs.find((run) => run.id === currentRunId) || null;
  const latestActivities = runActivity.slice(0, 4);

  const minorCorrections = useMemo(() => {
    return runActivity
      .filter((activity) => activity.title === "Minor corrections applied")
      .flatMap((activity) =>
        activity.description
          .split(";")
          .map((item) => item.trim())
          .filter(Boolean)
      );
  }, [runActivity]);

  useEffect(() => {
    if (currentRun?.title) {
      setExportTitle(currentRun.title);
    }
  }, [currentRun?.title]);

  const toggleStorySelection = (storyId: string) => {
    setSelectedStoryIds((prev) =>
      prev.includes(storyId)
        ? prev.filter((id) => id !== storyId)
        : [...prev, storyId]
    );
  };

  const selectAllStories = () => {
    setSelectedStoryIds(selectableStories.map((story) => story.id));
  };

  const clearSelectedStories = () => {
    setSelectedStoryIds([]);
  };

  const loadCurrentUser = async () => {
    try {
      setCurrentUserLoading(true);

      const response = await fetch("/api/me", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          text || `Failed to load current user (${response.status})`
        );
      }

      const data = (await response.json()) as {
        ok: true;
        user: CurrentUser;
      };

      setCurrentUser(data.user);
    } catch (error) {
      console.error("Failed to load current user:", error);
      setCurrentUser(null);
    } finally {
      setCurrentUserLoading(false);
    }
  };

  const loadRunActivitySafe = async (runId: string) => {
    try {
      const result = await getRunActivity(runId);
      setRunActivity(result.activities);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (
        message.includes("Run activity not found") ||
        message.includes("(404)") ||
        message.includes('"Run activity not found"')
      ) {
        console.warn("Run activity missing for run, continuing safely:", runId);
        setRunActivity([]);
        return;
      }

      console.error("Failed to load run activity:", error);
      setRunActivity([]);
    }
  };

  const loadSharedRunIds = async () => {
    try {
      const response = await fetch("/api/runs/shared", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          text || `Failed to load shared runs (${response.status})`
        );
      }

      const data = (await response.json()) as {
        ok: true;
        runIds: string[];
      };

      return data.runIds;
    } catch (error) {
      console.error("Failed to load shared run IDs:", error);
      return [];
    }
  };

  const refreshRuns = async (preferredRunId?: string) => {
    try {
      const response = await getRuns();
      let serverRuns = response.runs.map(toStoredRunSkeleton);

      const sharedRunIds = await loadSharedRunIds();

      const ownedIds = new Set(serverRuns.map((run) => run.id));
      const missingSharedIds = sharedRunIds.filter((id) => !ownedIds.has(id));

      if (missingSharedIds.length > 0) {
        const sharedDetails = await Promise.all(
          missingSharedIds.map(async (runId) => {
            try {
              const result = await getRunDetails(runId);

              return {
                id: result.run.id,
                title: result.run.title,
                date: result.run.date,
                stories: result.run.stories,
                jira: result.run.jira,
                prd: result.run.prd,
                generatedStories: result.stories,
                majorDecision: result.run.majorDecision || "Pending",
                exportedFormats: [],
                lastSavedAt: result.run.lastSavedAt || new Date().toISOString(),
              } as StoredRun;
            } catch (error) {
              console.warn("Skipping missing shared run:", runId, error);
              return null;
            }
          })
        );

        serverRuns = [
          ...serverRuns,
          ...(sharedDetails.filter(Boolean) as StoredRun[]),
        ];
      }

      setRuns(serverRuns);

      if (serverRuns.length === 0) {
        setCurrentRunId("");
        setRunActivity([]);
        setStories([]);
        setMajorDecision("Pending");
        setQualityReport(null);
        setRefinementSummary(null);
        setRunJiraIssues([]);
        return serverRuns;
      }

      const nextRunId =
        preferredRunId && serverRuns.some((run) => run.id === preferredRunId)
          ? preferredRunId
          : serverRuns[0].id;

      setCurrentRunId(nextRunId);
      return serverRuns;
    } catch (error) {
      console.error("Failed to refresh runs:", error);
      return [];
    }
  };

  const handlePrdUpload = async (file: File) => {
    try {
      setUploading(true);

      const result = await uploadPrdFile(file);

      setPrd(result.prdText);
      setUploadToken(result.uploadToken);
      setUploadedSourceFileName(result.fileName);
      setUploadedSourceType(result.sourceType);
      setTab("workspace");
    } catch (error) {
      console.error("Failed to upload PRD file:", error);
      alert(
        error instanceof Error ? error.message : "Failed to upload PRD file"
      );
    } finally {
      setUploading(false);
    }
  };

  const restoreRun = async (
    run: StoredRun,
    options?: { switchTab?: boolean }
  ) => {
    try {
      const result = await getRunDetails(run.id);

      setCurrentRunId(result.run.id);
      setPrd(result.run.prd);
      setStories(result.stories);
      setMajorDecision(result.run.majorDecision || "Pending");
      setSelectedStoryIds([]);
      setUploadedSourceFileName(result.run.sourceFileName || "");
      setUploadedSourceType(result.run.sourceType || "");
      setUploadToken("");
      setGenerationStatus("idle");
      setGenerationError("");
      setQualityReport(result.qualityReport ?? null);
      setRefinementSummary(result.refinementSummary ?? null);
      setRunJiraIssues(result.jiraIssues ?? []);
      setJiraAllowReExport(false);
      setDuplicatePrdWarning(null);
      setAllowDuplicatePrdGeneration(false);
      setJiraCrossRunDuplicateWarning(null);
      setJiraAllowCrossRunDuplicateExport(false);

      if (options?.switchTab ?? true) {
        setTab("workspace");
      }

      const updatedRun: StoredRun = {
        ...run,
        id: result.run.id,
        title: result.run.title,
        date: result.run.date,
        stories: result.run.stories,
        jira: result.run.jira,
        prd: result.run.prd,
        generatedStories: result.stories,
        majorDecision: result.run.majorDecision || "Pending",
        exportedFormats: run.exportedFormats || [],
        lastSavedAt: result.run.lastSavedAt || run.lastSavedAt,
      };

      setRuns((prev) => upsertRun(updatedRun, prev));
      await loadRunActivitySafe(result.run.id);
    } catch (error) {
      console.error("Failed to restore run from database:", error);
    }
  };

  useEffect(() => {
    async function initializeRuns() {
      await loadCurrentUser();

      const fetchedRuns = await refreshRuns();

      if (fetchedRuns[0]) {
        await restoreRun(fetchedRuns[0], { switchTab: false });
      } else {
        setStories([]);
        setRunActivity([]);
        setQualityReport(null);
        setRefinementSummary(null);
        setRunJiraIssues([]);
        setJiraAllowReExport(false);
        setDuplicatePrdWarning(null);
        setAllowDuplicatePrdGeneration(false);
        setJiraCrossRunDuplicateWarning(null);
        setJiraAllowCrossRunDuplicateExport(false);
      }
    }

    initializeRuns();
  }, []);

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const pollRunStatus = async (runId: string) => {
    const maxPolls = 300; // ~12.5 minutes at 2.5s

    for (let attempt = 0; attempt < maxPolls; attempt++) {
      try {
        const response = await fetch(`/api/runs/${runId}/status`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(
            text || `Failed to load generation status (${response.status})`
          );
        }

        const data = (await response.json()) as {
          ok: true;
          runId: string;
          status: "queued" | "processing" | "ready" | "failed" | "unknown";
          errorMessage?: string | null;
        };

        if (data.status === "queued" || data.status === "processing") {
          setGenerationStatus(data.status);
          await sleep(2500);
          continue;
        }

        if (data.status === "ready") {
          setGenerationStatus("ready");
          setGenerationError("");

          const refreshed = await refreshRuns(runId);

          const targetRun = refreshed.find((run) => run.id === runId);
          if (targetRun) {
            await restoreRun(targetRun, { switchTab: true });
          } else {
            const details = await getRunDetails(runId);

            const restoredRun: StoredRun = {
              id: details.run.id,
              title: details.run.title,
              date: details.run.date,
              stories: details.run.stories,
              jira: details.run.jira,
              prd: details.run.prd,
              generatedStories: details.stories,
              majorDecision: details.run.majorDecision || "Pending",
              exportedFormats: [],
              lastSavedAt: details.run.lastSavedAt || new Date().toISOString(),
            };

            setRuns((prev) => upsertRun(restoredRun, prev));
            await restoreRun(restoredRun, { switchTab: true });
          }

          setProcessing(false);
          setJiraCrossRunDuplicateWarning(null);
          setJiraAllowCrossRunDuplicateExport(false);
          return;
        }

        if (data.status === "failed") {
          setGenerationStatus("failed");
          setGenerationError(data.errorMessage || "Generation failed");
          setProcessing(false);
          return;
        }

        setGenerationStatus("failed");
        setGenerationError("Unknown generation status returned by server");
        setProcessing(false);
        return;
      } catch (error) {
        console.error("Polling run status failed:", error);

        if (attempt < maxPolls - 1) {
          await sleep(2500);
          continue;
        }

        setGenerationStatus("processing");
        setGenerationError(
          "Generation is still running in the background. Please refresh the run in a few moments."
        );
        setProcessing(false);
        return;
      }
    }

    setGenerationStatus("processing");
    setGenerationError(
      "Generation is still running in the background. Please refresh the run in a few moments."
    );
    setProcessing(false);
  };

  const handleDownloadDocuments = async () => {
    if (!currentRunId) return;

    try {
      setDownloading(true);

      const { blob, filename } = await downloadOutputFile(
        currentRunId,
        exportFormat,
        {
          title: exportTitle,
          scope: exportScope,
        }
      );

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download export:", error);
      alert(
        error instanceof Error ? error.message : "Failed to download export"
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleTestJiraConnection = async () => {
    try {
      setJiraTesting(true);
      setJiraConnectionError("");
      setJiraConnectionInfo(null);

      const result = await testJiraConnectionApi();

      setJiraConnectionInfo(result.result);
    } catch (error) {
      console.error("Failed to test Jira connection:", error);
      setJiraConnectionError(
        error instanceof Error ? error.message : "Failed to test Jira connection"
      );
    } finally {
      setJiraTesting(false);
    }
  };

  
  const handleExportCurrentRunToJira = async () => {
    if (!currentRunId) return;

    try {
      setJiraExporting(true);
      setJiraExportError("");
      setJiraExportResult(null);

      const result = await exportRunToJira(
        currentRunId,
        false,
        jiraAllowReExport,
        jiraAllowCrossRunDuplicateExport
      );

      setJiraExportResult({
        runId: result.runId,
        createdCount: result.createdCount,
        createdIssues: result.createdIssues,
      });

      // Refresh runs so Jira count updates in the UI
      const refreshed = await refreshRuns(currentRunId);
      const targetRun = refreshed.find((run) => run.id === currentRunId);

      if (targetRun) {
        await restoreRun(targetRun, { switchTab: false });
      }
    } catch (error) {
      console.error("Failed to export run to Jira:", error);

      const message =
        error instanceof Error ? error.message : "Failed to export run to Jira";

      try {
        const parsed = JSON.parse(message);

        if (parsed?.duplicateAcrossRuns && parsed?.existingExportedRun) {
          setJiraCrossRunDuplicateWarning({
            existingExportedRun: parsed.existingExportedRun,
          });
          return;
        }
      } catch {}

      setJiraExportError(message);
    } finally {
      setJiraExporting(false);
    }
  };

  const [jiraCrossRunDuplicateWarning, setJiraCrossRunDuplicateWarning] =
    useState<{
      existingExportedRun: {
        id: string;
        title: string;
        date: string;
        jira: number;
        stories: number;
        lastSavedAt?: string | null;
      };
    } | null>(null);

  const [jiraAllowCrossRunDuplicateExport, setJiraAllowCrossRunDuplicateExport] =
    useState(false);

  const runGeneration = async () => {
    if (overLimit || !canWrite) return;

    try {
      setProcessing(true);
      setGenerationStatus("queued");
      setGenerationError("");
      setShowApproval(false);
      setSelectedStoryIds([]);
      setQualityReport(null);
      setRefinementSummary(null);
      setTab("workspace");
      setRunJiraIssues([]);

      const response = await generateStories({
        prdText: prd,
        userApprovedMajorChanges: null,
        sourceFileName: uploadedSourceFileName || undefined,
        sourceType: uploadedSourceType || undefined,
        uploadToken: uploadToken || undefined,
        allowDuplicatePrd: allowDuplicatePrdGeneration,
      });

      setCurrentRunId(response.runId);

      const runTitle = getRunTitleFromPrd(prd);
      const today = new Date().toISOString().split("T")[0];

      const queuedRun: StoredRun = {
        id: response.runId,
        title: runTitle || "Generated PRD Run",
        date: today,
        stories: 0,
        jira: 0,
        prd,
        generatedStories: [],
        majorDecision: "Pending",
        exportedFormats: [],
        lastSavedAt: new Date().toISOString(),
      };

      setRuns((prev) => upsertRun(queuedRun, prev));
      setRunActivity([
        {
          id: `queued-${response.runId}`,
          type: "run_created",
          title: "Generation queued",
          description: "The AI generation job has been queued.",
          timestamp: new Date().toISOString(),
        },
      ]);

      setUploadToken("");
      setUploadedSourceFileName("");
      setUploadedSourceType("");

      await pollRunStatus(response.runId);
    
    } catch (error) {
      console.error("Failed to queue or process generation:", error);

      const message =
        error instanceof Error ? error.message : "Failed to generate stories";

      try {
        const parsed = JSON.parse(message);

        if (parsed?.duplicatePrd && parsed?.existingRun) {
          setDuplicatePrdWarning({
            existingRun: parsed.existingRun,
          });
          setProcessing(false);
          setGenerationStatus("idle");
          return;
        }
      } catch {}

      setGenerationStatus("failed");
      setGenerationError(message);
      setProcessing(false);
    }
  };

  const renderExportControls = () => {
    if (!currentRunId) return null;

    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="mb-4">
          <p className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <FileDown className="h-5 w-5" />
            Download Stories as Documents
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Download the selected run as JSON, Markdown, CSV, TXT, DOCX, or
            PDF.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Export title
            </label>
            <input
              value={exportTitle}
              onChange={(e) => setExportTitle(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Export title"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Scope
              </label>
              <select
                value={exportScope}
                onChange={(e) =>
                  setExportScope(
                    e.target.value as "all" | "epics" | "stories"
                  )
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All items</option>
                <option value="epics">Only epics</option>
                <option value="stories">Only stories</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Format
              </label>
              <select
                value={exportFormat}
                onChange={(e) =>
                  setExportFormat(
                    e.target.value as
                      | "json"
                      | "md"
                      | "csv"
                      | "txt"
                      | "docx"
                      | "pdf"
                  )
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="json">JSON</option>
                <option value="md">Markdown (.md)</option>
                <option value="csv">CSV</option>
                <option value="txt">Text (.txt)</option>
                <option value="docx">Word (.docx)</option>
                <option value="pdf">PDF (.pdf)</option>
              </select>
            </div>
          </div>

          <Button
            className="rounded-2xl"
            disabled={downloading}
            onClick={handleDownloadDocuments}
          >
            <FileDown className="mr-2 h-4 w-4" />
            {downloading
              ? "Preparing..."
              : `Download ${exportFormat.toUpperCase()}`}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <Card className="rounded-[28px] border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-900 p-3 text-white">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold tracking-tight">
                      AI Story Forge
                    </p>
                    <p className="text-xs text-slate-500">PRD → Stories</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Access Mode
                      </p>
                      <p className="text-sm font-semibold">
                        {currentUserLoading
                          ? "Loading access..."
                          : currentUser
                          ? `Authenticated (${currentUser.role})`
                          : "Authenticated demo mode"}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-white p-2">
                      <MonitorSmartphone className="h-5 w-5 text-slate-700" />
                    </div>
                  </div>

                  <Badge className="mt-3 rounded-full">
                    {currentUserLoading
                      ? "Loading..."
                      : currentUser
                      ? `${currentUser.role} access`
                      : "Google login enabled"}
                  </Badge>

                  <div className="mt-4 rounded-2xl border bg-white p-3 text-sm text-slate-600">
                    Runs, activity, and sharing are loaded from server APIs and
                    scoped to the signed-in user.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 shadow-sm">
              <CardContent className="space-y-2 p-4">
                <SidebarItem
                  icon={LayoutDashboard}
                  label="Dashboard"
                  active={tab === "dashboard"}
                  onClick={() => setTab("dashboard")}
                />
                <SidebarItem
                  icon={FileText}
                  label="Workspace"
                  active={tab === "workspace"}
                  onClick={() => setTab("workspace")}
                />
                <SidebarItem
                  icon={Link2}
                  label="Integrations"
                  active={tab === "integrations"}
                  onClick={() => setTab("integrations")}
                />
                <SidebarItem
                  icon={Shield}
                  label="Architecture"
                  active={tab === "architecture"}
                  onClick={() => setTab("architecture")}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <History className="h-5 w-5" /> Recent runs
                    </CardTitle>
                    <CardDescription>
                      User-scoped runs loaded from authenticated APIs
                    </CardDescription>
                  </div>

                  <Button
                    className="rounded-2xl"
                    onClick={async () => {
                      const refreshedRuns = await refreshRuns(currentRunId);
                      if (currentRunId) {
                        const targetRun = refreshedRuns.find(
                          (run) => run.id === currentRunId
                        );
                        if (targetRun) {
                          await restoreRun(targetRun, { switchTab: false });
                        }
                      }
                    }}
                  >
                    Refresh runs
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {runs.length === 0 ? (
                  <div className="rounded-2xl border p-4 text-sm text-slate-500">
                    No runs found for the signed-in user yet.
                  </div>
                ) : (
                  runs.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => restoreRun(run)}
                      className="w-full rounded-2xl border p-3 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">
                            {run.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {run.id} · {run.date}
                          </p>
                        </div>
                        <Badge variant="secondary" className="rounded-full">
                          {run.stories} stories
                        </Badge>
                      </div>
                      
                      <div className="mt-2 flex flex-wrap gap-2">
                        {run.jira > 0 ? (
                          <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                            Exported to Jira
                          </Badge>
                        ) : null}

                        <Badge variant="outline" className="rounded-full">
                          Jira: {run.jira}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </aside>

          <main className="space-y-6">
            <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-indigo-50 shadow-sm">
              <div className="grid gap-6 p-6 md:grid-cols-[1.3fr_0.9fr] md:p-8">
                <div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Badge className="rounded-full bg-slate-900 text-white hover:bg-slate-900">
                      MVP Build
                    </Badge>
                    <Badge variant="outline" className="rounded-full">
                      SQLite Persistence
                    </Badge>
                    <Badge variant="outline" className="rounded-full">
                      Auth Enabled
                    </Badge>
                    {currentUser ? (
                      <Badge variant="outline" className="rounded-full">
                        Role: {currentUser.role}
                      </Badge>
                    ) : null}
                  </div>

                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    Build structured agile stories from PRDs with secure run
                    management
                  </h1>

                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                    This version uses authenticated APIs for run access, PRD
                    upload, autonomous refinement, story generation, run
                    sharing, dependency visualization, activity tracking, and
                    requirement quality analysis.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                      className="rounded-2xl"
                      onClick={() => setTab("workspace")}
                    >
                      Open workspace{" "}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button
                      className="rounded-2xl"
                      onClick={runGeneration}
                      disabled={!canWrite || overLimit || processing}
                    >
                      <Wand2 className="mr-2 h-4 w-4" /> Generate stories
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Stat
                    label="Generated stories"
                    value={stories.filter((s) => s.kind === "Story").length}
                    sub="Changes dynamically based on the PRD"
                  />
                  <Stat
                    label="Activity events"
                    value={runActivity.length}
                    sub="Timeline of run creation and uploads"
                  />
                </div>
              </div>
            </section>

            {tab === "dashboard" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Stat
                    label="Runs completed"
                    value={runs.length}
                    sub="Loaded from authenticated APIs"
                  />
                  <Stat
                    label="Stories displayed"
                    value={stories.length}
                    sub="Current generated output in memory"
                  />
                  <Stat
                    label="Selected stories"
                    value={selectedStoryIds.length}
                    sub="Used for targeted review"
                  />
                  <Stat
                    label="Run activity events"
                    value={runActivity.length}
                    sub="Current run timeline from SQLite"
                  />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-6">
                    <Card className="rounded-3xl border-slate-200 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Current Run Summary
                        </CardTitle>
                        <CardDescription>
                          Quick snapshot of the currently selected run.
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {currentRun ? (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <Badge className="rounded-full">
                                {currentRun.id}
                              </Badge>
                              <Badge variant="outline" className="rounded-full">
                                {currentRun.date}
                              </Badge>

                              {currentRun.jira > 0 ? (
                                <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                                  Exported to Jira
                                </Badge>
                              ) : null}

                              <Badge variant="outline" className="rounded-full">
                                Jira: {currentRun.jira}
                              </Badge>
                              <Badge variant="outline" className="rounded-full">
                                Stories: {currentRun.stories}
                              </Badge>
                            </div>

                            <div>
                              <p className="text-xl font-semibold text-slate-900">
                                {currentRun.title}
                              </p>
                              <p className="mt-2 text-sm text-slate-600">
                                Major decision: {majorDecision}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                Last saved: {currentRun.lastSavedAt || "—"}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                              <Button
                                className="rounded-2xl"
                                onClick={() => setTab("workspace")}
                              >
                                Open workspace
                              </Button>

                              {currentRunId ? (
                                <Link href={`/runs/${currentRunId}`}>
                                  <Button className="rounded-2xl">
                                    View run details
                                  </Button>
                                </Link>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <div className="rounded-2xl border p-4 text-sm text-slate-500">
                            No active run selected.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {runJiraIssues.length > 0 ? (
                      <Card className="rounded-3xl border-slate-200 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-lg">Jira Issues for Current Run</CardTitle>
                          <CardDescription>
                            Issues that were created in Jira from this run.
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-3">
                          {runJiraIssues.map((issue) => (
                            <div
                              key={`${issue.story_id}-${issue.issue_key}`}
                              className="rounded-2xl border border-slate-200 bg-white p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="rounded-full">{issue.issue_key}</Badge>
                                <a
                                  href={issue.issue_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm font-medium text-blue-700 underline"
                                >
                                  Open in Jira
                                </a>
                              </div>

                              <p className="mt-2 text-sm text-slate-600">
                                Story ID: {issue.story_id}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Created at: {issue.created_at}
                              </p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    ) : null}

                    {renderExportControls()}

                    {currentRunId && canWrite ? (
                      <RunShareManager
                        runId={currentRunId}
                        enabled={canWrite}
                      />
                    ) : null}
                  </div>

                  <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">Quick Actions</CardTitle>
                      <CardDescription>
                        Jump into the most common actions quickly.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <Button
                        className="w-full justify-start rounded-2xl"
                        onClick={() => setTab("workspace")}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Open PRD workspace
                      </Button>

                      <Button
                        className="w-full justify-start rounded-2xl"
                        onClick={runGeneration}
                        disabled={!canWrite || overLimit || processing}
                      >
                        <Wand2 className="mr-2 h-4 w-4" />
                        Generate stories
                      </Button>

                      <Button
                        className="w-full justify-start rounded-2xl"
                        disabled={!canWrite}
                        onClick={() => setTab("integrations")}
                      >
                        <Link2 className="mr-2 h-4 w-4" />
                        Open integrations
                      </Button>

                      <Button
                        className="w-full justify-start rounded-2xl"
                        onClick={() => setTab("architecture")}
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        View architecture
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                  <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Recent Activity Preview
                      </CardTitle>
                      <CardDescription>
                        Latest events from the selected run.
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      {latestActivities.length === 0 ? (
                        <div className="rounded-2xl border p-4 text-sm text-slate-500">
                          No recent activity available.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {latestActivities.map((activity) => (
                            <div
                              key={activity.id}
                              className="rounded-2xl border p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="rounded-full"
                                >
                                  {activity.type.replace("_", " ")}
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className="rounded-full"
                                >
                                  {activity.timestamp}
                                </Badge>
                              </div>
                              <p className="mt-2 font-medium text-slate-900">
                                {activity.title}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {activity.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Primary Workflow
                      </CardTitle>
                      <CardDescription>
                        Current authenticated AI-assisted prototype flow
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="grid gap-4 md:grid-cols-2">
                      {[
                        {
                          icon: FileText,
                          title: "PRD Input",
                          body: "Paste a product requirement document or upload a supported source file.",
                        },
                        {
                          icon: Upload,
                          title: "Source File Upload",
                          body: "Upload .txt, .md, .docx, or .pdf PRDs and extract text automatically.",
                        },
                        {
                          icon: Wand2,
                          title: "Generate Stories",
                          body: "Background AI jobs autonomously refine the PRD and generate stories.",
                        },
                        {
                          icon: History,
                          title: "Track Activity",
                          body: "Run creation, corrections, quality-analysis events, and refinement rounds are visible.",
                        },
                      ].map((item, idx) => {
                        const Icon = item.icon;
                        return (
                          <Card
                            key={idx}
                            className="rounded-3xl border-slate-200 shadow-none"
                          >
                            <CardContent className="p-5">
                              <div className="mb-3 inline-flex rounded-2xl bg-slate-100 p-3">
                                <Icon className="h-5 w-5 text-slate-700" />
                              </div>
                              <p className="font-semibold text-slate-900">
                                {item.title}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {item.body}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {tab === "workspace" && (
              <div className="space-y-6">
                <Card className="rounded-3xl border-slate-200 shadow-sm">
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <FileText className="h-5 w-5" /> PRD input workspace
                        </CardTitle>
                        <CardDescription>
                          Upload or paste product input. Maximum {WORD_LIMIT}{" "}
                          words.
                        </CardDescription>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".txt,.md,.docx,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const input = e.currentTarget;
                            const file = input.files?.[0];

                            input.value = "";

                            if (file) {
                              void handlePrdUpload(file);
                            }
                          }}
                        />

                        <Button
                          className="rounded-2xl"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading || !canWrite}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {uploading ? "Uploading..." : "Upload document"}
                        </Button>

                        <Button
                          className="rounded-2xl"
                          disabled={overLimit || processing || !canWrite}
                          onClick={runGeneration}
                        >
                          <Wand2 className="mr-2 h-4 w-4" />
                          {processing ? "Submitting..." : "Generate stories"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <Textarea
                      className="min-h-[240px] rounded-2xl"
                      value={prd}
                      onChange={(e) => setPrd(e.target.value)}
                    />

                    {isViewer ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Your current role is <strong>viewer</strong>. You can
                        inspect runs, stories, and activity, but upload/generate
                        actions are disabled.
                      </div>
                    ) : null}

                    {uploadedSourceFileName ? (
                      <div className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-600">
                        <p className="font-medium text-slate-900">
                          Uploaded source file
                        </p>
                        <p className="mt-1">
                          {uploadedSourceFileName} (
                          {uploadedSourceType || "unknown"})
                        </p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <Badge className="rounded-full">
                          {wordCount} words
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          {remaining} remaining
                        </Badge>
                      </div>
                      <span
                        className={overLimit ? "text-red-600" : "text-slate-500"}
                      >
                        {overLimit
                          ? `Input exceeds the ${WORD_LIMIT}-word limit.`
                          : "AI-driven decomposition is enabled for this build."}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                
                {duplicatePrdWarning ? (
                  <Card className="rounded-3xl border-amber-200 bg-amber-50/80 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg text-amber-900">
                        Duplicate PRD detected
                      </CardTitle>
                      <CardDescription className="text-amber-800">
                        A matching PRD has already been processed before.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="rounded-2xl border border-amber-200 bg-white p-4 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">
                          Existing run: {duplicatePrdWarning.existingRun.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {duplicatePrdWarning.existingRun.id}
                        </p>
                        <p className="mt-2">
                          Stories: {duplicatePrdWarning.existingRun.stories} · Jira:{" "}
                          {duplicatePrdWarning.existingRun.jira}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          className="rounded-2xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                          onClick={async () => {
                            const target = runs.find(
                              (run) => run.id === duplicatePrdWarning.existingRun.id
                            );

                            if (target) {
                              await restoreRun(target);
                            } else {
                              await refreshRuns(duplicatePrdWarning.existingRun.id);
                            }

                            setDuplicatePrdWarning(null);
                            setAllowDuplicatePrdGeneration(false);
                            setJiraCrossRunDuplicateWarning(null);
                            setJiraAllowCrossRunDuplicateExport(false);
                          }}
                        >
                          Open existing run
                        </Button>

                        <Button
                          className="rounded-2xl"
                          onClick={() => {
                            setAllowDuplicatePrdGeneration(true);
                            setDuplicatePrdWarning(null);
                            void runGeneration();
                          }}
                        >
                          Generate new run anyway
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {generationStatus !== "idle" ? (
                  <Card
                    className={`rounded-3xl shadow-sm ${
                      generationStatus === "failed"
                        ? "border-rose-200 bg-rose-50/70"
                        : generationStatus === "ready"
                        ? "border-emerald-200 bg-emerald-50/70"
                        : generationError
                        ? "border-amber-200 bg-amber-50/70"
                        : "border-sky-200 bg-sky-50/70"
                    }`}
                  >
                    <CardHeader>
                      <CardTitle
                        className={`text-lg ${
                          generationStatus === "failed"
                            ? "text-rose-900"
                            : generationStatus === "ready"
                            ? "text-emerald-900"
                            : generationError
                            ? "text-amber-900"
                            : "text-sky-900"
                        }`}
                      >
                        {generationStatus === "queued" && "Generation queued"}
                        {generationStatus === "processing" &&
                          !generationError &&
                          "Generation in progress"}
                        {generationStatus === "processing" &&
                          generationError &&
                          "Generation still running"}
                        {generationStatus === "ready" &&
                          "Generation completed"}
                        {generationStatus === "failed" && "Generation failed"}
                      </CardTitle>

                      <CardDescription
                        className={
                          generationStatus === "failed"
                            ? "text-rose-800"
                            : generationStatus === "ready"
                            ? "text-emerald-800"
                            : generationError
                            ? "text-amber-800"
                            : "text-sky-800"
                        }
                      >
                        {generationStatus === "queued" &&
                          "Your request has been accepted and is waiting in the background queue."}
                        {generationStatus === "processing" &&
                          !generationError &&
                          "The AI pipeline is autonomously refining and processing this PRD in the background."}
                        {generationStatus === "processing" &&
                          generationError &&
                          "The generation is still running in the background. Refresh this run in a few moments if needed."}
                        {generationStatus === "ready" &&
                          "The generated run is ready and has been loaded into the workspace."}
                        {generationStatus === "failed" &&
                          "The generation job failed. See the message below for details."}
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {currentRunId ? (
                          <Badge className="rounded-full">{currentRunId}</Badge>
                        ) : null}

                        <Badge variant="outline" className="rounded-full">
                          Status: {generationStatus}
                        </Badge>
                      </div>

                      {generationError ? (
                        <div className="mt-4 rounded-2xl border bg-white p-4 text-sm">
                          {generationError}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : null}

                {minorCorrections.length > 0 ? (
                  <Card className="rounded-3xl border-emerald-200 bg-emerald-50/60 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-emerald-900">
                        <Sparkles className="h-5 w-5" />
                        Minor corrections applied
                      </CardTitle>
                      <CardDescription className="text-emerald-800">
                        The AI made small, non-meaning-changing improvements to
                        clarity or formatting.
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <ul className="list-disc space-y-2 pl-5 text-sm text-emerald-900">
                        {minorCorrections.map((item, index) => (
                          <li key={`minor-correction-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ) : null}

                {refinementSummary ? (
                  <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Autonomous Quality Refinement Summary
                      </CardTitle>
                      <CardDescription>
                        The background worker refined the PRD automatically
                        before final story generation.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-5">
                      <div className="flex flex-wrap gap-2">
                        <Badge className="rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                          Rounds used: {refinementSummary.roundsUsed}/
                          {refinementSummary.maxRefinementRounds}
                        </Badge>
                        <Badge className="rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                          Stop reason:{" "}
                          {refinementSummary.stoppedReason.replace(/_/g, " ")}
                        </Badge>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border bg-slate-50 p-4">
                          <p className="font-semibold text-slate-900">
                            Before refinement
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge className="rounded-full border border-rose-200 bg-rose-50 text-rose-700">
                              Blockers:{" "}
                              {refinementSummary.originalCounts.blockers}
                            </Badge>
                            <Badge className="rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                              Warnings:{" "}
                              {refinementSummary.originalCounts.warnings}
                            </Badge>
                            <Badge className="rounded-full border border-sky-200 bg-sky-50 text-sky-700">
                              Suggestions:{" "}
                              {refinementSummary.originalCounts.suggestions}
                            </Badge>
                          </div>
                        </div>

                        <div className="rounded-2xl border bg-slate-50 p-4">
                          <p className="font-semibold text-slate-900">
                            After refinement
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge className="rounded-full border border-rose-200 bg-rose-50 text-rose-700">
                              Blockers: {refinementSummary.finalCounts.blockers}
                            </Badge>
                            <Badge className="rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                              Warnings: {refinementSummary.finalCounts.warnings}
                            </Badge>
                            <Badge className="rounded-full border border-sky-200 bg-sky-50 text-sky-700">
                              Suggestions:{" "}
                              {refinementSummary.finalCounts.suggestions}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {refinementSummary.rounds.length > 0 ? (
                        <div className="space-y-4">
                          {refinementSummary.rounds.map((round) => (
                            <div
                              key={`refinement-round-${round.round}`}
                              className="rounded-2xl border border-slate-200 bg-white p-4"
                            >
                              <p className="font-semibold text-slate-900">
                                Refinement round {round.round}
                              </p>

                              <div className="mt-3 grid gap-4 md:grid-cols-2">
                                <div className="rounded-xl border bg-slate-50 p-3 text-sm">
                                  <p className="font-medium text-slate-900">
                                    Input counts
                                  </p>
                                  <p className="mt-2 text-slate-700">
                                    Blockers: {round.inputCounts.blockers},
                                    Warnings: {round.inputCounts.warnings},
                                    Suggestions:{" "}
                                    {round.inputCounts.suggestions}
                                  </p>
                                </div>

                                <div className="rounded-xl border bg-slate-50 p-3 text-sm">
                                  <p className="font-medium text-slate-900">
                                    Output counts
                                  </p>
                                  <p className="mt-2 text-slate-700">
                                    Blockers: {round.outputCounts.blockers},
                                    Warnings: {round.outputCounts.warnings},
                                    Suggestions:{" "}
                                    {round.outputCounts.suggestions}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4">
                                <p className="font-medium text-slate-900">
                                  Summary
                                </p>
                                <p className="mt-1 text-sm text-slate-700">
                                  {round.summary}
                                </p>
                              </div>

                              {round.appliedChanges.length > 0 ? (
                                <div className="mt-4">
                                  <p className="font-medium text-slate-900">
                                    Applied changes
                                  </p>
                                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700">
                                    {round.appliedChanges.map((item, index) => (
                                      <li
                                        key={`round-${round.round}-change-${index}`}
                                      >
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                          No autonomous refinement rounds were needed. The PRD
                          already met the refinement threshold.
                        </div>
                      )}

                      <div>
                        <p className="mb-2 font-semibold text-slate-900">
                          Final corrected PRD used for generation
                        </p>
                        <Textarea
                          className="min-h-[260px] rounded-2xl"
                          value={refinementSummary.finalCorrectedPrd}
                          readOnly
                        />
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {qualityReport ? (
                  <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Requirement Quality Report
                      </CardTitle>
                      <CardDescription>
                        AI-detected requirement quality issues based on the
                        refined PRD used for generation.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-5">
                      <div className="flex flex-wrap gap-2">
                        <Badge className="rounded-full border border-rose-200 bg-rose-50 text-rose-700">
                          Blockers: {qualityReport.blockerCount}
                        </Badge>
                        <Badge className="rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                          Warnings: {qualityReport.warningCount}
                        </Badge>
                        <Badge className="rounded-full border border-sky-200 bg-sky-50 text-sky-700">
                          Suggestions: {qualityReport.suggestionCount}
                        </Badge>
                      </div>

                      <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                        {qualityReport.summary}
                      </div>

                      {qualityReport.flags.length === 0 ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                          No major requirement quality issues were detected in
                          this PRD.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {qualityReport.flags.map((flag, index) => (
                            <div
                              key={`quality-flag-${index}`}
                              className="rounded-2xl border border-slate-200 bg-white p-4"
                            >
                              <div className="mb-3 flex flex-wrap items-center gap-2">
                                <Badge
                                  className={`rounded-full border ${qualitySeverityTone(
                                    flag.severity
                                  )}`}
                                >
                                  {flag.severity}
                                </Badge>
                                <Badge variant="outline" className="rounded-full">
                                  {flag.category}
                                </Badge>
                                {flag.sectionHint ? (
                                  <Badge
                                    variant="secondary"
                                    className="rounded-full"
                                  >
                                    {flag.sectionHint}
                                  </Badge>
                                ) : null}
                              </div>

                              <div className="space-y-3 text-sm">
                                <div>
                                  <p className="font-medium text-slate-900">
                                    Quoted text
                                  </p>
                                  <p className="mt-1 rounded-xl border bg-slate-50 p-3 text-slate-700">
                                    {flag.quotedText}
                                  </p>
                                </div>

                                <div>
                                  <p className="font-medium text-slate-900">
                                    Why this matters
                                  </p>
                                  <p className="mt-1 text-slate-700">
                                    {flag.reason}
                                  </p>
                                </div>

                                <div>
                                  <p className="font-medium text-slate-900">
                                    Suggested fix
                                  </p>
                                  <p className="mt-1 text-slate-700">
                                    {flag.suggestedFix}
                                  </p>
                                </div>

                                {flag.requirementIds.length > 0 ? (
                                  <div>
                                    <p className="font-medium text-slate-900">
                                      Related requirement IDs
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {flag.requirementIds.map((id) => (
                                        <Badge
                                          key={id}
                                          variant="outline"
                                          className="rounded-full"
                                        >
                                          {id}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null}

                <AnimatePresence>
                  {showApproval && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      <Card className="rounded-3xl border-amber-200 bg-amber-50/70 shadow-sm">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Sparkles className="h-5 w-5 text-amber-700" /> AI
                            correction approval
                          </CardTitle>
                          <CardDescription>
                            A major structure improvement was detected before
                            decomposition.
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Card className="rounded-3xl border-slate-200 shadow-sm">
                  <CardHeader>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Sparkles className="h-5 w-5" /> Generated output
                        </CardTitle>
                        <CardDescription>
                          Story cards and dependency graph update from the
                          generated response.
                        </CardDescription>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Badge className="rounded-full">
                          Decision: {majorDecision}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          {stories.length} items
                        </Badge>

                        {runJiraIssues.length > 0 ? (
                          <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                            Exported to Jira
                          </Badge>
                        ) : null}

                        {currentRunId ? (
                          <Link href={`/runs/${currentRunId}`}>
                            <Button className="rounded-2xl">
                              View Run Details
                            </Button>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <GitBranch className="h-5 w-5" />
                        <h3 className="text-base font-semibold">
                          Story dependency visualization
                        </h3>
                      </div>
                      <DependencyGraph stories={stories} />
                    </div>

                    <Separator />

                    <div className="rounded-2xl border p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">
                            Story selection
                          </p>
                          <p className="text-sm text-slate-600">
                            Choose specific stories for review.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-full">
                            Selected: {selectedStoryIds.length}
                          </Badge>

                          <Button
                            className="rounded-2xl"
                            onClick={selectAllStories}
                          >
                            Select all stories
                          </Button>

                          <Button
                            className="rounded-2xl"
                            onClick={clearSelectedStories}
                          >
                            Clear selection
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {stories.map((story) => (
                        <StoryCard
                          key={story.id}
                          story={story}
                          selectable
                          selected={selectedStoryIds.includes(story.id)}
                          onToggleSelect={toggleStorySelection}
                        />
                      ))}
                    </div>

                    {renderExportControls()}
                  </CardContent>
                </Card>

                {runJiraIssues.length > 0 ? (
                  <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">Jira Export Results</CardTitle>
                      <CardDescription>
                        This run has already been exported to Jira.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge className="rounded-full">
                          Jira issues: {runJiraIssues.length}
                        </Badge>
                      </div>

                      {runJiraIssues.map((issue) => (
                        <div
                          key={`${issue.story_id}-${issue.issue_key}`}
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="rounded-full">{issue.issue_key}</Badge>
                            <a
                              href={issue.issue_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-medium text-blue-700 underline"
                            >
                              Open in Jira
                            </a>
                          </div>

                          <p className="mt-2 text-sm text-slate-600">
                            Story ID: {issue.story_id}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Created at: {issue.created_at}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="rounded-3xl border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <History className="h-5 w-5" /> Run Activity
                    </CardTitle>
                    <CardDescription>
                      Timeline of uploads and run creation events.
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    {runActivity.length === 0 ? (
                      <div className="rounded-2xl border p-4 text-sm text-slate-500">
                        No activity recorded yet for this run.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {runActivity.map((activity) => (
                          <div
                            key={activity.id}
                            className="rounded-2xl border p-4 transition hover:bg-slate-50"
                          >
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {activity.title}
                                </p>
                                <p className="mt-1 text-sm text-slate-600">
                                  {activity.description}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Badge
                                  variant="outline"
                                  className="rounded-full"
                                >
                                  {activity.type.replace("_", " ")}
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className="rounded-full"
                                >
                                  {activity.timestamp}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            
            {tab === "integrations" && (
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <Card className="rounded-3xl border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Link2 className="h-5 w-5" /> Jira Integration
                    </CardTitle>
                    <CardDescription>
                      Test Jira connectivity and export the current generated run into Jira.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="rounded-2xl"
                        onClick={handleTestJiraConnection}
                        disabled={jiraTesting}
                      >
                        {jiraTesting ? "Testing..." : "Test Jira Connection"}
                      </Button>

                      <Button
                        className="rounded-2xl"
                        onClick={handleExportCurrentRunToJira}
                        disabled={
                          jiraExporting ||
                          !currentRunId ||
                          (runJiraIssues.length > 0 && !jiraAllowReExport)
                        }
                      >
                        {jiraExporting ? "Exporting..." : "Export Current Run to Jira"}
                      </Button>
                    </div>

                    {!currentRunId ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        No active run is selected. Open a run first, then export it to Jira.
                      </div>
                    ) : (
                      <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">Current run</p>
                        <p className="mt-1">
                          {currentRun?.title || currentRunId}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{currentRunId}</p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {runJiraIssues.length > 0 ? (
                            <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                              Exported to Jira
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-full">
                              Not exported yet
                            </Badge>
                          )}

                          <Badge variant="outline" className="rounded-full">
                            Jira issues: {runJiraIssues.length}
                          </Badge>
                        </div>
                      </div>
                    )}

                    {jiraCrossRunDuplicateWarning ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="font-semibold">
                          A different run based on the same PRD was already exported to Jira.
                        </p>

                        <div className="mt-3 rounded-2xl border border-amber-200 bg-white p-3 text-slate-700">
                          <p className="font-medium text-slate-900">
                            Existing exported run:{" "}
                            {jiraCrossRunDuplicateWarning.existingExportedRun.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {jiraCrossRunDuplicateWarning.existingExportedRun.id}
                          </p>
                          <p className="mt-2">
                            Stories: {jiraCrossRunDuplicateWarning.existingExportedRun.stories} · Jira:{" "}
                            {jiraCrossRunDuplicateWarning.existingExportedRun.jira}
                          </p>
                        </div>

                        <label className="mt-3 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={jiraAllowCrossRunDuplicateExport}
                            onChange={(e) =>
                              setJiraAllowCrossRunDuplicateExport(e.target.checked)
                            }
                          />
                          <span>
                            Allow cross-run export anyway (may create duplicate Jira issues)
                          </span>
                        </label>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <Button
                            className="rounded-2xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                            onClick={async () => {
                              const target = runs.find(
                                (run) =>
                                  run.id === jiraCrossRunDuplicateWarning.existingExportedRun.id
                              );

                              if (target) {
                                await restoreRun(target);
                              } else {
                                await refreshRuns(
                                  jiraCrossRunDuplicateWarning.existingExportedRun.id
                                );
                              }

                              setJiraCrossRunDuplicateWarning(null);
                              setJiraAllowCrossRunDuplicateExport(false);
                              setJiraCrossRunDuplicateWarning(null);
                              setJiraAllowCrossRunDuplicateExport(false);
                            }}
                          >
                            Open exported run
                          </Button>

                          <Button
                            className="rounded-2xl"
                            disabled={!jiraAllowCrossRunDuplicateExport}
                            onClick={() => {
                              setJiraCrossRunDuplicateWarning(null);
                              void handleExportCurrentRunToJira();
                            }}
                          >
                            Export anyway
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {runJiraIssues.length > 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="font-semibold">This run was already exported to Jira.</p>
                        <p className="mt-2">
                          Existing Jira issues found: <strong>{runJiraIssues.length}</strong>
                        </p>
                        <label className="mt-3 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={jiraAllowReExport}
                            onChange={(e) => setJiraAllowReExport(e.target.checked)}
                          />
                          <span>Allow re-export (may create duplicate Jira issues)</span>
                        </label>
                      </div>
                    ) : null}

                    {jiraConnectionInfo ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="font-semibold text-emerald-900">
                          Jira connection successful
                        </p>
                        <div className="mt-3 space-y-1 text-sm text-emerald-900">
                          <p>
                            <span className="font-medium">User:</span>{" "}
                            {jiraConnectionInfo.user.displayName}
                          </p>
                          <p>
                            <span className="font-medium">Email:</span>{" "}
                            {jiraConnectionInfo.user.emailAddress || "N/A"}
                          </p>
                          <p>
                            <span className="font-medium">Project:</span>{" "}
                            {jiraConnectionInfo.project.name} (
                            {jiraConnectionInfo.project.key})
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {jiraConnectionError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                        {jiraConnectionError}
                      </div>
                    ) : null}

                    {jiraExportResult ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="font-semibold text-emerald-900">
                          Jira export completed
                        </p>
                        <p className="mt-2 text-sm text-emerald-900">
                          Created <strong>{jiraExportResult.createdCount}</strong> issue(s)
                          for run <strong>{jiraExportResult.runId}</strong>.
                        </p>

                        <div className="mt-4 space-y-3">
                          {jiraExportResult.createdIssues.map((issue) => (
                            <div
                              key={`${issue.storyId}-${issue.issueKey}`}
                              className="rounded-2xl border border-emerald-200 bg-white p-3"
                            >
                              <p className="font-medium text-slate-900">
                                {issue.storyTitle}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge className="rounded-full">{issue.issueKey}</Badge>
                                <a
                                  href={issue.issueUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-blue-600 underline"
                                >
                                  Open in Jira
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {jiraExportError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                        {jiraExportError}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Integration Notes</CardTitle>
                    <CardDescription>
                      Current Jira integration status and usage guidance.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 text-sm text-slate-700">
                    <div className="rounded-2xl border p-4">
                      <p className="font-semibold text-slate-900">Current Phase</p>
                      <p className="mt-2">
                        Phase 1 and Phase 2 Jira integration are now enabled:
                      </p>
                      <ul className="mt-2 list-disc space-y-2 pl-5">
                        <li>Jira connection test</li>
                        <li>Run export to Jira</li>
                        <li>Issue key + URL display in UI</li>
                        <li>Run Jira count refresh after export</li>
                      </ul>
                    </div>

                    <div className="rounded-2xl border p-4">
                      <p className="font-semibold text-slate-900">Current Limitation</p>
                      <p className="mt-2">
                        This phase exports standard story/task items. Epic-specific Jira
                        hierarchy handling can be added in a later phase if needed.
                      </p>
                    </div>

                    <div className="rounded-2xl border p-4">
                      <p className="font-semibold text-slate-900">Recommended Demo Flow</p>
                      <ol className="mt-2 list-decimal space-y-2 pl-5">
                        <li>Generate a run from a sample PRD</li>
                        <li>Open this Integrations tab</li>
                        <li>Click “Test Jira Connection”</li>
                        <li>Click “Export Current Run to Jira”</li>
                        <li>Open the created issue links</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {tab === "architecture" && (
              <div className="space-y-6">
                <Card className="rounded-3xl border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Shield className="h-5 w-5" /> Production architecture
                      blueprint
                    </CardTitle>
                    <CardDescription>
                      Auth-enabled prototype with SQLite persistence, run
                      sharing, async AI generation jobs, and autonomous
                      requirement refinement.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        icon: FileText,
                        title: "PRD Workspace",
                        body: "Users can paste or upload PRD content.",
                      },
                      {
                        icon: BrainCircuit,
                        title: "Autonomous Refinement",
                        body: "AI quality analysis and iterative refinement happen automatically in the worker.",
                      },
                      {
                        icon: History,
                        title: "Quality Timeline",
                        body: "Corrections, quality-analysis results, and refinement rounds are persisted and visible.",
                      },
                      {
                        icon: Shield,
                        title: "RBAC",
                        body: "Admins, editors, and viewers have enforced access rules.",
                      },
                    ].map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <Card
                          key={idx}
                          className="rounded-3xl border-slate-200 shadow-none"
                        >
                          <CardContent className="p-5">
                            <div className="mb-3 inline-flex rounded-2xl bg-slate-100 p-3">
                              <Icon className="h-5 w-5 text-slate-700" />
                            </div>
                            <p className="font-semibold text-slate-900">
                              {item.title}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {item.body}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

