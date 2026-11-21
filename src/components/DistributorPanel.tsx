"use client";

import { useEffect, useState } from "react";
import { Download, BadgeCheck } from "lucide-react";

interface BatchOption {
  uid: string;
  batchAttestationUID: string;
  drugName: string;
  lotNumber: string;
}

export function DistributorPanel({
  batchesVersion = 0,
}: {
  batchesVersion?: number;
}) {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchAttestationUID, setBatchAttestationUID] = useState("");
  const [fromFacility, setFromFacility] = useState("ColdHub Lagos");
  const [toFacility, setToFacility] = useState("City Pharmacy Accra");
  const [tempRangeC, setTempRangeC] = useState("2-8");
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
        const stillValid = list.some(
          (b) => b.batchAttestationUID === current
        );
        return stillValid && current
          ? current
          : list[0]!.batchAttestationUID;
      });
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [batchesVersion]);

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">Distributor Custody Handoff</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Sign a zero-gas EIP-712 off-chain cold-chain attestation. Route details
          stay off the public ledger.
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Anchored batch</label>
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
                {b.drugName} · {b.lotNumber}
              </option>
            ))}
          </select>
        </div>
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
            {loading ? "Signing…" : "Sign Off-Chain Custody Attestation"}
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
