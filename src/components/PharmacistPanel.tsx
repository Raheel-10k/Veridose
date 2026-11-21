"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Flag, Siren } from "lucide-react";

interface BatchOption {
  uid: string;
  batchAttestationUID: string;
  drugName: string;
  lotNumber: string;
}

interface RoleInfo {
  role: string;
  address: string;
  licenseId: string;
  atpAttestationUID: string | null;
  explorerUrl: string | null;
}

export function PharmacistPanel({
  batchesVersion = 0,
}: {
  batchesVersion?: number;
}) {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchAttestationUID, setBatchAttestationUID] = useState("");
  const [evidenceNote, setEvidenceNote] = useState(
    "Patient adverse reaction cluster — suspected substandard lot"
  );
  const [pharmacist, setPharmacist] = useState<RoleInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    explorerUrl: string;
    statusLabel: string;
    flagAttestationUID: string;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/batches").then((r) => r.json()),
      fetch("/api/roles").then((r) => r.json()),
    ]).then(([batchData, roleData]) => {
      const list = (batchData.batches ?? []) as BatchOption[];
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
      const pharm = (roleData.roles ?? []).find(
        (r: RoleInfo) => r.role === "Pharmacist"
      );
      setPharmacist(pharm ?? null);
    });
  }, [batchesVersion]);

  async function flag(status: 1 | 2) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/batches/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchAttestationUID,
          status,
          evidenceNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Flag failed");
      setResult({
        explorerUrl: data.explorerUrl,
        statusLabel: data.statusLabel,
        flagAttestationUID: data.flagAttestationUID,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Flag failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">Pharmacist Surveillance</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Flag substandard or adverse batches. Relayer submits the EAS update on
          Base Sepolia — no MetaMask required.
        </p>
      </div>

      {pharmacist && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
          <p className="font-semibold text-emerald-900">
            ATP Credential · {pharmacist.licenseId}
          </p>
          <p className="mt-1 break-all text-xs text-emerald-800">
            {pharmacist.address}
          </p>
          {pharmacist.explorerUrl && (
            <a
              href={pharmacist.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-semibold text-emerald-900"
            >
              View ATP on EASScan <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      <div className="grid gap-4">
        <div>
          <label className="label">Batch</label>
          <select
            className="field"
            value={batchAttestationUID}
            onChange={(e) => setBatchAttestationUID(e.target.value)}
          >
            {batches.length === 0 && (
              <option value="">No batches available</option>
            )}
            {batches.map((b) => (
              <option key={b.uid} value={b.batchAttestationUID}>
                {b.drugName} · {b.lotNumber}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Evidence note</label>
          <textarea
            className="field min-h-[88px]"
            value={evidenceNote}
            onChange={(e) => setEvidenceNote(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={loading || !batchAttestationUID}
            onClick={() => flag(1)}
          >
            <Flag className="h-4 w-4" />
            Flag Substandard / Adverse Batch
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={loading || !batchAttestationUID}
            onClick={() => flag(2)}
          >
            <Siren className="h-4 w-4" />
            Recall Batch
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-md border border-[var(--line)] bg-white p-4 text-sm">
          <p className="font-semibold">{result.statusLabel}</p>
          <p className="mt-1 break-all text-xs">
            {result.flagAttestationUID}
          </p>
          <a
            href={result.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-semibold text-[var(--accent-strong)]"
          >
            Open on EASScan <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
