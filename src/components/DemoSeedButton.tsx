"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

export function DemoSeedButton({ onSeeded }: { onSeeded?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadDemo() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Seed failed");
      setMessage(data.message ?? "Demo loaded");
      onSeeded?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-ghost"
        disabled={loading}
        onClick={loadDemo}
      >
        <Sparkles className="h-4 w-4" />
        {loading ? "Loading demo…" : "Load Pre-Seeded Demo Scenario"}
      </button>
      {message && (
        <p className="text-xs text-[var(--ink-muted)] max-w-xl">{message}</p>
      )}
    </div>
  );
}
