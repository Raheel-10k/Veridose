"use client";

import { useEffect, useState } from "react";
import {
  Download,
  BadgeCheck,
  MapPin,
  Clock,
  Link as LinkIcon,
  Plus,
  Route,
  Navigation,
} from "lucide-react";
import type { CheckpointRecord } from "@/lib/types";

interface BatchOption {
  uid: string;
  batchAttestationUID: string;
  drugName: string;
  lotNumber: string;
  txHash?: string;
}

export function DistributorPanel({
  batchesVersion = 0,
}: {
  batchesVersion?: number;
}) {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchAttestationUID, setBatchAttestationUID] = useState("");
  const [fromFacility, setFromFacility] = useState("ColdHub Regional Terminal");
  const [toFacility, setToFacility] = useState("National Central Dispensary");
  const [tempRangeC, setTempRangeC] = useState("2-8");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<{
    verified: boolean;
    signedAttestationJson: string;
    signer: string;
  } | null>(null);

  // Checkpoints State
  const [checkpoints, setCheckpoints] = useState<CheckpointRecord[]>([]);
  const [showAddCheckpoint, setShowAddCheckpoint] = useState(false);
  const [routePlan, setRoutePlan] = useState("Corridor Route A (Highway 102 Transit)");
  const [cpName, setCpName] = useState("Toll Gate Cold-Storage Inspection Point 1");
  const [cpLocation, setCpLocation] = useState("Northern Border Terminal Checkpoint");
  const [cpEta, setCpEta] = useState(
    new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [addingCp, setAddingCp] = useState(false);
  const [cpSuccess, setCpSuccess] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/batches");
    const data = await res.json();
    const list = (data.batches ?? []) as BatchOption[];
    setBatches(list);
    if (list[0]) {
      setBatchAttestationUID((current) => {
        const stillValid = list.some((b) => b.batchAttestationUID === current);
        return stillValid && current ? current : list[0]!.batchAttestationUID;
      });
    }
  }

  async function loadCheckpoints(bUid: string) {
    if (!bUid) return;
    try {
      const res = await fetch(`/api/checkpoints?batchUid=${bUid}`);
      const data = await res.json();
      if (data.checkpoints) {
        setCheckpoints(data.checkpoints);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [batchesVersion]);

  useEffect(() => {
    if (batchAttestationUID) {
      loadCheckpoints(batchAttestationUID);
    }
  }, [batchAttestationUID]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProof(null);
    try {
      const res = await fetch("/api/batches/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchAttestationUID,
          fromFacility,
          toFacility,
          tempRangeC,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Handoff failed");
      setProof({
        verified: data.verified,
        signedAttestationJson: data.signedAttestationJson,
        signer: data.signer,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Handoff failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCheckpoint(e: React.FormEvent) {
    e.preventDefault();
    if (!batchAttestationUID || !cpName) return;
    setAddingCp(true);
    setError(null);
    setCpSuccess(null);

    const selectedBatch = batches.find((b) => b.batchAttestationUID === batchAttestationUID);
    const lastTx = selectedBatch?.txHash || `0x${batchAttestationUID.replace("0x", "").slice(0, 40)}`;

    try {
      const res = await fetch("/api/checkpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchAttestationUID,
          routePlan,
          checkpointName: cpName,
          location: cpLocation,
          estimatedArrival: cpEta,
          lastTxHash: lastTx,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add checkpoint");

      setCpSuccess(`Checkpoint "${data.checkpoint.checkpointName}" added with Last Tx: ${data.checkpoint.lastTxHash.slice(0, 16)}…`);
      loadCheckpoints(batchAttestationUID);
      setShowAddCheckpoint(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add checkpoint");
    } finally {
      setAddingCp(false);
    }
  }

  function downloadProof() {
    if (!proof) return;
    const blob = new Blob([proof.signedAttestationJson], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `custody-handoff-${batchAttestationUID.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedBatch = batches.find((b) => b.batchAttestationUID === batchAttestationUID);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">Distributor Logistics &amp; Checkpoints</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Manage regulated distribution routes, schedule mandated checkpoint stops with ETAs, and link on-chain transaction hashes.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-[var(--line)] bg-white p-4">
        <label className="label">Select Batch from Depot / Consignment</label>
        <select
          className="field"
          value={batchAttestationUID}
          onChange={(e) => setBatchAttestationUID(e.target.value)}
          required
        >
          {batches.length === 0 && (
            <option value="">No batches — issue or load demo first</option>
          )}
          {batches.map((b) => (
            <option key={b.uid} value={b.batchAttestationUID}>
              {b.drugName} · Lot {b.lotNumber}
            </option>
          ))}
        </select>
        {selectedBatch && (
          <p className="text-xs text-[var(--ink-muted)]">
            EAS Batch UID: <code className="break-all">{selectedBatch.batchAttestationUID}</code>
          </p>
        )}
      </div>

      {/* Regulated Route & Checkpoint Tracking Section */}
      <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 pb-3">
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-emerald-800" />
            <h3 className="font-semibold text-emerald-950">
              Assigned Route &amp; Mandatory Checkpoints
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAddCheckpoint(!showAddCheckpoint)}
            className="btn-primary text-xs py-1.5 px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            {showAddCheckpoint ? "Close form" : "Add Transit Checkpoint"}
          </button>
        </div>

        {cpSuccess && (
          <p className="rounded-md bg-emerald-100 p-2 text-xs font-semibold text-emerald-800">
            ✓ {cpSuccess}
          </p>
        )}

        {showAddCheckpoint && (
          <form onSubmit={handleAddCheckpoint} className="space-y-3 rounded-lg border border-emerald-200 bg-white p-4">
            <p className="text-xs font-semibold text-emerald-900">
              Schedule a mandatory inspection checkpoint on this batch route:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label text-xs">Route corridor</label>
                <input
                  className="field text-xs"
                  value={routePlan}
                  onChange={(e) => setRoutePlan(e.target.value)}
                  placeholder="e.g. Corridor Route A (Highway 102 Transit)"
                  required
                />
              </div>
              <div>
                <label className="label text-xs">Checkpoint designation</label>
                <input
                  className="field text-xs"
                  value={cpName}
                  onChange={(e) => setCpName(e.target.value)}
                  placeholder="e.g. Border Control Terminal 2"
                  required
                />
              </div>
              <div>
                <label className="label text-xs">Location / Facility</label>
                <input
                  className="field text-xs"
                  value={cpLocation}
                  onChange={(e) => setCpLocation(e.target.value)}
                  placeholder="e.g. Northern Waypoint Warehouse"
                  required
                />
              </div>
              <div>
                <label className="label text-xs">Estimated Arrival Time (ETA)</label>
                <input
                  type="datetime-local"
                  className="field text-xs"
                  value={cpEta}
                  onChange={(e) => setCpEta(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-gray-500">
                Anchors to Base Sepolia EAS with Route, ETA, and Last Transaction hash.
              </span>
              <button type="submit" className="btn-primary text-xs py-1.5" disabled={addingCp}>
                <Navigation className="h-3.5 w-3.5" />
                {addingCp ? "Anchoring Checkpoint…" : "Commit Checkpoint to Chain"}
              </button>
            </div>
          </form>
        )}

        {/* Existing Checkpoints Timeline */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-emerald-900">
            Scheduled Route Checkpoints ({checkpoints.length}):
          </p>
          {checkpoints.length === 0 ? (
            <p className="text-xs italic text-[var(--ink-muted)]">
              No checkpoints recorded yet for this batch. Add one above to mandate an inspection stop.
            </p>
          ) : (
            <div className="space-y-2.5">
              {checkpoints.map((cp, idx) => {
                const isInspected = cp.status === "INSPECTED_OK";
                const isTampered = cp.status === "FLAGGED_TAMPERED";
                return (
                  <div
                    key={cp.id}
                    className={`rounded-lg border p-3 text-xs transition ${
                      isTampered
                        ? "border-red-300 bg-red-50 text-red-950"
                        : isInspected
                        ? "border-emerald-300 bg-emerald-50/80 text-emerald-950"
                        : "border-gray-200 bg-white text-gray-800"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-sm">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-[10px] text-white">
                          {idx + 1}
                        </span>
                        <span>{cp.checkpointName}</span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          isTampered
                            ? "bg-red-200 text-red-800"
                            : isInspected
                            ? "bg-emerald-200 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {isTampered ? "TAMPERED / FLAGGED" : isInspected ? "INSPECTED & AUTHENTIC" : "PENDING INSPECTION"}
                      </span>
                    </div>

                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2 text-[11px] text-gray-600">
                      <p className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <span><strong>Route:</strong> {cp.routePlan} ({cp.location})</span>
                      </p>
                      <p className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span><strong>ETA:</strong> {cp.estimatedArrival.replace("T", " ")}</span>
                      </p>
                      <p className="sm:col-span-2 flex items-center gap-1 break-all">
                        <LinkIcon className="h-3 w-3 text-gray-400 shrink-0" />
                        <span><strong>Last Tx Hash:</strong> <code>{cp.lastTxHash}</code></span>
                      </p>
                    </div>

                    {cp.inspectedAt && (
                      <div className="mt-2 border-t pt-1.5 text-[11px] text-gray-700">
                        <p>
                          <strong>Inspector:</strong> {cp.inspectorName} · {cp.inspectedAt}
                        </p>
                        {cp.inspectorNote && (
                          <p className="italic text-gray-600">Note: {cp.inspectorNote}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Standard Off-Chain Custody Attestation */}
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 pt-2">
        <div>
          <label className="label">From facility</label>
          <input
            className="field"
            value={fromFacility}
            onChange={(e) => setFromFacility(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">To facility</label>
          <input
            className="field"
            value={toFacility}
            onChange={(e) => setToFacility(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Temp range (°C)</label>
          <input
            className="field"
            value={tempRangeC}
            onChange={(e) => setTempRangeC(e.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Signing…" : "Sign Off-Chain Custody Attestation (EIP-712)"}
          </button>
        </div>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {proof && (
        <div className="space-y-3 rounded-md border border-[var(--line)] bg-white p-4">
          {proof.verified && (
            <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
              <BadgeCheck className="h-4 w-4" />
              EIP-712 signature verified
            </div>
          )}
          <p className="text-xs text-[var(--ink-muted)]">
            Signer: <code>{proof.signer}</code>
          </p>
          <button type="button" className="btn-ghost" onClick={downloadProof}>
            <Download className="h-4 w-4" />
            Download JSON proof
          </button>
        </div>
      )}
    </div>
  );
}
