import { NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUserFromCookies();
    return NextResponse.json({ ok: true, user: user ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load user";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
