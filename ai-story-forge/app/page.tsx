
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  generateStories,
  getRunActivity,
  getRunDetails,
  getRuns,
  uploadPrdFile,
} from "@/lib/api";

type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "viewer";
  provider?: string | null;
};

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

export default function AIAgileStoryForgeWebsite() {
  const [tab, setTab] = useState("dashboard");
  const [processing, setProcessing] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [majorDecision, setMajorDecision] = useState("Pending");

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

  const [uploadedSourceFileName, setUploadedSourceFileName] = useState("");
  const [uploadedSourceType, setUploadedSourceType] = useState("");
  const [uploadToken, setUploadToken] = useState("");
  const [uploading, setUploading] = useState(false);

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
        message.includes("\"Run activity not found\"")
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
      }
    }

    initializeRuns();
  }, []);

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

  const runGeneration = async () => {
    if (overLimit || !canWrite) return;

    try {
      setProcessing(true);

      const response = await generateStories({
        prdText: prd,
        userApprovedMajorChanges: null,
        sourceFileName: uploadedSourceFileName || undefined,
        sourceType: uploadedSourceType || undefined,
        uploadToken: uploadToken || undefined,
      });

      setStories(response.stories);
      setCurrentRunId(response.runId);
      setShowApproval(response.correctionPreview.requiresApproval);
      setMajorDecision("Pending");
      setSelectedStoryIds([]);
      setTab("workspace");

      const runTitle = getRunTitleFromPrd(prd);
      const today = new Date().toISOString().split("T")[0];

      const newRun: StoredRun = {
        id: response.runId,
        title: runTitle || "Generated PRD Run",
        date: today,
        stories: response.summary.storyCount,
        jira: 0,
        prd,
        generatedStories: response.stories,
        majorDecision: "Pending",
        exportedFormats: [],
        lastSavedAt: new Date().toISOString(),
      };

      setRuns((prev) => upsertRun(newRun, prev));
      await refreshRuns(response.runId);
      await restoreRun(newRun, { switchTab: true });

      setUploadToken("");
      setUploadedSourceFileName("");
      setUploadedSourceType("");
    } catch (error) {
      console.error("Failed to generate stories:", error);
      alert(
        error instanceof Error ? error.message : "Failed to generate stories"
      );
    } finally {
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
            Download the selected run as JSON, Markdown, CSV, TXT, DOCX, or PDF.
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
                    upload, story generation, run sharing, dependency
                    visualization, and activity tracking.
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
                        Current authenticated prototype flow
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
                          body: "Backend route builds stories dynamically and saves them to SQLite.",
                        },
                        {
                          icon: History,
                          title: "Track Activity",
                          body: "Run creation and uploads are visible in a timeline.",
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
                          {processing ? "Generating..." : "Generate stories"}
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
                          : "Dynamic PRD-driven generation is enabled for this build."}
                      </span>
                    </div>
                  </CardContent>
                </Card>

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
              <div className="grid gap-6 xl:grid-cols-2">
                <Card className="rounded-3xl border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MonitorSmartphone className="h-5 w-5" /> Authenticated
                      app mode
                    </CardTitle>
                    <CardDescription>
                      Google sign-in is enabled
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 text-sm text-slate-700">
                    <div className="rounded-2xl border p-4">
                      <p className="font-semibold text-slate-900">
                        Authenticated access
                      </p>
                      <p className="mt-2">
                        The application uses Google sign-in and protects server
                        APIs using authenticated route access and user-scoped
                        runs.
                      </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="font-semibold text-slate-900">
                        Run sharing
                      </p>
                      <p className="mt-2">
                        Editors and admins can share selected runs with viewer
                        users for read-only access.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Link2 className="h-5 w-5" /> External integrations
                    </CardTitle>
                    <CardDescription>
                      Reserved for future integrations
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 text-sm text-slate-700">
                    <div className="rounded-2xl border p-4">
                      <p className="font-semibold text-slate-900">Jira</p>
                      <p className="mt-2">
                        Jira is intentionally on hold in this recovery build.
                      </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="font-semibold text-slate-900">
                        AI upgrade path
                      </p>
                      <p className="mt-2">
                        The generator now responds dynamically to the uploaded
                        PRD structure, and can be upgraded to a fully AI-based
                        pipeline later.
                      </p>
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
                      Auth-enabled prototype with SQLite persistence and run
                      sharing
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
                        title: "Story Generation",
                        body: "Runs and stories are stored in SQLite with role-based access.",
                      },
                      {
                        icon: History,
                        title: "Activity Timeline",
                        body: "Run creation and uploads are persisted and viewable.",
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
  