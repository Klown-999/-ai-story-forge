
import { randomUUID } from "crypto";
import db from "@/lib/sqlite";

export type AppRole = "admin" | "editor" | "viewer";

export type AppUserRow = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: AppRole;
  provider: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    image TEXT,
    role TEXT NOT NULL,
    provider TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    prd TEXT NOT NULL,
    major_decision TEXT NOT NULL DEFAULT 'Pending',
    story_count INTEGER NOT NULL DEFAULT 0,
    jira_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ready',
    source_type TEXT,
    source_file_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_saved_at TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS stories (
    story_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    estimate TEXT NOT NULL,
    owner TEXT NOT NULL,
    depends_on_json TEXT NOT NULL,
    labels_json TEXT NOT NULL,
    acceptance_json TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS run_activity (
    activity_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS run_viewer_access (
    grant_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    viewer_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(run_id, viewer_user_id)
  );
`);

export function getAppUserByEmail(email: string) {
  const stmt = db.prepare(`
    SELECT *
    FROM users
    WHERE lower(email) = lower(?)
    LIMIT 1
  `);

  return stmt.get(email) as AppUserRow | undefined;
}

export function getAppUserById(userId: string) {
  const stmt = db.prepare(`
    SELECT *
    FROM users
    WHERE id = ?
    LIMIT 1
  `);

  return stmt.get(userId) as AppUserRow | undefined;
}

export function upsertAppUserFromOAuth(params: {
  email: string;
  name: string;
  image: string | null;
  provider: string;
  role: AppRole;
}) {
  const existing = getAppUserByEmail(params.email);

  if (existing) {
    const stmt = db.prepare(`
      UPDATE users
      SET name = ?,
          image = ?,
          provider = ?,
          role = ?,
          updated_at = datetime('now'),
          last_login_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      params.name,
      params.image,
      params.provider,
      params.role,
      existing.id
    );

    return getAppUserById(existing.id)!;
  }

  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO users (
      id, email, name, image, role, provider, last_login_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  stmt.run(
    id,
    params.email.toLowerCase(),
    params.name,
    params.image,
    params.role,
    params.provider
  );

  return getAppUserById(id)!;
}

export function listAllUsers() {
  const stmt = db.prepare(`
    SELECT *
    FROM users
    ORDER BY created_at DESC
  `);

  return stmt.all() as AppUserRow[];
}

export function updateUserRole(userId: string, role: AppRole) {
  const stmt = db.prepare(`
    UPDATE users
    SET role = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(role, userId);
}

export type StoryRow = {
  id: string;
  kind: "Epic" | "Story";
  title: string;
  estimate: string;
  owner: string;
  dependsOn: string[];
  labels: string[];
  acceptance: string[];
};

export function createRun(params: {
  ownerUserId: string;
  title: string;
  date: string;
  prd: string;
  majorDecision?: string;
  sourceType?: string | null;
  sourceFileName?: string | null;
}) {
  const runId = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO runs (
      run_id,
      owner_user_id,
      title,
      date,
      prd,
      major_decision,
      source_type,
      source_file_name,
      story_count,
      jira_count,
      status,
      last_saved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'ready', datetime('now'))
  `);

  stmt.run(
    runId,
    params.ownerUserId,
    params.title,
    params.date,
    params.prd,
    params.majorDecision ?? "Pending",
    params.sourceType ?? null,
    params.sourceFileName ?? null
  );

  return runId;
}

