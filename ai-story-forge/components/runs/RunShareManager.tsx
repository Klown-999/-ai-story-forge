
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ShareUser = {
  id: string;
  email: string;
  name: string;
  role: "viewer";
};

type SharesResponse = {
  ok: true;
  runId: string;
  sharedViewers: ShareUser[];
  viewerCandidates: ShareUser[];
};

type Props = {
  runId: string;
  enabled: boolean;
};

export default function RunShareManager({ runId, enabled }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedViewerId, setSelectedViewerId] = useState("");
  const [sharedViewers, setSharedViewers] = useState<ShareUser[]>([]);
  const [viewerCandidates, setViewerCandidates] = useState<ShareUser[]>([]);
  const [message, setMessage] = useState("");

  async function loadShares() {
    if (!enabled || !runId) return;

    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`/api/runs/${runId}/shares`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to load shares (${response.status})`);
      }

      const data = (await response.json()) as SharesResponse;
      setSharedViewers(data.sharedViewers);
      setViewerCandidates(data.viewerCandidates);
    } catch (error) {
      console.error("Failed to load run shares:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to load run shares"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShares();
  }, [runId, enabled]);

  const availableCandidates = useMemo(() => {
    const sharedIds = new Set(sharedViewers.map((user) => user.id));
    return viewerCandidates.filter((user) => !sharedIds.has(user.id));
  }, [viewerCandidates, sharedViewers]);

  async function handleShare() {
    if (!selectedViewerId) return;

    try {
      setSaving(true);
      setMessage("");

      const response = await fetch(`/api/runs/${runId}/shares`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ viewerUserId: selectedViewerId }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to share run (${response.status})`);
      }

      setSelectedViewerId("");
      setMessage("Viewer access granted.");
      await loadShares();
    } catch (error) {
      console.error("Failed to share run:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to share run"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(viewerUserId: string) {
    try {
      setSaving(true);
      setMessage("");

      const response = await fetch(
        `/api/runs/${runId}/shares/${viewerUserId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to revoke share (${response.status})`);
      }

      setMessage("Viewer access revoked.");
      await loadShares();
    } catch (error) {
      console.error("Failed to revoke share:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to revoke share"
      );
    } finally {
      setSaving(false);
    }
  }

  if (!enabled || !runId) return null;

  return (
    <Card className="rounded-3xl border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Run Sharing</CardTitle>
        <CardDescription>
          Share this run with viewer users for read-only access.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {message ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border p-4 text-sm text-slate-500">
            Loading sharing settings...
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <select
                value={selectedViewerId}
                onChange={(e) => setSelectedViewerId(e.target.value)}
                className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select a viewer to share with</option>
                {availableCandidates.map((viewer) => (
                  <option key={viewer.id} value={viewer.id}>
                    {viewer.name} ({viewer.email})
                  </option>
                ))}
              </select>

              <Button
                className="rounded-2xl"
                disabled={!selectedViewerId || saving}
                onClick={handleShare}
              >
                {saving ? "Saving..." : "Grant access"}
              </Button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">
                Shared with
              </p>

              {sharedViewers.length === 0 ? (
                <div className="rounded-2xl border p-4 text-sm text-slate-500">
                  This run is not shared with any viewer yet.
                </div>
              ) : (
                sharedViewers.map((viewer) => (
                  <div
                    key={viewer.id}
                    className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{viewer.name}</p>
                      <p className="text-sm text-slate-600">{viewer.email}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full">
                        viewer
                      </Badge>

                      <Button
                        className="rounded-2xl"
                        disabled={saving}
                        onClick={() => handleRevoke(viewer.id)}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
