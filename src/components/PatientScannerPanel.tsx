"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Nfc, Radio, StopCircle } from "lucide-react";
import {
  extractVerifyTarget,
  getWebNfcSupport,
  scanNfcForVerifyUrl,
  toAbsoluteVerifyUrl,
} from "@/lib/web-nfc-client";

export function PatientScannerPanel() {
  const router = useRouter();
  const [supportMsg, setSupportMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<string>(
    "Hold a programmed medicine NFC tag to the back of your phone."
  );
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const support = getWebNfcSupport();
    if (!support.supported) {
      setSupportMsg(support.reason ?? "Web NFC unavailable");
    }
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function goVerify(pathOrUrl: string) {
    const absolute = toAbsoluteVerifyUrl(pathOrUrl);
    try {
      const parsed = new URL(absolute);
      router.push(`${parsed.pathname}${parsed.search}`);
    } catch {
      router.push(pathOrUrl.startsWith("/") ? pathOrUrl : `/verify?${pathOrUrl}`);
    }
  }

  async function startScan() {
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setScanning(true);
    setStatus("NFC scan active — tap the medicine tag now…");

    try {
      await scanNfcForVerifyUrl(
        (target, serial) => {
          if (!target) {
            setError(
              serial
                ? `Tag serial ${serial} has no VeriDose URL. Manufacturer must write the batch URL onto the sticker first.`
                : "Tag has no VeriDose verify payload."
            );
            setStatus("Scan failed — tag not programmed for VeriDose.");
            return;
          }
          setStatus(`Tag read — opening verifier…`);
          controller.abort();
          setScanning(false);
          goVerify(target);
        },
        { signal: controller.signal }
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      setScanning(false);
      setError(err instanceof Error ? err.message : "NFC scan failed");
      setStatus("Scan stopped.");
    }
  }

  function stopScan() {
    abortRef.current?.abort();
    abortRef.current = null;
    setScanning(false);
    setStatus("Scan cancelled.");
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const target = extractVerifyTarget(manual);
    if (!target) {
      setError(
        "Paste a /verify?uid=&counter=&cmac= URL (or the query string)."
      );
      return;
    }
    goVerify(target);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">Patient / Scanner</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Scan a physical NFC sticker that the manufacturer programmed with this
          batch&apos;s signed verify URL. First tap should verify authentic;
          tapping the same written URL again demonstrates clone/replay.
        </p>
      </div>

      {supportMsg && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {supportMsg}
        </div>
      )}

      <div className="rounded-md border border-[var(--line)] bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          <Radio className="h-4 w-4 text-[var(--accent)]" />
          Phone NFC reader
        </div>
        <p className="text-sm text-[var(--ink-muted)]">{status}</p>
        <div className="flex flex-wrap gap-2">
          {!scanning ? (
            <button
              type="button"
              className="btn-primary"
              onClick={startScan}
              disabled={Boolean(supportMsg)}
            >
              <Nfc className="h-4 w-4" />
              Scan NFC Tag
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={stopScan}>
              <StopCircle className="h-4 w-4" />
              Stop scanning
            </button>
          )}
        </div>
        <ol className="list-decimal space-y-1 pl-4 text-xs text-[var(--ink-muted)]">
          <li>Manufacturer issues a batch on Base Sepolia.</li>
          <li>
            Manufacturer taps <strong>Write batch URL to NFC tag</strong> and
            holds a blank NTAG sticker to the phone.
          </li>
          <li>Patient uses this screen (or OS tap-to-open) to verify.</li>
        </ol>
      </div>

      <form onSubmit={submitManual} className="space-y-3">
        <label className="label">Manual / desktop fallback</label>
        <textarea
          className="field min-h-[72px]"
          placeholder="/verify?uid=…&counter=1&cmac=…"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <button type="submit" className="btn-ghost">
          Open verifier from pasted URL
        </button>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
