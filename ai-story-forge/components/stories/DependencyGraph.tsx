
"use client";

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  MarkerType,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Expand, Minimize2, Search, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Story } from "@/types";

type DependencyGraphProps = {
  stories: Story[];
};

type FlowNodeData = {
  label: string;
  story: Story;
  selected: boolean;
  related: boolean;
};

type StoryFlowNode = Node<FlowNodeData, "storyNode">;

const StoryFlowNodeComponent = memo((props: NodeProps) => {
  const typedProps = props as NodeProps<StoryFlowNode>;
  const story = typedProps.data.story;

  const borderColor =
    story.kind === "Epic"
      ? typedProps.data.selected
        ? "#0f172a"
        : typedProps.data.related
        ? "#334155"
        : "#1e293b"
      : typedProps.data.selected
      ? "#2563eb"
      : typedProps.data.related
      ? "#60a5fa"
      : "#cbd5e1";

  const background =
    story.kind === "Epic"
      ? "#f8fafc"
      : typedProps.data.selected
      ? "#eff6ff"
      : "#ffffff";

  return (
    <div
      style={{
        width: 300,
        borderRadius: 18,
        border: `2px solid ${borderColor}`,
        background,
        color: "#0f172a",
        padding: 14,
        boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
        opacity: typedProps.data.selected || !typedProps.data.related ? 1 : 0.88,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#94a3b8", width: 8, height: 8 }}
      />

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "#94a3b8", width: 8, height: 8 }}
      />
      
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            lineHeight: 1,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #cbd5e1",
            background: story.kind === "Epic" ? "#e2e8f0" : "#ffffff",
            color: "#0f172a",
            fontWeight: 600,
          }}
        >
          {story.kind}
        </span>

        <span
          style={{
            fontSize: 11,
            lineHeight: 1,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            fontWeight: 600,
          }}
        >
          {story.estimate}
          {typeof story.storyPoints === "number"
            ? ` • ${story.storyPoints} pts`
            : ""}
        </span>
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#0f172a",
          lineHeight: 1.35,
          whiteSpace: "normal",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}
      >
        {story.title}
      </div>

      {story.storyFormat ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            lineHeight: 1.45,
            color: "#334155",
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          {story.storyFormat}
        </div>
      ) : null}
    </div>
  );
});

const nodeTypes: NodeTypes = {
  storyNode: StoryFlowNodeComponent,
};

