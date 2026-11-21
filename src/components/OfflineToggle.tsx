"use client";

export function OfflineToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-white px-3 py-2.5">
      <div>
        <p className="text-sm font-semibold text-[var(--ink)]">
          Offline Clinic Mode
        </p>
        <p className="text-xs text-[var(--ink-muted)]">
          Simulate network loss and verify from localStorage cache only
        </p>
      </div>
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--accent)]"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
