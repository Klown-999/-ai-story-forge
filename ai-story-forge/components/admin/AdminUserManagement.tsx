
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AppRole = "admin" | "editor" | "viewer";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: AppRole;
  provider: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

type UsersResponse = {
  ok: true;
  users: AdminUser[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function roleBadgeVariant(role: AppRole): "default" | "secondary" | "outline" {
  if (role === "admin") return "default";
  if (role === "editor") return "secondary";
  return "outline";
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [draftRoles, setDraftRoles] = useState<Record<string, AppRole>>({});
  const [savingUserId, setSavingUserId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");
      setStatusMessage("");

      const response = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to load users (${response.status})`);
      }

      const data = (await response.json()) as UsersResponse;

      setUsers(data.users);

      const initialDrafts: Record<string, AppRole> = {};
      for (const user of data.users) {
        initialDrafts[user.id] = user.role;
      }
      setDraftRoles(initialDrafts);
    } catch (err) {
      console.error("Failed to load users:", err);
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) => {
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query) ||
        (user.provider || "").toLowerCase().includes(query)
      );
    });
  }, [search, users]);

  async function saveRole(userId: string) {
    try {
      const nextRole = draftRoles[userId];
      if (!nextRole) return;

      setSavingUserId(userId);
      setStatusMessage("");

      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: nextRole }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to update role (${response.status})`);
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                role: nextRole,
                updatedAt: new Date().toISOString(),
              }
            : user
        )
      );

      setStatusMessage("Role updated successfully.");
    } catch (err) {
      console.error("Failed to update role:", err);
      setStatusMessage(
        err instanceof Error ? err.message : "Failed to update role"
      );
    } finally {
      setSavingUserId("");
    }
  }

  return (
    <Card className="rounded-3xl border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">User Directory</CardTitle>
        <CardDescription>
          Search users, inspect current roles, and update access levels.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, role, or provider..."
            className="rounded-2xl md:max-w-md"
          />

          <Button
            className="rounded-2xl"
            onClick={loadUsers}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {statusMessage ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {statusMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border p-4 text-sm text-slate-500">
            Loading users...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-2xl border p-4 text-sm text-slate-500">
            No users found.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => {
              const draftRole = draftRoles[user.id] ?? user.role;
              const dirty = draftRole !== user.role;
              const isSaving = savingUserId === user.id;

              return (
                <div
                  key={user.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">
                          {user.name}
                        </p>

                        <Badge
                          variant={roleBadgeVariant(user.role)}
                          className="rounded-full"
                        >
                          Current: {user.role}
                        </Badge>

                        {dirty ? (
                          <Badge variant="outline" className="rounded-full">
                            Pending: {draftRole}
                          </Badge>
                        ) : null}
                      </div>

                      <p className="text-sm text-slate-600">{user.email}</p>

                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full border px-3 py-1">
                          Provider: {user.provider || "unknown"}
                        </span>
                        <span className="rounded-full border px-3 py-1">
                          Created: {formatDate(user.createdAt)}
                        </span>
                        <span className="rounded-full border px-3 py-1">
                          Last login: {formatDate(user.lastLoginAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <select
                        value={draftRole}
                        onChange={(e) =>
                          setDraftRoles((prev) => ({
                            ...prev,
                            [user.id]: e.target.value as AppRole,
                          }))
                        }
                        className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="admin">admin</option>
                        <option value="editor">editor</option>
                        <option value="viewer">viewer</option>
                      </select>

                      <Button
                        className="rounded-2xl"
                        disabled={!dirty || isSaving}
                        onClick={() => saveRole(user.id)}
                      >
                        {isSaving ? "Saving..." : "Save role"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