function buildGraphLayout(stories: Story[]) {
  const storyMap = new Map<string, Story>();
  stories.forEach((story) => storyMap.set(story.id, story));

  const epicStories = stories.filter((story) => story.kind === "Epic");
  const normalStories = stories.filter((story) => story.kind === "Story");

  const dependents = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  normalStories.forEach((story) => {
    indegree.set(story.id, 0);
    dependents.set(story.id, []);
  });

  const edges: Edge[] = [];

  normalStories.forEach((story) => {
    (story.dependsOn || []).forEach((dep) => {
      if (storyMap.has(dep)) {
        if (storyMap.get(dep)?.kind === "Story") {
          dependents.get(dep)?.push(story.id);
          indegree.set(story.id, (indegree.get(story.id) || 0) + 1);
        }

        edges.push({
          id: `${dep}->${story.id}`,
          source: dep,
          target: story.id,
          type: "smoothstep",
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        });
      }
    });
  });

  const queue: string[] = [];
  const level = new Map<string, number>();

  indegree.forEach((value, key) => {
    if (value === 0) {
      queue.push(key);
      level.set(key, 0);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = level.get(current) || 0;

    for (const next of dependents.get(current) || []) {
      const nextLevel = Math.max(level.get(next) ?? 0, currentLevel + 1);
      level.set(next, nextLevel);

      indegree.set(next, (indegree.get(next) || 0) - 1);
      if ((indegree.get(next) || 0) === 0) {
        queue.push(next);
      }
    }
  }

  normalStories.forEach((story) => {
    if (!level.has(story.id)) level.set(story.id, 0);
  });

  const nodes: StoryFlowNode[] = [];

  epicStories
    .sort((a, b) => a.title.localeCompare(b.title))
    .forEach((story, index) => {
      nodes.push({
        id: story.id,
        type: "storyNode",
        position: { x: 0, y: index * 200 },
        draggable: false,
        selectable: true,
        data: {
          label: story.title,
          story,
          selected: false,
          related: false,
        },
      });
    });

  const levels = new Map<number, Story[]>();
  normalStories.forEach((story) => {
    const l = level.get(story.id) || 0;
    if (!levels.has(l)) levels.set(l, []);
    levels.get(l)!.push(story);
  });

  Array.from(levels.keys())
    .sort((a, b) => a - b)
    .forEach((lvl) => {
      const columnStories = levels.get(lvl)!;
      columnStories.sort((a, b) => a.title.localeCompare(b.title));

      columnStories.forEach((story, index) => {
        nodes.push({
          id: story.id,
          type: "storyNode",
          position: {
            x: 380 + lvl * 360,
            y: index * 200,
          },
          draggable: false,
          selectable: true,
          data: {
            label: story.title,
            story,
            selected: false,
            related: false,
          },
        });
      });
    });

  return { nodes, edges };
}

function DependencyGraphInner({ stories }: DependencyGraphProps) {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showEpics, setShowEpics] = useState(true);
  const [showStories, setShowStories] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const reactFlowInstanceRef =
    useRef<ReactFlowInstance<StoryFlowNode, Edge> | null>(null);

  const filteredStories = useMemo(() => {
    return stories.filter((story) => {
      if (!showEpics && story.kind === "Epic") return false;
      if (!showStories && story.kind === "Story") return false;

      if (!search.trim()) return true;

      const q = search.trim().toLowerCase();
      return (
        story.title.toLowerCase().includes(q) ||
        story.id.toLowerCase().includes(q) ||
        (story.storyFormat || "").toLowerCase().includes(q)
      );
    });
  }, [stories, search, showEpics, showStories]);

  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => buildGraphLayout(filteredStories),
    [filteredStories]
  );

  const directDependents = useMemo(() => {
    const map = new Map<string, string[]>();
    filteredStories.forEach((story) => {
      map.set(story.id, []);
    });

    filteredStories.forEach((story) => {
      (story.dependsOn || []).forEach((dep) => {
        if (map.has(dep)) {
          map.get(dep)!.push(story.id);
        }
      });
    });

    return map;
  }, [filteredStories]);

  const selectedStory =
    filteredStories.find((story) => story.id === selectedStoryId) || null;

  const relatedNodeIds = useMemo(() => {
    if (!selectedStory) return new Set<string>();

    const set = new Set<string>();
    set.add(selectedStory.id);

    (selectedStory.dependsOn || []).forEach((dep) => set.add(dep));
    (directDependents.get(selectedStory.id) || []).forEach((dep) => set.add(dep));

    return set;
  }, [selectedStory, directDependents]);

  const nodes = useMemo<StoryFlowNode[]>(() => {
    return baseNodes.map((node) => {
      const isSelected = selectedStoryId === node.id;
      const isRelated = selectedStoryId ? relatedNodeIds.has(node.id) : true;

      return {
        ...node,
        data: {
          ...node.data,
          selected: isSelected,
          related: isRelated,
        },
      };
    });
  }, [baseNodes, selectedStoryId, relatedNodeIds]);

  const edges = useMemo<Edge[]>(() => {
    return baseEdges.map((edge) => {
      const isSelectedPath =
        selectedStory &&
        (edge.source === selectedStory.id ||
          edge.target === selectedStory.id ||
          (selectedStory.dependsOn || []).includes(edge.source) ||
          (directDependents.get(selectedStory.id) || []).includes(edge.target));

      return {
        ...edge,
        animated: !!isSelectedPath,
        style: {
          stroke: isSelectedPath ? "#2563eb" : "#94a3b8",
          strokeWidth: isSelectedPath ? 2.8 : 1.4,
          opacity: selectedStoryId && !isSelectedPath ? 0.3 : 1,
        },
      };
    });
  }, [baseEdges, selectedStory, selectedStoryId, directDependents]);

  
  const handleFullscreenToggle = useCallback(async () => {
    if (!fullscreenRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await fullscreenRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Failed to toggle fullscreen:", error);
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);

      setTimeout(() => {
        reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 400 });
      }, 120);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  if (!stories.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        No stories available yet. Generate a run to visualize dependencies.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-full border border-slate-900 bg-slate-50 text-slate-900">
              Interactive graph
            </Badge>
            <Badge className="rounded-full border border-slate-300 bg-white text-slate-700">
              Nodes: {filteredStories.length}
            </Badge>
            <Badge className="rounded-full border border-slate-300 bg-white text-slate-700">
              Edges: {edges.length}
            </Badge>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title / ID / story format"
                className="w-[240px] bg-transparent outline-none"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowEpics((prev) => !prev)}
                className={`rounded-2xl border px-3 py-2 text-sm ${
                  showEpics
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {showEpics ? "Hide epics" : "Show epics"}
              </button>

              <button
                type="button"
                onClick={() => setShowStories((prev) => !prev)}
                className={`rounded-2xl border px-3 py-2 text-sm ${
                  showStories
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {showStories ? "Hide stories" : "Show stories"}
              </button>

              <button
                type="button"
                onClick={handleFullscreenToggle}
                className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {isFullscreen ? (
                  <span className="flex items-center gap-2">
                    <Minimize2 className="h-4 w-4" />
                    Exit fullscreen
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Expand className="h-4 w-4" />
                    Fullscreen
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-900 bg-slate-50" />
            Epic
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full border border-slate-400 bg-white" />
            Story
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 bg-blue-600" />
            Selected dependency path
          </div>
        </div>
      </div>

      <div
        className={`grid gap-4 ${
          isFullscreen ? "grid-cols-[1fr_420px]" : "xl:grid-cols-[1fr_360px]"
        }`}
      >
        <div
          ref={fullscreenRef}
          className={`overflow-hidden rounded-3xl border border-slate-200 bg-white ${
            isFullscreen ? "h-screen" : "h-[720px]"
          }`}
        >
          <ReactFlow<StoryFlowNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            onInit={(instance) => {
              reactFlowInstanceRef.current = instance;
            }}
            onNodeClick={(_, node) => {
              setSelectedStoryId(node.id);
            }}
            defaultEdgeOptions={{
              type: "smoothstep",
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
          >
            <Panel position="top-left">
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur">
                Click a node to inspect its details and dependency path
              </div>
            </Panel>

            <MiniMap
              pannable
              zoomable
              nodeStrokeWidth={3}
              nodeColor={(node) => {
                const typedNode = node as StoryFlowNode;
                return typedNode.data?.story?.kind === "Epic"
                  ? "#e2e8f0"
                  : "#ffffff";
              }}
            />
            <Controls />
            <Background gap={20} size={1} />
          </ReactFlow>
        </div>

        <Card
          className={`rounded-3xl border-slate-200 shadow-sm ${
            isFullscreen ? "h-screen overflow-auto" : ""
          }`}
        >
          <CardHeader>
            <CardTitle className="text-lg">Story details panel</CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            {selectedStory ? (
              <>
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="rounded-full">{selectedStory.kind}</Badge>
                    <Badge variant="outline" className="rounded-full">
                      Estimate: {selectedStory.estimate}
                    </Badge>
                    {typeof selectedStory.storyPoints === "number" ? (
                      <Badge variant="outline" className="rounded-full">
                        Story points: {selectedStory.storyPoints}
                      </Badge>
                    ) : null}
                  </div>

                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    {selectedStory.title}
                  </h3>

                  <p className="mt-2 text-sm text-slate-600">
                    Owner: {selectedStory.owner}
                  </p>
                </div>

                {selectedStory.storyFormat ? (
                  <div>
                    <p className="mb-2 font-semibold text-slate-900">
                      Story format
                    </p>
                    <div className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-700">
                      {selectedStory.storyFormat}
                    </div>
                  </div>
                ) : null}

                {selectedStory.labels?.length ? (
                  <div>
                    <p className="mb-2 font-semibold text-slate-900">Labels</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedStory.labels.map((label: string) => (
                        <Badge
                          key={`${selectedStory.id}-label-${label}`}
                          variant="outline"
                          className="rounded-full"
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedStory.dependsOn?.length ? (
                  <div>
                    <p className="mb-2 font-semibold text-slate-900">
                      Prerequisites
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedStory.dependsOn.map((dep: string) => (
                        <Badge
                          key={`${selectedStory.id}-dep-${dep}`}
                          variant="outline"
                          className="rounded-full"
                        >
                          {dep}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {(directDependents.get(selectedStory.id) || []).length > 0 ? (
                  <div>
                    <p className="mb-2 font-semibold text-slate-900">
                      Direct dependents
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(directDependents.get(selectedStory.id) || []).map(
                        (dep: string) => (
                          <Badge
                            key={`${selectedStory.id}-dependent-${dep}`}
                            variant="outline"
                            className="rounded-full"
                          >
                            {dep}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                ) : null}

                {selectedStory.acceptance?.length ? (
                  <div>
                    <p className="mb-2 font-semibold text-slate-900">
                      Acceptance criteria
                    </p>
                    <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                      {selectedStory.acceptance.map(
                        (item: string, index: number) => (
                          <li key={`${selectedStory.id}-acceptance-${index}`}>
                            {item}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                ) : null}

                {selectedStory.edgeCases?.length ? (
                  <div>
                    <p className="mb-2 font-semibold text-slate-900">
                      Edge cases
                    </p>
                    <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                      {selectedStory.edgeCases.map(
                        (item: string, index: number) => (
                          <li key={`${selectedStory.id}-edge-${index}`}>
                            {item}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="space-y-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">
                  Story details panel
                </p>
                <p>Click a node to inspect story details.</p>
                <p>
                  Use fullscreen mode for a larger architecture-style view.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DependencyGraph(props: DependencyGraphProps) {
  return (
    <ReactFlowProvider>
      <DependencyGraphInner {...props} />
    </ReactFlowProvider>
  );
}
``
