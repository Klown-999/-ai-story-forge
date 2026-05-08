
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FileDown, FileText, GitBranch, History } from "lucide-react";

import type { Story } from "@/types";
import { downloadOutputFile } from "@/lib/api";
import DependencyGraph from "@/components/stories/DependencyGraph";
import StoryCard from "@/components/stories/StoryCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
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
  activities: Array<{
    id: string;
    type: "run_created" | "source_prd" | "export" | "jira_payload";
    title: string;
    description: string;
    timestamp: string;
  }>;
};

export default function RunDetailsClient({ run, stories, activities }: Props) {
  const [exportFormat, setExportFormat] = useState<
    "json" | "md" | "csv" | "txt" | "docx" | "pdf"
  >("json");
  const [exportScope, setExportScope] = useState<"all" | "epics" | "stories">(
    "all"
  );
  const [exportTitle, setExportTitle] = useState(
    run.title || "AI Story Forge Export"
  );
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);

      const { blob, filename } = await downloadOutputFile(
        run.id,
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Run Details
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Inspect the generated PRD run, activity, and export options.
            </p>
          </div>

          <Link href="/">
            <Button className="rounded-2xl">← Back to Dashboard</Button>
          </Link>
        </div>

        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{run.title}</CardTitle>
            <CardDescription>
              Detailed view of this generated run
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{run.id}</Badge>
              <Badge variant="outline">{run.date}</Badge>
              <Badge variant="outline">Stories: {run.stories}</Badge>
              <Badge variant="outline">Jira: {run.jira}</Badge>
              <Badge variant="outline">Decision: {run.majorDecision}</Badge>
            </div>

            {run.sourceFileName ? (
              <div className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-600">
                <p className="font-medium text-slate-900">Source file</p>
                <p className="mt-1">
                  {run.sourceFileName} ({run.sourceType || "unknown"})
                </p>
              </div>
            ) : null}

            <div className="rounded-2xl border p-4">
              <p className="font-medium text-slate-900">PRD</p>
              <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                {run.prd}
              </pre>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileDown className="h-5 w-5" /> Download Export
              </CardTitle>
              <CardDescription>
                Download this run in JSON, Markdown, CSV, TXT, DOCX, or PDF.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Export title
                </label>
                <Input
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                  className="rounded-2xl"
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
                onClick={handleDownload}
              >
                <FileDown className="mr-2 h-4 w-4" />
                {downloading
                  ? "Preparing..."
                  : `Download ${exportFormat.toUpperCase()}`}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5" /> Run Activity
              </CardTitle>
              <CardDescription>
                Timeline of uploads and generation activity
              </CardDescription>
            </CardHeader>

            <CardContent>
              {activities.length === 0 ? (
                <div className="rounded-2xl border p-4 text-sm text-slate-500">
                  No activity found for this run.
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
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
                          <Badge variant="outline">
                            {activity.type.replace("_", " ")}
                          </Badge>
                          <Badge variant="secondary">{activity.timestamp}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitBranch className="h-5 w-5" /> Dependency Graph
            </CardTitle>
            <CardDescription>
              Story dependency visualization for this run
            </CardDescription>
          </CardHeader>

          <CardContent>
            <DependencyGraph stories={stories} />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" /> Generated Stories
            </CardTitle>
            <CardDescription>
              Detailed story cards generated for this run
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {stories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