export function replaceStoriesForRun(runId: string, stories: StoryRow[]) {
  const deleteStmt = db.prepare(`DELETE FROM stories WHERE run_id = ?`);
  deleteStmt.run(runId);

  const insertStmt = db.prepare(`
    INSERT INTO stories (
      story_id,
      run_id,
      kind,
      title,
      estimate,
      owner,
      depends_on_json,
      labels_json,
      acceptance_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const story of stories) {
    insertStmt.run(
      story.id,
      runId,
      story.kind,
      story.title,
      story.estimate,
      story.owner,
      JSON.stringify(story.dependsOn),
      JSON.stringify(story.labels),
      JSON.stringify(story.acceptance)
    );
  }

  const updateRunStmt = db.prepare(`
    UPDATE runs
    SET story_count = ?,
        updated_at = datetime('now'),
        last_saved_at = datetime('now')
    WHERE run_id = ?
  `);

  updateRunStmt.run(stories.length, runId);
}

export function addRunActivity(params: {
  runId: string;
  type: "run_created" | "source_prd" | "export" | "jira_payload";
  title: string;
  description: string;
  timestamp?: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO run_activity (
      activity_id, run_id, type, title, description, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    randomUUID(),
    params.runId,
    params.type,
    params.title,
    params.description,
    params.timestamp ?? new Date().toISOString()
  );
}

export function listRunsForUser(userId: string) {
  const stmt = db.prepare(`
    SELECT
      run_id,
      title,
      date,
      story_count,
      jira_count,
      prd,
      major_decision,
      source_type,
      source_file_name,
      last_saved_at
    FROM runs
    WHERE owner_user_id = ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(userId) as Array<{
    run_id: string;
    title: string;
    date: string;
    story_count: number;
    jira_count: number;
    prd: string;
    major_decision: string;
    source_type: string | null;
    source_file_name: string | null;
    last_saved_at: string | null;
  }>;

  return rows.map((row) => ({
    id: row.run_id,
    title: row.title,
    date: row.date,
    stories: row.story_count,
    jira: row.jira_count,
    prd: row.prd,
    generatedStories: [] as StoryRow[],
    majorDecision: row.major_decision,
    exportedFormats: [] as string[],
    sourceType: row.source_type,
    sourceFileName: row.source_file_name,
    lastSavedAt: row.last_saved_at,
  }));
}

export function getRunById(runId: string) {
  const stmt = db.prepare(`
    SELECT *
    FROM runs
    WHERE run_id = ?
    LIMIT 1
  `);

  return stmt.get(runId) as
    | {
        run_id: string;
        owner_user_id: string;
        title: string;
        date: string;
        prd: string;
        major_decision: string;
        story_count: number;
        jira_count: number;
        status: string;
        source_type: string | null;
        source_file_name: string | null;
        created_at: string;
        updated_at: string;
        last_saved_at: string | null;
      }
    | undefined;
}

export function getStoriesForRun(runId: string): StoryRow[] {
  const stmt = db.prepare(`
    SELECT *
    FROM stories
    WHERE run_id = ?
    ORDER BY rowid ASC
  `);

  const rows = stmt.all(runId) as Array<{
    story_id: string;
    kind: "Epic" | "Story";
    title: string;
    estimate: string;
    owner: string;
    depends_on_json: string;
    labels_json: string;
    acceptance_json: string;
  }>;

  return rows.map((row) => ({
    id: row.story_id,
    kind: row.kind,
    title: row.title,
    estimate: row.estimate,
    owner: row.owner,
    dependsOn: JSON.parse(row.depends_on_json),
    labels: JSON.parse(row.labels_json),
    acceptance: JSON.parse(row.acceptance_json),
  }));
}

export function getActivityForRun(runId: string) {
  const stmt = db.prepare(`
    SELECT *
    FROM run_activity
    WHERE run_id = ?
    ORDER BY timestamp DESC
  `);

  return stmt.all(runId) as Array<{
    activity_id: string;
    type: "run_created" | "source_prd" | "export" | "jira_payload";
    title: string;
    description: string;
    timestamp: string;
  }>;
}

export function userOwnsRun(userId: string, runId: string) {
  const stmt = db.prepare(`
    SELECT 1
    FROM runs
    WHERE run_id = ?
      AND owner_user_id = ?
    LIMIT 1
  `);

  const row = stmt.get(runId, userId);
  return !!row;
}

export function userCanAccessRun(userId: string, runId: string) {
  if (userOwnsRun(userId, runId)) {
    return true;
  }

  const sharedStmt = db.prepare(`
    SELECT 1
    FROM run_viewer_access
    WHERE viewer_user_id = ?
      AND run_id = ?
    LIMIT 1
  `);

  const shared = sharedStmt.get(userId, runId);
  return !!shared;
}

export type ViewerShareUser = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
};

export function listViewerCandidatesForRun(ownerUserId: string) {
  const stmt = db.prepare(`
    SELECT id, email, name, role
    FROM users
    WHERE role = 'viewer'
      AND id != ?
    ORDER BY name COLLATE NOCASE ASC, email COLLATE NOCASE ASC
  `);

  return stmt.all(ownerUserId) as ViewerShareUser[];
}

export function listRunSharesForOwner(ownerUserId: string, runId: string) {
  const stmt = db.prepare(`
    SELECT u.id, u.email, u.name, u.role
    FROM run_viewer_access rva
    INNER JOIN users u ON u.id = rva.viewer_user_id
    WHERE rva.owner_user_id = ?
      AND rva.run_id = ?
    ORDER BY u.name COLLATE NOCASE ASC, u.email COLLATE NOCASE ASC
  `);

  return stmt.all(ownerUserId, runId) as ViewerShareUser[];
}

export function grantViewerAccessToRun(
  ownerUserId: string,
  runId: string,
  viewerUserId: string
) {
  const viewer = getAppUserById(viewerUserId);

  if (!viewer) {
    throw new Error("Viewer user not found");
  }

  if (viewer.role !== "viewer") {
    throw new Error("Only viewer users can be granted shared run access");
  }

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO run_viewer_access (
      grant_id,
      run_id,
      owner_user_id,
      viewer_user_id
    ) VALUES (?, ?, ?, ?)
  `);

  insertStmt.run(randomUUID(), runId, ownerUserId, viewerUserId);

  return viewer;
}

export function revokeViewerAccessFromRun(
  ownerUserId: string,
  runId: string,
  viewerUserId: string
) {
  const stmt = db.prepare(`
    DELETE FROM run_viewer_access
    WHERE owner_user_id = ?
      AND run_id = ?
      AND viewer_user_id = ?
  `);

  stmt.run(ownerUserId, runId, viewerUserId);
}

export function listSharedRunIdsForUser(viewerUserId: string) {
  const stmt = db.prepare(`
    SELECT run_id
    FROM run_viewer_access
    WHERE viewer_user_id = ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(viewerUserId) as Array<{ run_id: string }>;
  return rows.map((row) => row.run_id);
}
