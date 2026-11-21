import { DEFAULT_RPC_URL } from "./constants";

export interface ServerEnv {
  BASE_SEPOLIA_RPC_URL: string;
  RELAYER_PRIVATE_KEY: string;
  ATP_SCHEMA_UID: string;
  BATCH_SCHEMA_UID: string;
  CUSTODY_SCHEMA_UID: string;
  NEXT_PUBLIC_APP_URL?: string;
}

function requireKey(name: keyof ServerEnv, optional = false): string {
  const value = process.env[name]?.trim();
  if (!value) {
    if (optional) return "";
    throw new Error(
      `Missing required env var ${name}. See .env.example for where to obtain it.`
    );
  }
  return value;
}

/** Soft read for routes that can degrade without full chain config. */
export function peekServerEnv(): Partial<ServerEnv> {
  return {
    BASE_SEPOLIA_RPC_URL:
      process.env.BASE_SEPOLIA_RPC_URL?.trim() || DEFAULT_RPC_URL,
    RELAYER_PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY?.trim(),
    ATP_SCHEMA_UID: process.env.ATP_SCHEMA_UID?.trim(),
    BATCH_SCHEMA_UID: process.env.BATCH_SCHEMA_UID?.trim(),
    CUSTODY_SCHEMA_UID: process.env.CUSTODY_SCHEMA_UID?.trim(),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL?.trim(),
  };
}

export function getServerEnv(): ServerEnv {
  const key = requireKey("RELAYER_PRIVATE_KEY");
  const normalized = key.startsWith("0x") ? key : `0x${key}`;
  return {
    BASE_SEPOLIA_RPC_URL:
      process.env.BASE_SEPOLIA_RPC_URL?.trim() || DEFAULT_RPC_URL,
    RELAYER_PRIVATE_KEY: normalized,
    ATP_SCHEMA_UID: requireKey("ATP_SCHEMA_UID"),
    BATCH_SCHEMA_UID: requireKey("BATCH_SCHEMA_UID"),
    CUSTODY_SCHEMA_UID: requireKey("CUSTODY_SCHEMA_UID"),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL?.trim() || undefined,
  };
}

export function getAppBaseUrl(fallbackOrigin?: string): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    fallbackOrigin ||
    "http://localhost:3000"
  );
}
