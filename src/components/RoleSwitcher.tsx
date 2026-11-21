"use client";

import type { UserRole } from "@/lib/types";

export type UiRole =
  | "Manufacturer"
  | "Depot"
  | "Distributor"
  | "Pharmacist"
  | "Patient";

const ALL_ROLES: { role: UiRole; label: string; sub?: string }[] = [
  { role: "Manufacturer", label: "Manufacturer (Plant)" },
  { role: "Depot", label: "Depot / Hub Manager" },
  { role: "Distributor", label: "Distributor (3PL)" },
  { role: "Pharmacist", label: "Pharmacist" },
  { role: "Patient", label: "Inspector / Scanner" },
];

export function RoleSwitcher({
  value,
  onChange,
  userRole,
}: {
  value: UiRole;
  onChange: (role: UiRole) => void;
  userRole?: UserRole | null;
}) {
  // STRICT RBAC FILTERING:
  // - If user is signed in as Manufacturer: ONLY show Manufacturer (Plant), Depot / Hub Manager, and Inspector / Scanner.
  //   (User cannot see or access Distributor or Pharmacist workspaces).
  // - If user is signed in as Depot: ONLY show Depot / Hub Manager and Inspector / Scanner.
  // - If user is signed in as Distributor: ONLY show Distributor (3PL) and Inspector / Scanner.
  // - If user is signed in as Pharmacist: ONLY show Pharmacist and Inspector / Scanner.
  // - Inspector / Scanner is universal and visible to all roles as requested ("as of the scanner, it can be used by anyone to flag/check prod details").
  // - If not signed in (guest / demo mode) or Regulator: show all.
  const visibleRoles = ALL_ROLES.filter(({ role }) => {
    if (!userRole || userRole === "Regulator") return true;
    if (role === "Patient") return true; // Scanner is always available for all roles

    if (userRole === "Manufacturer") {
      return role === "Manufacturer" || role === "Depot";
    }
    if (userRole === "Depot") {
      return role === "Depot";
    }
    if (userRole === "Distributor") {
      return role === "Distributor";
    }
    if (userRole === "Pharmacist") {
      return role === "Pharmacist";
    }
    return false;
  });

  return (
    <div className="flex flex-wrap gap-2">
      {visibleRoles.map(({ role, label }) => {
        const active = role === value;
        const isDepot = role === "Depot";
        return (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              active
                ? isDepot
                  ? "bg-emerald-700 text-white ring-2 ring-emerald-300 shadow-sm"
                  : "bg-[var(--accent)] text-white shadow-sm"
                : "bg-white/80 text-[var(--ink)] border border-[var(--line)] hover:bg-white"
            }`}
          >
            {label}
            {isDepot && (
              <span className="ml-1.5 rounded bg-emerald-800/80 px-1 py-0.5 text-[10px] font-mono uppercase text-emerald-100">
                Hub
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
