
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import { listAllUsers } from "@/lib/security-db";
import { logAuditEvent } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function GET() {
  try {
    const authResult = await requireAppUser(["admin"]);
    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    logAuditEvent({
      userId: authResult.user.id,
      userEmail: authResult.user.email,
      action: "users_viewed",
      entityType: "users",
      entityId: null,
      message: "Admin viewed the user directory.",
    });

    const users = listAllUsers().map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      provider: user.provider,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at,
    }));

    return NextResponse.json({ ok: true, users });
  } catch (error) {
    console.error("GET /api/admin/users failed:", error);
    return NextResponse.json(
      { message: "Failed to load users" },
      { status: 500 }
    );
  }
}
