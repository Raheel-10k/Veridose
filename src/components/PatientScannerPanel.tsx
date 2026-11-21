"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Nfc,
  Radio,
  StopCircle,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Clock,
  Link as LinkIcon,
  CheckCircle,
} from "lucide-react";
import {
  extractVerifyTarget,
  getWebNfcSupport,
  scanNfcForVerifyUrl,
  toAbsoluteVerifyUrl,
} from "@/lib/web-nfc-client";
import type { CheckpointRecord, UserRecord } from "@/lib/types";

interface BatchItem {
  uid: string;
  batchAttestationUID: string;
  drugName: string;
  lotNumber: string;
  batchStatus?: number;
}

export function PatientScannerPanel({
  user,
}: {
  user?: UserRecord | null;
}) {
  const router = useRouter();
  const [supportMsg, setSupportMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<string>(
    "Hold a programmed medicine NFC tag to the back of your phone."
  );
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Inspector & Checkpoint Inspection Mode
  const isInspector = user?.role === "Inspector" || user?.role === "Regulator" || user?.role === "Pharmacist";
  void isInspector;
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatchUid, setSelectedBatchUid] = useState("");
  const [checkpoints, setCheckpoints] = useState<CheckpointRecord[]>([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState("");
  const [inspectorNote, setInspectorNote] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState<{
    ok: boolean;
    message: string;
    flagAttestationUID?: string;
  } | null>(null);

  useEffect(() => {
    const support = getWebNfcSupport();
    if (!support.supported) {
      setSupportMsg(support.reason ?? "Web NFC unavailable");
    }
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Fetch batches & checkpoints
  async function loadBatchesAndCheckpoints() {
    try {
      const res = await fetch("/api/batches");
      const data = await res.json();
      const list = (data.batches ?? []) as BatchItem[];
      setBatches(list);
      if (list[0]) {
        setSelectedBatchUid(list[0].batchAttestationUID);
      }
    } catch {
      // ignore
    }
  }

  async function loadCheckpoints(bUid: string) {
    if (!bUid) return;
    try {
      const res = await fetch(`/api/checkpoints?batchUid=${bUid}`);
      const data = await res.json();
      const cps = (data.checkpoints ?? []) as CheckpointRecord[];
      setCheckpoints(cps);
      if (cps[0]) {
        setSelectedCheckpointId(cps[0].id);
      } else {
        setSelectedCheckpointId("");
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadBatchesAndCheckpoints();
  }, []);

  useEffect(() => {
    if (selectedBatchUid) {
      loadCheckpoints(selectedBatchUid);
    }
  }, [selectedBatchUid]);

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

  async function recordCheckpointAudit(statusVerdict: "INSPECTED_OK" | "FLAGGED_TAMPERED") {
    if (!selectedCheckpointId) return;
    setInspecting(true);
    setError(null);
    setInspectResult(null);

    try {
      const res = await fetch("/api/checkpoints/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpointId: selectedCheckpointId,
          status: statusVerdict,
          inspectorName: user?.name || "Field Checkpoint Inspector",
          inspectorNote: inspectorNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Inspection update failed");

      setInspectResult({
        ok: statusVerdict === "INSPECTED_OK",
        message: data.message,
        flagAttestationUID: data.flagAttestationUID,
      });

      if (selectedBatchUid) {
        loadCheckpoints(selectedBatchUid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inspection failed");
    } finally {
      setInspecting(false);
    }
  }

  const activeCheckpoint = checkpoints.find((c) => c.id === selectedCheckpointId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">
          {user ? `Inspector & Patient Scanner (${user.name})` : "Patient / Inspector Scanner"}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Inspect and verify medicine batches via NFC scans. Field inspectors check packages at mandated checkpoints and flag tampered, scraped, or cloned products.
        </p>
      </div>

      {supportMsg && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {supportMsg}
        </div>
      )}

      {/* Checkpoint Inspection Desk (for Inspectors, Regulators, or any scanner) */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-indigo-200 pb-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-700" />
            <h3 className="font-semibold text-indigo-950">
              Checkpoint NFC Inspection &amp; Tamper Detection Desk
            </h3>
          </div>
          <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-mono font-semibold text-indigo-800">
            Inspector Mode
          </span>
        </div>

        <p className="text-xs text-indigo-900">
          Inspectors scan NFC tags at transit checkpoints to compare physical details against the on-chain route plan and previous transaction hash. If packaging or RFID/NFC data shows tampering or scraping, an on-chain alert flag is issued immediately.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label text-xs">Select Batch</label>
            <select
              className="field text-xs"
              value={selectedBatchUid}
              onChange={(e) => setSelectedBatchUid(e.target.value)}
            >
              {batches.map((b) => (
                <option key={b.uid} value={b.batchAttestationUID}>
                  {b.drugName} · Lot {b.lotNumber}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-xs">Assigned Route Checkpoint</label>
            <select
              className="field text-xs"
              value={selectedCheckpointId}
              onChange={(e) => setSelectedCheckpointId(e.target.value)}
            >
              {checkpoints.length === 0 && (
                <option value="">No checkpoints scheduled — add via Distributor</option>
              )}
              {checkpoints.map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.checkpointName} ({cp.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeCheckpoint && (
          <div className="rounded-lg border border-indigo-200 bg-white p-3 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-gray-900">{activeCheckpoint.checkpointName}</span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-mono text-gray-700">
                Status: {activeCheckpoint.status}
              </span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 text-[11px] text-gray-600">
              <p className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-indigo-500" />
                <span><strong>Route:</strong> {activeCheckpoint.routePlan} ({activeCheckpoint.location})</span>
              </p>
              <p className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-indigo-500" />
                <span><strong>ETA:</strong> {activeCheckpoint.estimatedArrival.replace("T", " ")}</span>
              </p>
              <p className="sm:col-span-2 flex items-center gap-1 break-all">
                <LinkIcon className="h-3 w-3 text-indigo-500 shrink-0" />
                <span><strong>Linked Last Tx:</strong> <code>{activeCheckpoint.lastTxHash}</code></span>
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="label text-xs">Inspector Findings &amp; Tamper Notes</label>
          <input
            className="field text-xs"
            placeholder="e.g. Scanned NFC tag counter valid, seal unbroken OR Barcode scraped, counter mismatch"
            value={inspectorNote}
            onChange={(e) => setInspectorNote(e.target.value)}
          />

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={inspecting || !selectedCheckpointId}
              onClick={() => recordCheckpointAudit("INSPECTED_OK")}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              {inspecting ? "Recording…" : "Confirm Checkpoint Pass (Authentic)"}
            </button>

            <button
              type="button"
              disabled={inspecting || !selectedCheckpointId}
              onClick={() => recordCheckpointAudit("FLAGGED_TAMPERED")}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition disabled:opacity-50"
            >
              <AlertTriangle className="h-4 w-4" />
              {inspecting ? "Flagging…" : "Raise Tamper Flag (Mark Suspicious)"}
            </button>
          </div>
        </div>

        {inspectResult && (
          <div
            className={`rounded-lg p-3 text-xs font-medium ${
              inspectResult.ok
                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                : "bg-red-100 text-red-950 border border-red-300"
            }`}
          >
            <p className="font-semibold">{inspectResult.message}</p>
            {inspectResult.flagAttestationUID && (
              <p className="mt-1 break-all text-[11px]">
                On-Chain Flag Attestation: <code>{inspectResult.flagAttestationUID}</code>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Hardware NFC Scanner & Manual Input */}
      <div className="rounded-md border border-[var(--line)] bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          <Radio className="h-4 w-4 text-[var(--accent)]" />
          Hardware Phone NFC Reader
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
      </div>

      <div className="rounded-md border border-[var(--line)] bg-white p-4">
        <form onSubmit={submitManual} className="space-y-2">
          <label className="label">Manual verify query</label>
          <p className="text-xs text-[var(--ink-muted)]">
            If testing without Web NFC, paste the simulated URL or search query:
          </p>
          <div className="flex gap-2">
            <input
              className="field text-xs font-mono"
              placeholder="/verify?uid=...&counter=1&cmac=..."
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
            <button type="submit" className="btn-primary shrink-0">
              Verify
            </button>
          </div>
        </form>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
