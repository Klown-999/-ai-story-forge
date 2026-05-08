
"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import type { Story } from "@/types";
import { Input } from "@/components/ui/input";

type Props = {
  stories: Story[];
};

type EpicGroup = {
  epic: Story;
  stories: Story[];
};

type DerivedStoryMeta = {
  status: "Ready" | "Review" | "Needs Work";
  confidence: number;
  qualityScore: number;
};

function truncate(text: string, max = 40) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function buildGroups(stories: Story[]): EpicGroup[] {
  const byId = new Map(stories.map((story) => [story.id, story]));
  const epics = stories.filter((story) => story.kind === "Epic");

  return epics.map((epic) => {
    const children = stories.filter((story) => {
      if (story.kind !== "Story") return false;

      return story.dependsOn.some(
        (depId) => byId.get(depId)?.kind === "Epic" && depId === epic.id
      );
    });

    return {
      epic,
      stories: children,
    };
  });
}

function estimateTone(estimate: string) {
  switch ((estimate || "").toUpperCase()) {
    case "XL":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "L":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "M":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "S":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function statusTone(status: DerivedStoryMeta["status"]) {
  switch (status) {
    case "Ready":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Review":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-rose-50 text-rose-700 border-rose-200";
  }
}

function deriveStoryMeta(story: Story): DerivedStoryMeta {
  const acceptanceCount = story.acceptance.length;
  const labelCount = story.labels.length;
  const hasOwner = !!story.owner && story.owner !== "—";
  const dependencyCount = story.dependsOn.length;

  let qualityScore = 35;
  qualityScore += Math.min(acceptanceCount * 12, 36);
  qualityScore += Math.min(labelCount * 5, 10);
  qualityScore += hasOwner ? 10 : 0;
  qualityScore += dependencyCount > 0 ? 9 : 0;
  qualityScore = Math.min(qualityScore, 100);

  let confidence = 40;
  confidence += Math.min(acceptanceCount * 10, 30);
  confidence += hasOwner ? 10 : 0;
  confidence += dependencyCount > 0 ? 10 : 0;
  confidence += labelCount > 0 ? 5 : 0;
  confidence = Math.min(confidence, 100);

  let status: DerivedStoryMeta["status"] = "Needs Work";
  if (acceptanceCount >= 3 && hasOwner) {
    status = "Ready";
  } else if (acceptanceCount >= 1) {
    status = "Review";
  }

  return { status, confidence, qualityScore };
}

function deriveEpicSummary(stories: Story[]) {
  if (stories.length === 0) {
    return { ready: 0, review: 0, needsWork: 0, avgConfidence: 0 };
  }

  const metas = stories.map(deriveStoryMeta);

  const ready = metas.filter((meta) => meta.status === "Ready").length;
  const review = metas.filter((meta) => meta.status === "Review").length;
  const needsWork = metas.filter((meta) => meta.status === "Needs Work").length;
  const avgConfidence = Math.round(
    metas.reduce((sum, meta) => sum + meta.confidence, 0) / metas.length
  );

  return { ready, review, needsWork, avgConfidence };
}

export default function DependencyGraph({ stories }: Props) {
  const groups = useMemo(() => buildGroups(stories), [stories]);

  const [collapsedEpics, setCollapsedEpics] = useState<Record<string, boolean>>(
    {}
  );
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(
    stories.find((story) => story.kind === "Story")?.id ?? null
  );
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [estimateFilter, setEstimateFilter] = useState("all");

  const allStories = stories.filter((story) => story.kind === "Story");

  const ownerOptions = useMemo(() => {
    return Array.from(
      new Set(
        allStories
          .map((story) => story.owner)
          .filter((owner) => owner && owner.trim())
      )
    ).sort();
  }, [allStories]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();

    return groups
      .map((group) => {
        const epicMatches =
          !query ||
          group.epic.title.toLowerCase().includes(query) ||
          group.epic.id.toLowerCase().includes(query);

        const filteredStories = group.stories.filter((story) => {
          const matchesQuery =
            !query ||
            story.title.toLowerCase().includes(query) ||
            story.id.toLowerCase().includes(query) ||
            story.owner.toLowerCase().includes(query) ||
            story.labels.join(" ").toLowerCase().includes(query);

          const matchesOwner =
            ownerFilter === "all" || story.owner === ownerFilter;

          const matchesEstimate =
            estimateFilter === "all" ||
            (story.estimate || "").toUpperCase() === estimateFilter;

          return matchesQuery && matchesOwner && matchesEstimate;
        });

        return {
          ...group,
          stories:
            epicMatches && filteredStories.length === 0 && !query
              ? group.stories.filter((story) => {
                  const matchesOwner =
                    ownerFilter === "all" || story.owner === ownerFilter;
                  const matchesEstimate =
                    estimateFilter === "all" ||
                    (story.estimate || "").toUpperCase() === estimateFilter;
                  return matchesOwner && matchesEstimate;
                })
              : filteredStories,
        };
      })
      .filter((group) => {
        if (!query && ownerFilter === "all" && estimateFilter === "all") {
          return true;
        }

        const epicMatches =
          !query ||
          group.epic.title.toLowerCase().includes(query) ||
          group.epic.id.toLowerCase().includes(query);

        return epicMatches || group.stories.length > 0;
      });
  }, [groups, search, ownerFilter, estimateFilter]);

  const selectedStory =
    allStories.find((story) => story.id === selectedStoryId) ?? null;
  const selectedStoryMeta = selectedStory ? deriveStoryMeta(selectedStory) : null;

  if (stories.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        No dependency structure available yet.
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        No epic/story hierarchy found yet.
      </div>
    );
  }

  const toggleEpic = (epicId: string) => {
    setCollapsedEpics((prev) => ({
      ...prev,
      [epicId]: !prev[epicId],
    }));
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                Delivery Architecture Board
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Compact view of epics, linked stories, and ownership.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                <Layers3 className="mr-2 h-3.5 w-3.5" />
                {groups.length} epic{groups.length === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                <GitBranch className="mr-2 h-3.5 w-3.5" />
                {allStories.length} stor{allStories.length === 1 ? "y" : "ies"}
              </span>
            </div>
          </div>

          {/* compact filters */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_0.8fr_0.7fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="rounded-2xl pl-10"
              />
            </div>

            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All owners</option>
              {ownerOptions.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>

            <select
              value={estimateFilter}
              onChange={(e) => setEstimateFilter(e.target.value)}
              className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All estimates</option>
              <option value="XL">XL</option>
              <option value="L">L</option>
              <option value="M">M</option>
              <option value="S">S</option>
            </select>
          </div>
        </div>
      </div>

      {/* Compact board */}
      <div className="divide-y divide-slate-200">
        {filteredGroups.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-500">
            No epics or stories matched the current filters.
          </div>
        ) : (
          filteredGroups.map((group) => {
            const epic = group.epic;
            const childStories = group.stories;
            const collapsed = !!collapsedEpics[epic.id];
            const summary = deriveEpicSummary(childStories);

            return (
              <div key={epic.id} className="px-5 py-5">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[250px_1fr_180px]">
                  {/* epic */}
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleEpic(epic.id)}
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                          Epic
                        </span>
                        <span className="text-slate-500">
                          {collapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      </div>

                      <h4 className="mt-3 text-base font-semibold leading-5 text-slate-900">
                        {truncate(epic.title, 34)}
                      </h4>

                      <div className="mt-3 space-y-1 text-xs text-slate-600">
                        <p>{epic.id}</p>
                        <p>Owner: {epic.owner || "—"}</p>
                        <p>Estimate: {epic.estimate || "—"}</p>
                        <p>{childStories.length} stories</p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          {summary.ready} ready
                        </span>
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          {summary.review} review
                        </span>
                        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                          {summary.avgConfidence}%
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* compact story tiles */}
                  <div>
                    {collapsed ? (
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                        This epic is collapsed.
                      </div>
                    ) : childStories.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                        No linked stories matched the current filters.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {childStories.map((story) => {
                          const selected = story.id === selectedStoryId;
                          const meta = deriveStoryMeta(story);

                          return (
                            <button
                              key={story.id}
                              type="button"
                              onClick={() => setSelectedStoryId(story.id)}
                              className={`rounded-3xl border p-4 text-left shadow-sm transition ${
                                selected
                                  ? "border-slate-900 bg-slate-50"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${estimateTone(
                                    story.estimate
                                  )}`}
                                >
                                  {story.estimate || "—"}
                                </span>

                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusTone(
                                    meta.status
                                  )}`}
                                >
                                  {meta.status}
                                </span>
                              </div>

                              <h5 className="mt-3 text-sm font-semibold leading-5 text-slate-900">
                                {truncate(story.title, 42)}
                              </h5>

                              <div className="mt-3 space-y-1 text-xs text-slate-600">
                                <p>Owner: {story.owner || "—"}</p>
                                <p>Acceptance: {story.acceptance.length}</p>
                                <p>Confidence: {meta.confidence}%</p>
                              </div>

                              {story.labels.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {story.labels.slice(0, 2).map((label) => (
                                    <span
                                      key={`${story.id}-${label}`}
                                      className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                    >
                                      {label}
                                    </span>
                                  ))}
                                  {story.labels.length > 2 ? (
                                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                      +{story.labels.length - 2}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* small summary lane */}
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Summary
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <p>
                        <span className="font-medium text-slate-900">Ready:</span>{" "}
                        {summary.ready}
                      </p>
                      <p>
                        <span className="font-medium text-slate-900">Review:</span>{" "}
                        {summary.review}
                      </p>
                      <p>
                        <span className="font-medium text-slate-900">Needs Work:</span>{" "}
                        {summary.needsWork}
                      </p>
                      <p>
                        <span className="font-medium text-slate-900">Avg confidence:</span>{" "}
                        {summary.avgConfidence}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Compact inspector below board */}
      <div className="border-t border-slate-200 bg-slate-50 px-5 py-5">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Story Inspector
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Selected story details appear here without taking over the main screen.
          </p>
        </div>

        {selectedStory && selectedStoryMeta ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${estimateTone(
                    selectedStory.estimate
                  )}`}
                >
                  {selectedStory.estimate || "—"}
                </span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusTone(
                    selectedStoryMeta.status
                  )}`}
                >
                  {selectedStoryMeta.status}
                </span>
              </div>

              <h4 className="mt-3 text-base font-semibold leading-6 text-slate-900">
                {selectedStory.title}
              </h4>

              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <p>Owner: {selectedStory.owner || "Unassigned"}</p>
                <p>
                  Depends on:{" "}
                  {selectedStory.dependsOn.length > 0
                    ? selectedStory.dependsOn.join(", ")
                    : "None"}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-900">
                  Acceptance
                </p>
              </div>
              {selectedStory.acceptance.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {selectedStory.acceptance.slice(0, 4).map((item, index) => (
                    <li key={`${selectedStory.id}-acc-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No acceptance criteria.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-900">
                  Labels
                </p>
              </div>
              {selectedStory.labels.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedStory.labels.map((label) => (
                    <span
                      key={`${selectedStory.id}-${label}`}
                      className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No labels.</p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">
                Health Summary
              </p>

              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Confidence</span>
                    <span>{selectedStoryMeta.confidence}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-sky-500"
                      style={{ width: `${selectedStoryMeta.confidence}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Quality</span>
                    <span>{selectedStoryMeta.qualityScore}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${selectedStoryMeta.qualityScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
            Select a story card to inspect it.
          </div>
        )}
      </div>
    </div>
  );
}
