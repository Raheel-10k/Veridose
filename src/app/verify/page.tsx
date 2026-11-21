"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { TrustBanner } from "@/components/TrustBanner";
import { OfflineToggle } from "@/components/OfflineToggle";
import {
  cacheKeyForTap,
  getVerificationCache,
  saveVerificationCache,
} from "@/lib/offline-cache";
import type { TrustVerdictPayload } from "@/lib/verdicts";
import { TrustVerdict } from "@/lib/verdicts";

function VerifyInner() {
  const params = useSearchParams();
  const [offlineMode, setOfflineMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<TrustVerdictPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryKey = useMemo(() => {
    const uid = params.get("uid") ?? "";
    const batchUid = params.get("batchUid") ?? "";
    return cacheKeyForTap(uid || "none", batchUid || undefined);
  }, [params]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      if (offlineMode) {
        const cached = getVerificationCache(queryKey);
        if (!cancelled) {
          if (cached) {
            setResult({
              ...cached.payload,
              message: `${cached.payload.message} (served from offline cache · ${cached.savedAt})`,
            });
          } else {
            setResult({
              verdict: TrustVerdict.UNKNOWN,
              authentic: false,
              message:
                "Offline Clinic Mode: no cached verification for this tag. Connect once to populate the cache.",
            });
          }
          setLoading(false);
        }
        return;
      }

      try {
        const qs = params.toString();
        const res = await fetch(`/api/verify?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Verify failed");
        if (!cancelled) {
          setResult(data as TrustVerdictPayload);
          if (data.authentic || data.verdict) {
            saveVerificationCache(queryKey, data as TrustVerdictPayload);
          }
        }
      } catch (err) {
        if (!cancelled) {
          const cached = getVerificationCache(queryKey);
          if (cached) {
            setResult({
              ...cached.payload,
              message: `${cached.payload.message} (network error — fallback cache)`,
            });
          } else {
            setError(err instanceof Error ? err.message : "Verify failed");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [params, offlineMode, queryKey]);

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="font-display text-xl tracking-tight text-white"
        >
          VeriDose
        </Link>
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/90">
          Patient / Dispensary
        </span>
      </div>

      <div className="panel space-y-5 rounded-2xl p-5 sm:p-6">
        <OfflineToggle enabled={offlineMode} onChange={setOfflineMode} />

        {loading && (
          <p className="text-sm text-[var(--ink-muted)]">Verifying tap…</p>
        )}
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {result && !loading && <TrustBanner result={result} />}

        <div className="rounded-md bg-[#e8f0ec] px-3 py-3 text-xs text-[var(--ink-muted)]">
          <p className="font-semibold text-[var(--ink)]">Tap parameters</p>
          <p className="mt-1 break-all">
            uid={params.get("uid") ?? "—"} · counter={params.get("counter") ?? "—"} ·
            cmac={params.get("cmac") ?? "—"}
          </p>
          {params.get("picc_data") && (
            <p className="mt-1 break-all">
              picc_data={params.get("picc_data")}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-xl px-4 py-12 text-white">
          Loading verifier…
        </main>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
