"use client";

import { useEffect, useState } from "react";
import { Download, BadgeCheck, Warehouse, Truck } from "lucide-react";

interface BatchOption {
  uid: string;
  batchAttestationUID: string;
  drugName: string;
  lotNumber: string;
  handoffCount?: number;
}

export function DepotPanel({
  batchesVersion = 0,
  userFacility = "PharmaCorp Central Hub / Depot 1",
  onHandoffComplete,
}: {
  batchesVersion?: number;
  userFacility?: string;
  onHandoffComplete?: () => void;
}) {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchAttestationUID, setBatchAttestationUID] = useState("");
  const [fromFacility, setFromFacility] = useState(userFacility || "PharmaCorp Central Hub / Depot 1");
  const [toFacility, setToFacility] = useState("Apex Logistics Regional Distribution Hub");
  const [tempRangeC, setTempRangeC] = useState("2-8");
  const [dispatchType, setDispatchType] = useState<"external_distributor" | "internal_fleet">("external_distributor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<{
    verified: boolean;
    signedAttestationJson: string;
    signer: string;
  } | null>(null);

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

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [batchesVersion]);

  async function submitHandoff(e: React.FormEvent) {
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
          fromFacility: `${fromFacility} (Org Depot)`,
          toFacility: `${toFacility} [${dispatchType === "external_distributor" ? "3rd-Party 3PL" : "Internal Fleet"}]`,
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
      onHandoffComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Handoff failed");
    } finally {
      setLoading(false);
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
    a.download = `depot-custody-handoff-${batchAttestationUID.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedBatch = batches.find((b) => b.batchAttestationUID === batchAttestationUID);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
        <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
          <Warehouse className="h-5 w-5 text-emerald-700" />
          <span>Manufacturer Unit: Central Depot & Distribution Hub</span>
        </div>
        <p className="mt-1 text-xs text-emerald-800">
          In the physical pharmaceutical supply chain, manufactured medicine is consolidated at the 
          manufacturer&apos;s primary <strong>Hub / Depot</strong>. From this depot, goods are audited, temperature-logged, 
          and handed off to 3rd-party distributors (e.g. DHL Health, Apex) or dispatched into internal distribution.
        </p>
      </div>

      <div>
        <h2 className="font-display text-2xl text-[var(--ink)]">Depot Intake &amp; Outbound Dispatch</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Record custody handoffs with gasless EIP-712 off-chain cryptographic signatures on Base Sepolia EAS.
        </p>
      </div>

      <form onSubmit={submitHandoff} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Select Batched Medicine at Depot</label>
          <select
            className="field"
            value={batchAttestationUID}
            onChange={(e) => setBatchAttestationUID(e.target.value)}
            required
          >
            {batches.length === 0 && (
              <option value="">No batches — issue or seed batches first</option>
            )}
            {batches.map((b) => (
              <option key={b.uid} value={b.batchAttestationUID}>
                {b.drugName} · Lot: {b.lotNumber} ({b.handoffCount ?? 0} existing handoffs)
              </option>
            ))}
          </select>
          {selectedBatch && (
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              EAS Attestation UID: <code className="break-all">{selectedBatch.batchAttestationUID}</code>
            </p>
          )}
        </div>

        <div>
          <label className="label">Outbound Channel</label>
          <select
            className="field"
            value={dispatchType}
            onChange={(e) => {
              const val = e.target.value as "external_distributor" | "internal_fleet";
              setDispatchType(val);
              if (val === "external_distributor") {
                setToFacility("Apex Logistics Regional Distribution Hub");
              } else {
                setToFacility("PharmaCorp Regional Transit Hub B");
              }
            }}
          >
            <option value="external_distributor">3rd-Party Commercial Distributor</option>
            <option value="internal_fleet">Internal Distribution Network</option>
          </select>
        </div>

        <div>
          <label className="label">Originating Depot Facility</label>
          <input
            className="field"
            value={fromFacility}
            onChange={(e) => setFromFacility(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Destination Facility / Consignee</label>
          <input
            className="field"
            value={toFacility}
            onChange={(e) => setToFacility(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Cold-Chain Temperature Spec (°C)</label>
          <input
            className="field"
            value={tempRangeC}
            onChange={(e) => setTempRangeC(e.target.value)}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary w-full sm:w-auto" disabled={loading || !batchAttestationUID}>
            <Truck className="h-4 w-4" />
            {loading ? "Attesting & Signing…" : "Dispatch & Sign Custody Handoff (EIP-712)"}
          </button>
        </div>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {proof && (
        <div className="space-y-3 rounded-md border border-emerald-300 bg-white p-4 shadow-sm">
          {proof.verified && (
            <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
              <BadgeCheck className="h-4 w-4" />
              Depot Handoff Attestation Signed &amp; Cryptographically Verified
            </div>
          )}
          <p className="text-xs text-[var(--ink-muted)]">
            EIP-712 Signer: <code>{proof.signer}</code>
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={downloadProof}>
              <Download className="h-4 w-4" />
              Download Signed Handoff JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
