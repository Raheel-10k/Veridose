import { NextResponse } from "next/server";
import { createUser, getUserByEmail } from "@/lib/db";
import { signToken, AUTH_COOKIE } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim();
    const role = (body.role as UserRole) ?? "Manufacturer";
    const orgName = String(body.orgName ?? "").trim();
    const facilityName = String(body.facilityName ?? "").trim();

    if (!email || !password || !name) {
      return NextResponse.json(
        { ok: false, error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const user = await createUser({
      email,
      password,
      name,
      role,
      orgName: orgName || (role === "Depot" ? "PharmaCorp Global" : `${name} Org`),
      facilityName: facilityName || (role === "Depot" ? "PharmaCorp Central Hub / Depot 1" : "Main Facility"),
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      orgName: user.orgName,
      facilityName: user.facilityName,
    });

    const response = NextResponse.json({
      ok: true,
      user,
      message: "Account created successfully",
    });

    response.cookies.set({
      name: AUTH_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 86400 * 7,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signup failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
