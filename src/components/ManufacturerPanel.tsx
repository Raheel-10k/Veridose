"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FlaskConical, Copy, ShieldAlert, Nfc, PlusCircle, Check } from "lucide-react";
import {
  getWebNfcSupport,
  toAbsoluteVerifyUrl,
  writeBatchUrlToNfcTag,
} from "@/lib/web-nfc-client";

interface MedicineItem {
  id: string;
  name: string;
  description?: string;
  defaultDosage?: string;
  category?: string;
}

export function ManufacturerPanel({ onIssued }: { onIssued?: () => void }) {
  const [medicines, setMedicines] = useState<string[]>([]);
  const [drugName, setDrugName] = useState("");
  const [lotNumber, setLotNumber] = useState("LOT-2026-001");
  const [expiry, setExpiry] = useState("2027-06-30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New med modal / form states
  const [showAddMed, setShowAddMed] = useState(false);
  const [newMedName, setNewMedName] = useState("");
  const [newMedCategory, setNewMedCategory] = useState("Critical Care");
  const [newMedDosage, setNewMedDosage] = useState("");
  const [newMedDesc, setNewMedDesc] = useState("");
  const [medSuccessMsg, setMedSuccessMsg] = useState<string | null>(null);
  const [addingMed, setAddingMed] = useState(false);

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

  // Fetch medicines catalog
  async function loadMedicines() {
    try {
      const res = await fetch("/api/medicines");
      const data = await res.json();
      if (data.medicines && data.medicines.length > 0) {
        const names = data.medicines.map((m: MedicineItem) => m.name);
        setMedicines(names);
        setDrugName((current) => (names.includes(current) ? current : names[0]));
      } else {
        setMedicines([]);
        setDrugName("");
        setShowAddMed(true); // Open add med directly when org has no medicines yet
      }
    } catch {
      setMedicines([]);
      setDrugName("");
    }
  }

  useEffect(() => {
    loadMedicines();
  }, []);

  async function handleAddMedicine(e: React.FormEvent) {
    e.preventDefault();
    if (!newMedName.trim()) return;
    setAddingMed(true);
    setError(null);
    setMedSuccessMsg(null);
    try {
      const res = await fetch("/api/medicines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMedName.trim(),
          category: newMedCategory.trim(),
          defaultDosage: newMedDosage.trim(),
          description: newMedDesc.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add medicine");

      setMedicines((prev) => Array.from(new Set([...prev, data.medicine.name])));
      setDrugName(data.medicine.name);
      setMedSuccessMsg(`Added "${data.medicine.name}" to medicine catalog!`);
      setNewMedName("");
      setNewMedDosage("");
      setNewMedDesc("");
      setTimeout(() => setShowAddMed(false), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add medicine");
    } finally {
      setAddingMed(false);
    }
  }

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
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Select or Add Medicine</label>
            <button
              type="button"
              onClick={() => setShowAddMed(!showAddMed)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-strong)] hover:underline"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              {showAddMed ? "Cancel new medicine" : "+ Add custom medicine"}
            </button>
          </div>

          {showAddMed ? (
            <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50/70 p-3 space-y-3">
              <p className="text-xs font-medium text-emerald-900">
                Register a new medicine in your manufacturer catalog (replaces 3-med default seed limit):
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <input
                    className="field text-xs py-1.5"
                    placeholder="Medicine name (e.g. Paracetamol 650mg, Remdesivir)"
                    value={newMedName}
                    onChange={(e) => setNewMedName(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    className="field text-xs py-1.5"
                    placeholder="Category (e.g. Analgesic, Antiviral)"
                    value={newMedCategory}
                    onChange={(e) => setNewMedCategory(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    className="field text-xs py-1.5"
                    placeholder="Default Dosage & packaging spec"
                    value={newMedDosage}
                    onChange={(e) => setNewMedDosage(e.target.value)}
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleAddMedicine}
                    disabled={addingMed || !newMedName.trim()}
                    className="btn-primary w-full text-xs py-1.5"
                  >
                    {addingMed ? "Adding…" : "Save Medicine"}
                  </button>
                </div>
              </div>
              {medSuccessMsg && (
                <p className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <Check className="h-3.5 w-3.5" /> {medSuccessMsg}
                </p>
              )}
            </div>
          ) : null}

          {medicines.length > 0 ? (
            <select
              className="field"
              value={drugName}
              onChange={(e) => setDrugName(e.target.value)}
            >
              {medicines.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-3 text-center text-xs text-gray-500">
              No medicines registered in your organization yet. Use the <strong>&quot;+ Add custom medicine&quot;</strong> button above to specify your organization&apos;s product name, dosage, and category.
            </div>
          )}
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
          <button type="submit" className="btn-primary" disabled={loading || !drugName}>
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
