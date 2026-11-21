import { NextResponse } from "next/server";
import { EAS_EXPLORER_URL } from "./constants";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonError(message: string, status = 400, extra?: object) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function attestationExplorerUrl(uid: string): string {
  return `${EAS_EXPLORER_URL}/attestation/view/${uid}`;
}

export function txExplorerUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}
