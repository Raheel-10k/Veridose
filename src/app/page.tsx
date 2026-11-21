"use client";

import { useState } from "react";
import Link from "next/link";
import { RoleSwitcher, type UiRole } from "@/components/RoleSwitcher";
import { ManufacturerPanel } from "@/components/ManufacturerPanel";
import { DistributorPanel } from "@/components/DistributorPanel";
import { PharmacistPanel } from "@/components/PharmacistPanel";
import { DemoSeedButton } from "@/components/DemoSeedButton";
import { PatientScannerPanel } from "@/components/PatientScannerPanel";
import { Shield } from "lucide-react";

export default function HomePage() {
  const [role, setRole] = useState<UiRole>("Manufacturer");
  // Bumps list refresh for Distributor/Pharmacist without remounting Manufacturer.
  const [batchesVersion, setBatchesVersion] = useState(0);

  function bumpBatches() {
    setBatchesVersion((v) => v + 1);
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100/80">
              Base Sepolia · EAS
            </p>
            <h1 className="font-display mt-2 text-4xl text-white sm:text-5xl">
              VeriDose
            </h1>
            <p className="mt-2 max-w-xl text-sm text-emerald-50/85">
              Pharmaceutical anti-counterfeit prototype — rolling NFC SUN
              cryptography + Ethereum Attestation Service anchors.
            </p>
          </div>
          <Link
            href="/verify"
            className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/15"
          >
            <Shield className="h-4 w-4" />
            Open verifier
          </Link>
        </div>

        <div className="panel rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="label mb-2">Active role</p>
              <RoleSwitcher value={role} onChange={setRole} />
            </div>
            <DemoSeedButton onSeeded={bumpBatches} />
          </div>
        </div>
      </header>

      <section className="panel rounded-2xl p-5 sm:p-7">
        {role === "Manufacturer" && (
          <ManufacturerPanel onIssued={bumpBatches} />
        )}
        {role === "Distributor" && (
          <DistributorPanel batchesVersion={batchesVersion} />
        )}
        {role === "Pharmacist" && (
          <PharmacistPanel batchesVersion={batchesVersion} />
        )}
        {role === "Patient" && <PatientScannerPanel />}
      </section>
    </main>
  );
}
