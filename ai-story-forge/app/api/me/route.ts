
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";

export async function GET() {
  const result = await requireAppUser();

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    user: result.user,
  });
}
