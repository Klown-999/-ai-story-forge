
import { randomUUID } from "crypto";
import db from "@/lib/sqlite";

export type AuditAction =
  | "sign_in"
  | "sign_out"
  | "run_generated"
  | "source_uploaded"
  | "users_viewed"
  | "role_changed"
  | "run_shared"
  | "run_share_revoked";

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    message TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export function logAuditEvent(params: {
  userId?: string | null;
  userEmail?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
}) {
  const stmt = db.prepare(`
    INSERT INTO audit_events (
      id, user_id, user_email, action, entity_type, entity_id, message, metadata_json
    ) VALUES (
      @id, @user_id, @user_email, @action, @entity_type, @entity_id, @message, @metadata_json
    )
  `);

  stmt.run({
    id: randomUUID(),
    user_id: params.userId ?? null,
    user_email: params.userEmail ?? null,
    action: params.action,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    message: params.message,
    metadata_json: params.metadata ? JSON.stringify(params.metadata) : null,
  });
}

export function listAuditEvents(limit = 200) {
  const stmt = db.prepare(`
    SELECT *
    FROM audit_events
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as Array<{
    id: string;
    user_id: string | null;
    user_email: string | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    message: string;
    metadata_json: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    message: row.message,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    createdAt: row.created_at,
  }));
}
