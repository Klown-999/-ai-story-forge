
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import { getAppUserById, updateUserRole } from "@/lib/security-db";
import { logAuditEvent } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const authResult = await requireAppUser(["admin"]);
    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const { userId } = await context.params;
    const body = (await request.json()) as { role?: "admin" | "editor" | "viewer" };

    if (!userId) {
      return NextResponse.json(
        { message: "userId is required" },
        { status: 400 }
      );
    }

    if (!body.role || !["admin", "editor", "viewer"].includes(body.role)) {
      return NextResponse.json(
        { message: "Valid role is required" },
        { status: 400 }
      );
    }

    const targetUser = getAppUserById(userId);
    if (!targetUser) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    const previousRole = targetUser.role;

    updateUserRole(userId, body.role);

    logAuditEvent({
      userId: authResult.user.id,
      userEmail: authResult.user.email,
      action: "role_changed",
      entityType: "user",
      entityId: userId,
      message: `Admin changed role for ${targetUser.email} from ${previousRole} to ${body.role}.`,
      metadata: {
        targetUserEmail: targetUser.email,
        previousRole,
        nextRole: body.role,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Role updated successfully",
    });
  } catch (error) {
    console.error("PATCH /api/admin/users/[userId]/role failed:", error);
    return NextResponse.json(
      { message: "Failed to update user role" },
      { status: 500 }
    );
  }
}
