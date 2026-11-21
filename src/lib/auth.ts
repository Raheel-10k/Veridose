import crypto from "crypto";
import { cookies } from "next/headers";
import type { UserRecord, UserRole } from "./types";
import { getUserById } from "./db";

const AUTH_COOKIE = "veridose_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "veridose-secret-auth-key-super-secure-32b!";

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  orgName: string;
  facilityName: string;
  exp: number;
}

export function signToken(payload: Omit<SessionPayload, "exp">, expiresInSeconds = 86400 * 7): string {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const data = Buffer.from(JSON.stringify(full)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    const [data, signature] = token.split(".");
    if (!data || !signature) return null;
    const expected = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(data)
      .digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as SessionPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentUserFromCookies(): Promise<UserRecord | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const session = verifyToken(token);
  if (!session) return null;
  return getUserById(session.userId);
}

export { AUTH_COOKIE };
