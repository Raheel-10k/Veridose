"use client";

import { ExternalLink, ShieldCheck, ShieldAlert, Siren } from "lucide-react";
import type { TrustVerdictPayload } from "@/lib/verdicts";
import { TrustVerdict } from "@/lib/verdicts";

export function TrustBanner({ result }: { result: TrustVerdictPayload }) {
  const tone =
    result.verdict === TrustVerdict.VERIFIED_AUTHENTIC
      ? "ok"
      : result.verdict === TrustVerdict.CLONE_REPLAY_DETECTED ||
          result.verdict === TrustVerdict.TAMPERED
        ? "danger"
        : result.verdict === TrustVerdict.FLAGGED_SUSPICIOUS ||
            result.verdict === TrustVerdict.RECALLED
          ? "warn"
          : "neutral";

  const styles = {
    ok: "bg-emerald-600 text-white",
    danger: "bg-red-700 text-white",
    warn: "bg-amber-600 text-white",
    neutral: "bg-slate-700 text-white",
  }[tone];

  const title =
    result.verdict === TrustVerdict.VERIFIED_AUTHENTIC
      ? "VERIFIED AUTHENTIC"
      : result.verdict === TrustVerdict.CLONE_REPLAY_DETECTED
        ? "COUNTERFEIT WARNING: CLONED LABEL / REPLAY DETECTED"
        : result.verdict === TrustVerdict.RECALLED
          ? "DO NOT DISPENSE: BATCH RECALLED ON-CHAIN"
          : result.verdict === TrustVerdict.FLAGGED_SUSPICIOUS
            ? "DO NOT DISPENSE: BATCH FLAGGED ON-CHAIN"
            : result.verdict === TrustVerdict.TAMPERED
              ? "TAMPERED / INVALID SIGNATURE"
              : "VERIFICATION INCOMPLETE";

  const Icon =
    tone === "ok" ? ShieldCheck : tone === "warn" ? Siren : ShieldAlert;

  return (
    <div className={`rounded-lg px-5 py-6 shadow-lg ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-7 w-7 shrink-0" />
        <div className="space-y-2">
          <h1 className="font-display text-2xl leading-tight sm:text-3xl">
            {title}
          </h1>
          <p className="text-sm/relaxed opacity-95">{result.message}</p>
          {result.batch?.drugName && (
            <p className="text-sm opacity-90">
              {result.batch.drugName}
              {result.batch.lotNumber ? ` · Lot ${result.batch.lotNumber}` : ""}
            </p>
          )}
          {(result.batch?.flagExplorerUrl || result.batch?.explorerUrl) && (
            <a
              href={
                result.batch.flagExplorerUrl || result.batch.explorerUrl
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2"
            >
              View attestation on EASScan
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
