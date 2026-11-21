"use client";

export type UiRole =
  | "Manufacturer"
  | "Distributor"
  | "Pharmacist"
  | "Patient";

const ROLES: UiRole[] = [
  "Manufacturer",
  "Distributor",
  "Pharmacist",
  "Patient",
];

export function RoleSwitcher({
  value,
  onChange,
}: {
  value: UiRole;
  onChange: (role: UiRole) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ROLES.map((role) => {
        const active = role === value;
        return (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              active
                ? "bg-[var(--accent)] text-white"
                : "bg-white/80 text-[var(--ink)] border border-[var(--line)] hover:bg-white"
            }`}
          >
            {role === "Patient" ? "Patient / Scanner" : role}
          </button>
        );
      })}
    </div>
  );
}
