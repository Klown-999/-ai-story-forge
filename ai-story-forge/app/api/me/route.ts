
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireAppUser();

  if (!authResult.ok) {
    return NextResponse.json(
      { message: authResult.message },
      { status: authResult.status }
    );
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: authResult.user.id,
      email: authResult.user.email,
      name: authResult.user.name,
      role: authResult.user.role,
      provider: authResult.user.provider,
    },
  });
}
