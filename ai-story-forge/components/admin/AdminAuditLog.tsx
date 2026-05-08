
"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuditEvent = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminAuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAudit() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/audit", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to load audit log (${response.status})`);
      }

      const data = (await response.json()) as {
        ok: true;
        events: AuditEvent[];
      };

      setEvents(data.events);
    } catch (err) {
      console.error("Failed to load audit log:", err);
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAudit();
  }, []);

  return (
    <Card className="rounded-3xl border-slate-200 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg">Security Audit Log</CardTitle>
            <CardDescription>
              Track sign-ins, uploads, role changes, and sharing actions.
            </CardDescription>
          </div>

          <Button
            className="rounded-2xl"
            onClick={loadAudit}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh audit"}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="rounded-2xl border p-4 text-sm text-slate-500">
            Loading audit log...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border p-4 text-sm text-slate-500">
            No audit events found.
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="rounded-2xl border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{event.message}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {event.userEmail || "Unknown user"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(event.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full">
                      {event.action}
                    </Badge>

                    {event.entityType ? (
                      <Badge variant="secondary" className="rounded-full">
                        {event.entityType}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
