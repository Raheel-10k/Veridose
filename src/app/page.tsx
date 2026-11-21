"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RoleSwitcher, type UiRole } from "@/components/RoleSwitcher";
import { ManufacturerPanel } from "@/components/ManufacturerPanel";
import { DepotPanel } from "@/components/DepotPanel";
import { DistributorPanel } from "@/components/DistributorPanel";
import { PharmacistPanel } from "@/components/PharmacistPanel";
import { DemoSeedButton } from "@/components/DemoSeedButton";
import { PatientScannerPanel } from "@/components/PatientScannerPanel";
import { AuthBar } from "@/components/AuthBar";
import { Shield } from "lucide-react";
import type { UserRecord } from "@/lib/types";

export default function HomePage() {
  const [role, setRole] = useState<UiRole>("Manufacturer");
  const [user, setUser] = useState<UserRecord | null>(null);
  const [batchesVersion, setBatchesVersion] = useState(0);

  function bumpBatches() {
    setBatchesVersion((v) => v + 1);
  }

  // Load session on startup
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.user) {
          setUser(data.user);
          if (data.user.role === "Depot") {
            setRole("Depot");
          } else if (data.user.role === "Manufacturer") {
            setRole("Manufacturer");
          } else if (data.user.role === "Distributor") {
            setRole("Distributor");
          } else if (data.user.role === "Pharmacist") {
            setRole("Pharmacist");
          }
        }
      })
      .catch(() => undefined);
  }, []);

  function handleUserChange(newUser: UserRecord | null) {
    setUser(newUser);
    if (newUser) {
      if (newUser.role === "Depot") setRole("Depot");
      else if (newUser.role === "Manufacturer") setRole("Manufacturer");
      else if (newUser.role === "Distributor") setRole("Distributor");
      else if (newUser.role === "Pharmacist") setRole("Pharmacist");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8 space-y-5">
        <AuthBar user={user} onUserChanged={handleUserChange} />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100/80">
              Base Sepolia · EAS · Role-Based Access Control
            </p>
            <h1 className="font-display mt-2 text-4xl text-white sm:text-5xl">
              VeriDose
            </h1>
            <p className="mt-2 max-w-xl text-sm text-emerald-50/85">
              Pharmaceutical anti-counterfeit prototype — rolling NFC SUN
              cryptography + Ethereum Attestation Service anchors &amp; Depot Hub management.
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
              <div className="flex items-center gap-2 mb-2">
                <p className="label mb-0">Active Workspace</p>
                {user && (
                  <span className="text-xs text-[var(--ink-muted)]">
                    (Signed in: <strong>{user.name}</strong> · Role: <strong>{user.role}</strong> · Org: <strong>{user.orgName}</strong>)
                  </span>
                )}
              </div>
              <RoleSwitcher value={role} onChange={setRole} userRole={user?.role} />
            </div>
            {!user && <DemoSeedButton onSeeded={bumpBatches} />}
          </div>
        </div>
      </header>

      <section className="panel rounded-2xl p-5 sm:p-7">
        {role === "Manufacturer" && (
          <ManufacturerPanel onIssued={bumpBatches} />
        )}
        {role === "Depot" && (
          <DepotPanel
            batchesVersion={batchesVersion}
            userFacility={user?.role === "Depot" ? user.facilityName : undefined}
            onHandoffComplete={bumpBatches}
          />
        )}
        {role === "Distributor" && (
          <DistributorPanel batchesVersion={batchesVersion} />
        )}
        {role === "Pharmacist" && (
          <PharmacistPanel batchesVersion={batchesVersion} />
        )}
        {role === "Patient" && <PatientScannerPanel user={user} />}
      </section>
    </main>
  );
}
