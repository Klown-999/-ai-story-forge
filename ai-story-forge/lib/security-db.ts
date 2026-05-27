
import { randomUUID } from "crypto";
import db from "@/lib/sqlite";
import type {
  AutonomousRefinementSummary,
  RequirementQualityReport,
} from "@/lib/ai/schemas";

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
  CREATE TABLE IF NOT EXISTS run_stories (
    run_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    estimate TEXT NOT NULL,
    owner TEXT NOT NULL,
    depends_on_json TEXT NOT NULL,
    labels_json TEXT NOT NULL,
    acceptance_json TEXT NOT NULL,
    story_format TEXT,
    story_points INTEGER,
    edge_cases_json TEXT,
    PRIMARY KEY (run_id, story_id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS run_refinement_summaries (
    run_id TEXT PRIMARY KEY,
    summary_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  CREATE TABLE IF NOT EXISTS run_generation_jobs (
    job_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    prd_text TEXT NOT NULL,
    user_approved_major_changes INTEGER,
    source_type TEXT,
    source_file_name TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    finished_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS run_jira_issues (
    run_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    issue_key TEXT NOT NULL,
    issue_url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (run_id, story_id, issue_key)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    prd TEXT NOT NULL,
    prd_fingerprint TEXT,
    major_decision TEXT,
    story_count INTEGER NOT NULL DEFAULT 0,
    jira_count INTEGER NOT NULL DEFAULT 0,
    source_type TEXT,
    source_file_name TEXT,
    last_saved_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  CREATE TABLE IF NOT EXISTS run_quality_reports (
    run_id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    report_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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


try {
  db.exec(`ALTER TABLE runs ADD COLUMN prd_fingerprint TEXT;`);
} catch {}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_runs_prd_fingerprint
  ON runs (prd_fingerprint);
`);

try {
  db.exec(`ALTER TABLE run_stories ADD COLUMN story_format TEXT;`);
} catch {}

try {
  db.exec(`ALTER TABLE run_stories ADD COLUMN story_points INTEGER;`);
} catch {}

try {
  db.exec(`ALTER TABLE run_stories ADD COLUMN edge_cases_json TEXT;`);
} catch {}

export function getAppUserByEmail(email: string) {
  const stmt = db.prepare(`
    SELECT *
    FROM users
    WHERE lower(email) = lower(?)
    LIMIT 1
  `);

  return stmt.get(email) as AppUserRow | undefined;
}

export function upsertRunJiraIssue(params: {
  runId: string;
  storyId: string;
  issueKey: string;
  issueUrl: string;
}) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO run_jira_issues (
      run_id,
      story_id,
      issue_key,
      issue_url,
      created_at
    ) VALUES (?, ?, ?, ?, datetime('now'))
  `);

  stmt.run(params.runId, params.storyId, params.issueKey, params.issueUrl);
}

export function getRunJiraIssues(runId: string) {
  const stmt = db.prepare(`
    SELECT
      run_id,
      story_id,
      issue_key,
      issue_url,
      created_at
    FROM run_jira_issues
    WHERE run_id = ?
    ORDER BY created_at ASC
  `);

  return stmt.all(runId) as Array<{
    run_id: string;
    story_id: string;
    issue_key: string;
    issue_url: string;
    created_at: string;
  }>;
}

export function recomputeRunJiraCount(runId: string) {
  const stmt = db.prepare(`
    UPDATE runs
    SET
      jira_count = (
        SELECT COUNT(*)
        FROM run_jira_issues
        WHERE run_id = ?
      ),
      last_saved_at = datetime('now')
    WHERE run_id = ?
  `);

  stmt.run(runId, runId);
}

export type RunGenerationJobStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed";

export function createGenerationJob(params: {
  jobId: string;
  runId: string;
  ownerUserId: string;
  prdText: string;
  userApprovedMajorChanges?: boolean | null;
  sourceType?: string | null;
  sourceFileName?: string | null;
}) {
  const stmt = db.prepare(`
    INSERT INTO run_generation_jobs (
      job_id,
      run_id,
      owner_user_id,
      status,
      prd_text,
      user_approved_major_changes,
      source_type,
      source_file_name
    ) VALUES (?, ?, ?, 'queued', ?, ?, ?, ?)
  `);

  stmt.run(
    params.jobId,
    params.runId,
    params.ownerUserId,
    params.prdText,
    params.userApprovedMajorChanges == null
      ? null
      : params.userApprovedMajorChanges
      ? 1
      : 0,
    params.sourceType ?? null,
    params.sourceFileName ?? null
  );
}

export function getGenerationJobByRunId(runId: string) {
  const stmt = db.prepare(`
    SELECT *
    FROM run_generation_jobs
    WHERE run_id = ?
    LIMIT 1
  `);

  return stmt.get(runId) as
    | {
        job_id: string;
        run_id: string;
        owner_user_id: string;
        status: RunGenerationJobStatus;
        prd_text: string;
        user_approved_major_changes: number | null;
        source_type: string | null;
        source_file_name: string | null;
        error_message: string | null;
        created_at: string;
        started_at: string | null;
        finished_at: string | null;
        updated_at: string;
      }
    | undefined;
}

export function listQueuedGenerationJobs(limit = 5) {
  const stmt = db.prepare(`
    SELECT *
    FROM run_generation_jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT ?
  `);

  return stmt.all(limit) as Array<{
    job_id: string;
    run_id: string;
    owner_user_id: string;
    status: RunGenerationJobStatus;
    prd_text: string;
    user_approved_major_changes: number | null;
    source_type: string | null;
    source_file_name: string | null;
    error_message: string | null;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    updated_at: string;
  }>;
}

export function markGenerationJobProcessing(jobId: string) {
  const stmt = db.prepare(`
    UPDATE run_generation_jobs
    SET status = 'processing',
        started_at = datetime('now'),
        updated_at = datetime('now')
    WHERE job_id = ?
      AND status = 'queued'
  `);

  const result = stmt.run(jobId);
  return result.changes > 0;
}

export function markGenerationJobReady(jobId: string) {
  const stmt = db.prepare(`
    UPDATE run_generation_jobs
    SET status = 'ready',
        finished_at = datetime('now'),
        updated_at = datetime('now'),
        error_message = NULL
    WHERE job_id = ?
  `);

  stmt.run(jobId);
}

export function markGenerationJobFailed(jobId: string, errorMessage: string) {
  const stmt = db.prepare(`
    UPDATE run_generation_jobs
    SET status = 'failed',
        finished_at = datetime('now'),
        updated_at = datetime('now'),
        error_message = ?
    WHERE job_id = ?
  `);

  stmt.run(errorMessage, jobId);
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
  storyFormat?: string | null;
  storyPoints?: number | null;
  edgeCases?: string[];
};

export function createRun(params: {
  ownerUserId: string;
  title: string;
  date: string;
  prd: string;
  prdFingerprint: string;
  majorDecision?: string | null;
  storyCount?: number;
  jiraCount?: number;
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
      prd_fingerprint,
      major_decision,
      story_count,
      jira_count,
      source_type,
      source_file_name,
      last_saved_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  stmt.run(
    runId,
    params.ownerUserId,
    params.title,
    params.date,
    params.prd,
    params.prdFingerprint,
    params.majorDecision ?? null,
    params.storyCount ?? 0,
    params.jiraCount ?? 0,
    params.sourceType ?? null,
    params.sourceFileName ?? null
  );

  return runId;
}

export function replaceStoriesForRun(runId: string, rows: StoryRow[]) {
  const deleteStmt = db.prepare(`
    DELETE FROM run_stories
    WHERE run_id = ?
  `);

  deleteStmt.run(runId);

  const insertStmt = db.prepare(`
    INSERT INTO run_stories (
      run_id,
      story_id,
      kind,
      title,
      estimate,
      owner,
      depends_on_json,
      labels_json,
      acceptance_json,
      story_format,
      story_points,
      edge_cases_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of rows) {
    insertStmt.run(
      runId,
      row.id,
      row.kind,
      row.title,
      row.estimate,
      row.owner,
      JSON.stringify(row.dependsOn || []),
      JSON.stringify(row.labels || []),
      JSON.stringify(row.acceptance || []),
      row.storyFormat ?? null,
      row.storyPoints ?? null,
      JSON.stringify(row.edgeCases || [])
    );
  }
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

export function getStoriesForRun(runId: string) {
  const stmt = db.prepare(`
    SELECT
      story_id,
      kind,
      title,
      estimate,
      owner,
      depends_on_json,
      labels_json,
      acceptance_json,
      story_format,
      story_points,
      edge_cases_json
    FROM run_stories
    WHERE run_id = ?
    ORDER BY kind ASC, story_id ASC
  `);

  const rows = stmt.all(runId) as Array<{
    story_id: string;
    kind: "Epic" | "Story";
    title: string;
    estimate: "S" | "M" | "L" | "XL";
    owner: string;
    depends_on_json: string;
    labels_json: string;
    acceptance_json: string;
    story_format: string | null;
    story_points: number | null;
    edge_cases_json: string | null;
  }>;

  return rows.map((row) => ({
    id: row.story_id,
    kind: row.kind,
    title: row.title,
    estimate: row.estimate,
    owner: row.owner,
    dependsOn: JSON.parse(row.depends_on_json || "[]"),
    labels: JSON.parse(row.labels_json || "[]"),
    acceptance: JSON.parse(row.acceptance_json || "[]"),
    storyFormat: row.story_format ?? undefined,
    storyPoints: row.story_points ?? undefined,
    edgeCases: row.edge_cases_json
      ? JSON.parse(row.edge_cases_json)
      : [],
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

export function upsertRunQualityReport(
  runId: string,
  report: RequirementQualityReport
) {
  const stmt = db.prepare(`
    INSERT INTO run_quality_reports (
      run_id,
      summary,
      report_json,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(run_id) DO UPDATE SET
      summary = excluded.summary,
      report_json = excluded.report_json,
      updated_at = datetime('now')
  `);

  stmt.run(runId, report.summary, JSON.stringify(report));
}

export function getRunQualityReport(runId: string) {
  const stmt = db.prepare(`
    SELECT report_json
    FROM run_quality_reports
    WHERE run_id = ?
    LIMIT 1
  `);

  const row = stmt.get(runId) as { report_json: string } | undefined;
  if (!row) return null;

  try {
    return JSON.parse(row.report_json) as RequirementQualityReport;
  } catch {
    return null;
  }
}

export function upsertRunRefinementSummary(
  runId: string,
  summary: AutonomousRefinementSummary
) {
  const stmt = db.prepare(`
    INSERT INTO run_refinement_summaries (
      run_id,
      summary_json,
      created_at,
      updated_at
    )
    VALUES (?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(run_id) DO UPDATE SET
      summary_json = excluded.summary_json,
      updated_at = datetime('now')
  `);

  stmt.run(runId, JSON.stringify(summary));
}

export function getRunRefinementSummary(runId: string) {
  const stmt = db.prepare(`
    SELECT summary_json
    FROM run_refinement_summaries
    WHERE run_id = ?
    LIMIT 1
  `);

  const row = stmt.get(runId) as { summary_json: string } | undefined;
  if (!row) return null;

  try {
    return JSON.parse(row.summary_json) as AutonomousRefinementSummary;
  } catch {
    return null;
  }
}

export function updateRunGeneratedMetadata(params: {
  runId: string;
  prd: string;
  majorDecision: string;
}) {
  const stmt = db.prepare(`
    UPDATE runs
    SET
      prd = ?,
      major_decision = ?,
      last_saved_at = datetime('now')
    WHERE run_id = ?
  `);

  stmt.run(params.prd, params.majorDecision, params.runId);
}

export function findRunsByPrdFingerprint(
  ownerUserId: string,
  prdFingerprint: string
) {
  const stmt = db.prepare(`
    SELECT
      run_id,
      owner_user_id,
      title,
      date,
      prd,
      prd_fingerprint,
      major_decision,
      story_count,
      jira_count,
      source_type,
      source_file_name,
      last_saved_at
    FROM runs
    WHERE owner_user_id = ?
      AND prd_fingerprint = ?
    ORDER BY last_saved_at DESC
  `);

  return stmt.all(ownerUserId, prdFingerprint) as Array<{
    run_id: string;
    owner_user_id: string;
    title: string;
    date: string;
    prd: string;
    prd_fingerprint: string | null;
    major_decision: string | null;
    story_count: number;
    jira_count: number;
    source_type: string | null;
    source_file_name: string | null;
    last_saved_at: string;
  }>;
}

export function findJiraExportedRunsByPrdFingerprint(
  ownerUserId: string,
  prdFingerprint: string,
  excludeRunId?: string
) {
  const stmt = db.prepare(`
    SELECT
      run_id,
      owner_user_id,
      title,
      date,
      prd,
      prd_fingerprint,
      major_decision,
      story_count,
      jira_count,
      source_type,
      source_file_name,
      last_saved_at
    FROM runs
    WHERE owner_user_id = ?
      AND prd_fingerprint = ?
      AND jira_count > 0
      ${excludeRunId ? "AND run_id != ?" : ""}
    ORDER BY last_saved_at DESC
  `);

  return excludeRunId
    ? (stmt.all(ownerUserId, prdFingerprint, excludeRunId) as Array<{
        run_id: string;
        owner_user_id: string;
        title: string;
        date: string;
        prd: string;
        prd_fingerprint: string | null;
        major_decision: string | null;
        story_count: number;
        jira_count: number;
        source_type: string | null;
        source_file_name: string | null;
        last_saved_at: string;
      }>)
    : (stmt.all(ownerUserId, prdFingerprint) as Array<{
        run_id: string;
        owner_user_id: string;
        title: string;
        date: string;
        prd: string;
        prd_fingerprint: string | null;
        major_decision: string | null;
        story_count: number;
        jira_count: number;
        source_type: string | null;
        source_file_name: string | null;
        last_saved_at: string;
      }>);
}
