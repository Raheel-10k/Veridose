"use client";

import { useState } from "react";
import { LogIn, UserPlus, LogOut, ShieldCheck, Building2, MapPin } from "lucide-react";
import type { UserRecord, UserRole } from "@/lib/types";

export function AuthBar({
  user,
  onUserChanged,
}: {
  user: UserRecord | null;
  onUserChanged: (user: UserRecord | null) => void;
}) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("Manufacturer");
  const [orgName, setOrgName] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      onUserChanged(data.user);
      setShowAuthModal(false);
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          role,
          orgName,
          facilityName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      onUserChanged(data.user);
      setShowAuthModal(false);
      setEmail("");
      setPassword("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      onUserChanged(null);
    } catch {
      onUserChanged(null);
    }
  }

  function quickFill(presetEmail: string, presetRole: UserRole) {
    setEmail(presetEmail);
    setPassword("password123");
    setRole(presetRole);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
      {user ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-white">
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 ring-1 ring-emerald-400/40">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <span className="font-semibold text-emerald-100">{user.name}</span>
            <span className="rounded bg-emerald-400/20 px-1.5 py-0.5 text-xs font-mono uppercase tracking-wider text-emerald-200">
              {user.role}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-emerald-100/70">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {user.orgName}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {user.facilityName}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90 hover:bg-white/20 transition"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-emerald-100/80">
            RBAC Authentication (Simple Email &amp; Password):
          </span>
          <button
            type="button"
            onClick={() => {
              setAuthMode("login");
              setShowAuthModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 hover:bg-white/15 transition"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("signup");
              setShowAuthModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Create Account
          </button>
        </div>
      )}

      {/* Modal for Login / Signup */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-[var(--ink)]">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-display text-xl">
                {authMode === "login" ? "Sign in to VeriDose" : "Create New VeriDose Account"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            {authMode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    className="field"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@pharma.com"
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    className="field"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600 space-y-1">
                  <p className="font-semibold text-gray-800">Quick-fill Demo Credentials (Password: password123):</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => quickFill("manufacturer@pharma.com", "Manufacturer")}
                      className="rounded bg-white px-2 py-1 border hover:bg-gray-100 text-[11px]"
                    >
                      Manufacturer
                    </button>
                    <button
                      type="button"
                      onClick={() => quickFill("depot@pharma.com", "Depot")}
                      className="rounded bg-emerald-100 text-emerald-900 px-2 py-1 border border-emerald-300 font-semibold text-[11px]"
                    >
                      Depot Manager
                    </button>
                    <button
                      type="button"
                      onClick={() => quickFill("distributor@logistics.com", "Distributor")}
                      className="rounded bg-white px-2 py-1 border hover:bg-gray-100 text-[11px]"
                    >
                      Distributor
                    </button>
                    <button
                      type="button"
                      onClick={() => quickFill("pharmacist@clinic.com", "Pharmacist")}
                      className="rounded bg-white px-2 py-1 border hover:bg-gray-100 text-[11px]"
                    >
                      Pharmacist
                    </button>
                    <button
                      type="button"
                      onClick={() => quickFill("regulator@health.gov", "Inspector")}
                      className="rounded bg-indigo-100 text-indigo-900 px-2 py-1 border border-indigo-300 font-semibold text-[11px]"
                    >
                      Inspector
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</p>
                )}

                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? "Authenticating…" : "Sign In"}
                </button>

                <p className="text-center text-xs text-gray-500">
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setAuthMode("signup");
                    }}
                    className="font-semibold text-emerald-700 hover:underline"
                  >
                    Sign up here
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-3">
                <div>
                  <label className="label">Full Name</label>
                  <input
                    className="field text-sm"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Elena Rostova"
                  />
                </div>
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    className="field text-sm"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="elena@pharma.com"
                  />
                </div>
                <div>
                  <label className="label">Password (min 6 characters)</label>
                  <input
                    type="password"
                    className="field text-sm"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Supply-Chain Role</label>
                    <select
                      className="field text-sm"
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                    >
                      <option value="Manufacturer">Manufacturer (Plant)</option>
                      <option value="Depot">Depot Manager (Hub)</option>
                      <option value="Distributor">3rd-Party Distributor</option>
                      <option value="Pharmacist">Pharmacist</option>
                      <option value="Regulator">Health Regulator</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Organization</label>
                    <input
                      className="field text-sm"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder={role === "Depot" ? "PharmaCorp Global" : "Org Name"}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Facility / Unit Name</label>
                  <input
                    className="field text-sm"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    placeholder={
                      role === "Depot"
                        ? "PharmaCorp Central Hub / Depot 1"
                        : "Main Production Line A"
                    }
                  />
                </div>

                {error && (
                  <p className="rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</p>
                )}

                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? "Creating Account…" : "Create Account & Sign In"}
                </button>

                <p className="text-center text-xs text-gray-500">
                  Already registered?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setAuthMode("login");
                    }}
                    className="font-semibold text-emerald-700 hover:underline"
                  >
                    Sign in here
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
