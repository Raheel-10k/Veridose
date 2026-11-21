"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FlaskConical, Copy, ShieldAlert, Nfc } from "lucide-react";
import {
  getWebNfcSupport,
  toAbsoluteVerifyUrl,
  writeBatchUrlToNfcTag,
} from "@/lib/web-nfc-client";

const DRUG_PRESETS = [
  "Amoxicillin 500mg",
  "Artemether-Lumefantrine",
  "Insulin Glargine 100U/mL",
];

export function ManufacturerPanel({ onIssued }: { onIssued?: () => void }) {
  const [drugName, setDrugName] = useState(DRUG_PRESETS[0]!);
  const [lotNumber, setLotNumber] = useState("LOT-2026-001");
  const [expiry, setExpiry] = useState("2027-06-30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    attestationUID: string;
    explorerUrl: string;
    txHash?: string;
    tag: { uid: string; lastCounter: number };
    simulateTapUrl: string;
  } | null>(null);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [nfcWriteStatus, setNfcWriteStatus] = useState<string | null>(null);
  const [nfcWriting, setNfcWriting] = useState(false);

  const nfcSupport = useMemo(() => getWebNfcSupport(), []);

  async function issueBatch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSimMessage(null);
    try {
      const res = await fetch("/api/batches/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drugName, lotNumber, expiry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Issue failed");
      setResult({
        attestationUID: data.attestationUID,
        explorerUrl: data.explorerUrl,
        txHash: data.txHash,
        tag: data.tag,
        simulateTapUrl: data.simulateTapUrl,
      });
      onIssued?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Issue failed");
    } finally {
      setLoading(false);
    }
  }

  async function simulate(mode: "next" | "replay") {
    if (!result) return;
    setSimMessage(null);
    try {
      const res = await fetch("/api/nfc/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, uid: result.tag.uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulate failed");
      setSimMessage(`${mode}: ${data.url}`);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setSimMessage(err instanceof Error ? err.message : "Simulate failed");
    }
  }

  async function writeToPhysicalTag() {
    if (!result) return;
    setNfcWriteStatus(null);
    setError(null);
    setNfcWriting(true);
    try {
      // Mint the next valid signed tap URL, then write it to a blank sticker.
      const res = await fetch("/api/nfc/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "next", uid: result.tag.uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not mint tap URL");

      const publicOrigin =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
        window.location.origin;
      const absolute = toAbsoluteVerifyUrl(String(data.url), publicOrigin);
      if (/localhost|127\.0\.0\.1/i.test(absolute)) {
        throw new Error(
          "Cannot write a localhost URL to a phone tag. Set NEXT_PUBLIC_APP_URL to a public HTTPS URL (ngrok/Cloudflare tunnel), restart npm run dev, then retry on Chrome Android."
        );
      }
      setNfcWriteStatus(
        "Hold a blank NFC sticker to the phone… writing VeriDose URL…"
      );
      await writeBatchUrlToNfcTag(absolute);
      setNfcWriteStatus(
        `Written. Patient can scan this tag once for AUTHENTIC (counter #${data.counter}). Re-tapping the same URL demonstrates clone/replay.`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "NFC write failed";
      setError(message);
      setNfcWriteStatus(null);
    } finally {
      setNfcWriting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-[var(--ink)]">
          Manufacturer Issue
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Anchor a medicine batch on Base Sepolia via EAS and mint a rolling NFC
          tag credential.
        </p>
      </div>

      <form onSubmit={issueBatch} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Drug name</label>
          <select
            className="field"
            value={drugName}
            onChange={(e) => setDrugName(e.target.value)}
          >
            {DRUG_PRESETS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Lot number</label>
          <input
            className="field"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Expiry</label>
          <input
            className="field"
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={loading}>
            <FlaskConical className="h-4 w-4" />
            {loading ? "Anchoring on Base Sepolia…" : "Issue Batch on Base Sepolia"}
          </button>
        </div>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-3 rounded-md border border-[var(--line)] bg-white p-4">
          <p className="text-sm">
            <span className="font-semibold">Attestation UID:</span>{" "}
            <code className="break-all text-xs">{result.attestationUID}</code>
          </p>
          <p className="text-sm">
            <span className="font-semibold">NFC UID:</span>{" "}
            <code>{result.tag.uid}</code>
          </p>
          <a
            href={result.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent-strong)]"
          >
            View on EASScan <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <div className="rounded-md bg-[#e8f0ec] px-3 py-3 text-xs text-[var(--ink-muted)]">
            <p className="font-semibold text-[var(--ink)]">
              Physical NFC sticker (prototype)
            </p>
            <p className="mt-1">
              Write the signed batch URL onto a blank NTAG213/215 sticker with
              Chrome on Android. That sticker becomes this medicine batch for
              Patient / Scanner.
            </p>
            {!nfcSupport.supported && (
              <p className="mt-2 text-amber-800">{nfcSupport.reason}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              className="btn-primary"
              disabled={nfcWriting || !nfcSupport.supported}
              onClick={writeToPhysicalTag}
            >
              <Nfc className="h-4 w-4" />
              {nfcWriting
                ? "Waiting for NFC tag…"
                : "Write batch URL to NFC tag"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => simulate("next")}
            >
              <Copy className="h-4 w-4" />
              Simulate Patient Scan
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => simulate("replay")}
            >
              <ShieldAlert className="h-4 w-4" />
              Simulate Cloned Label Replay
            </button>
          </div>
          {nfcWriteStatus && (
            <p className="text-sm text-[var(--accent-strong)]">
              {nfcWriteStatus}
            </p>
          )}
          {simMessage && (
            <p className="break-all text-xs text-[var(--ink-muted)]">
              {simMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
