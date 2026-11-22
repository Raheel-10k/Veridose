"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  FlaskConical,
  Copy,
  ShieldAlert,
  Nfc,
  PlusCircle,
  Check,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import { toAbsoluteVerifyUrl } from "@/lib/web-nfc-client";

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
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [mintedVerifyUrl, setMintedVerifyUrl] = useState<string | null>(null);
  const [mintingUrl, setMintingUrl] = useState(false);
  const [lastCounter, setLastCounter] = useState<number | null>(null);

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
      const origin =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const fullUrl = toAbsoluteVerifyUrl(String(data.simulateTapUrl), origin);
      setMintedVerifyUrl(fullUrl);
      setLastCounter(data.tag?.lastCounter ?? 0);
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

  async function mintBatchVerifyUrl() {
    if (!result) return;
    setMintingUrl(true);
    setError(null);
    try {
      const res = await fetch("/api/nfc/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "next", uid: result.tag.uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate NFC URL");

      const origin =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
        window.location.origin;
      const absolute = toAbsoluteVerifyUrl(String(data.url), origin);
      setMintedVerifyUrl(absolute);
      setLastCounter(data.counter);

      // Auto-copy to clipboard for convenience
      try {
        await navigator.clipboard.writeText(absolute);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2500);
      } catch {
        // clipboard might require user gesture in some contexts
      }

      setSimMessage(`NFC URL generated (Counter #${data.counter}) & copied to clipboard!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate NFC URL");
    } finally {
      setMintingUrl(false);
    }
  }

  async function copyVerifyUrl(urlToCopy: string) {
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // fallback
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
          {/* NFC Link Output & Action Area */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              className="btn-primary"
              disabled={mintingUrl}
              onClick={mintBatchVerifyUrl}
            >
              <Nfc className="h-4 w-4" />
              {mintingUrl ? "Minting NFC link…" : "Write batch URL on NFC tag (Get Link)"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => simulate("next")}
            >
              <ExternalLink className="h-4 w-4" />
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

          {/* Minted NFC URL Display Card */}
          {mintedVerifyUrl && (
            <div className="rounded-lg border-2 border-emerald-600/30 bg-emerald-50/60 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-emerald-800" />
                  <span className="font-semibold text-emerald-950 text-sm">
                    Minted NFC Tag Link (Virtual Tag)
                  </span>
                  {lastCounter != null && (
                    <span className="rounded bg-emerald-200/80 px-2 py-0.5 text-[11px] font-mono font-semibold text-emerald-900">
                      Counter #{lastCounter}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={mintBatchVerifyUrl}
                  disabled={mintingUrl}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline inline-flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  {mintingUrl ? "Minting new URL…" : "Mint Next Fresh NFC URL"}
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={mintedVerifyUrl}
                    className="w-full text-xs font-mono bg-white border border-emerald-300 rounded px-3 py-2.5 text-gray-800 select-all focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => copyVerifyUrl(mintedVerifyUrl)}
                    className="btn-primary shrink-0 py-2.5 px-4 text-xs inline-flex items-center gap-1.5 shadow-sm font-semibold"
                    title="Copy NFC URL"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="h-4 w-4 text-white" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                  ✓ <strong>Virtual NFC Testing:</strong> Copy this link to write onto your virtual NFC tool/tag emulator, paste it into our <em>Patient / Scanner</em> tab manual input, or test directly in your scanner!
                </p>
              </div>
            </div>
          )}

          {simMessage && (
            <p className="break-all text-xs font-medium text-emerald-800 bg-emerald-50 px-3 py-2 rounded border border-emerald-200">
              {simMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
