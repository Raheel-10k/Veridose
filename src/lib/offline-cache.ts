import type { TrustVerdictPayload } from "./verdicts";

const CACHE_KEY = "veridose.offline.verifications.v1";

export interface CachedVerification {
  key: string;
  savedAt: string;
  payload: TrustVerdictPayload;
}

function readAll(): CachedVerification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CachedVerification[];
  } catch {
    return [];
  }
}

function writeAll(items: CachedVerification[]) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(items.slice(0, 50)));
}

export function cacheKeyForTap(uid: string, batchUid?: string): string {
  return `${uid.toLowerCase()}::${batchUid ?? ""}`;
}

export function saveVerificationCache(
  key: string,
  payload: TrustVerdictPayload
): void {
  const items = readAll().filter((i) => i.key !== key);
  items.unshift({ key, savedAt: new Date().toISOString(), payload });
  writeAll(items);
}

export function getVerificationCache(key: string): CachedVerification | null {
  return readAll().find((i) => i.key === key) ?? null;
}

export function listVerificationCache(): CachedVerification[] {
  return readAll();
}
