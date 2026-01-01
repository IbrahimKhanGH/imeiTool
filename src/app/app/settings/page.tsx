"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type HealthStatus = "ok" | "not_configured" | "degraded" | "error";
type HealthResponse = {
  sickw: { status: HealthStatus; message?: string; balance?: number | null; defaultServiceId?: string };
  sheets: { status: HealthStatus; message?: string; tab?: string };
  env: { sickwConfigured: boolean; sheetsConfigured: boolean; defaultServiceId: string | null; timezone: string };
  serverTime: string;
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role ?? "operator";
  const isAdmin = role === "admin";
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [credsReady, setCredsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [sickwKey, setSickwKey] = useState("");
  const [googleSheetsId, setGoogleSheetsId] = useState("");
  const [googleServiceAccountEmail, setGoogleServiceAccountEmail] = useState("");
  const [googleServiceAccountPrivateKey, setGoogleServiceAccountPrivateKey] = useState("");
  const [defaultTab, setDefaultTab] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [syncToSheets, setSyncToSheets] = useState(true);
  const [autoMonthlySheets, setAutoMonthlySheets] = useState(false);
  const [monthlySheetPrefix, setMonthlySheetPrefix] = useState("");
  const [currentSheetMonth, setCurrentSheetMonth] = useState<string | null>(null);
  const [autoShareEmails, setAutoShareEmails] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setCredsReady(false);
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (res.ok) {
          setHealth((await res.json()) as HealthResponse);
        }
        if (isAdmin) {
          const credRes = await fetch("/api/credentials", { cache: "no-store" });
          if (credRes.ok) {
            const data = await credRes.json();
            setSickwKey(data.sickwKey ?? "");
            setGoogleSheetsId(data.googleSheetsId ?? "");
            setGoogleServiceAccountEmail(data.googleServiceAccountEmail ?? "");
            setGoogleServiceAccountPrivateKey(data.googleServiceAccountPrivateKey ?? "");
            setDefaultTab(data.defaultTab ?? "");
            setTimezone(data.timezone ?? "America/Chicago");
            setSyncToSheets(data.syncToSheets ?? true);
            setAutoMonthlySheets(data.autoMonthlySheets ?? false);
            setMonthlySheetPrefix(data.monthlySheetPrefix ?? "");
            setCurrentSheetMonth(data.currentSheetMonth ?? null);
            setAutoShareEmails(
              Array.isArray(data.autoShareEmails)
                ? data.autoShareEmails.join(", ")
                : "",
            );
            setCredsReady(true);
          }
        } else {
          setCredsReady(true);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [isAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sickwKey,
          googleSheetsId,
          googleServiceAccountEmail,
          googleServiceAccountPrivateKey,
          defaultTab,
          timezone,
          syncToSheets,
          autoMonthlySheets,
          monthlySheetPrefix,
          autoShareEmails: autoShareEmails
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
      setSaveMessage("Saved");
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 2000);
    }
  };

  const statusPill = (label: string, status?: HealthStatus, detail?: string) => {
    const cls =
      status === "ok"
        ? "bg-emerald-500/15 text-emerald-100 border border-emerald-500/30"
        : status === "degraded"
          ? "bg-amber-500/15 text-amber-100 border border-amber-500/30"
          : status === "error"
            ? "bg-rose-500/15 text-rose-100 border border-rose-500/30"
            : "bg-white/10 text-slate-200 border border-white/10";
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
        {label}: {status ?? "checking"}
        {detail ? ` · ${detail}` : ""}
      </span>
    );
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-fuchsia-500/25 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-80 w-80 rounded-full bg-indigo-500/20 blur-[120px]" />
      </div>
      <main className="relative mx-auto flex max-w-5xl flex-col gap-8 px-6 py-14 md:px-10 md:py-18">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-200/80">
              Settings
            </p>
            <h1 className="text-3xl font-semibold text-white">Tenant configuration</h1>
            <p className="text-sm text-slate-300">
              Status for SickW and Sheets, plus defaults. Admins can update credentials via env/tenant config.
            </p>
          </div>
          <Link
            href="/app"
            className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:border-white/40 hover:bg-white/10"
          >
            ← Back to app
          </Link>
        </header>

        {!isAdmin ? (
          <section className="rounded-3xl border border-white/10 bg-rose-500/10 p-6 text-rose-50 shadow-2xl shadow-rose-500/10 backdrop-blur">
            <h2 className="text-xl font-semibold">Admins only</h2>
            <p className="mt-2 text-sm text-rose-100">
              You are signed in as <span className="font-semibold">{session?.user?.email ?? "user"}</span> ({role}).
              Ask an admin to adjust credentials or defaults.
            </p>
          </section>
        ) : (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-fuchsia-500/10 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {statusPill("SickW", health?.sickw.status, health?.sickw.message)}
              {statusPill("Sheets", health?.sheets.status, health?.sheets.message)}
              {loading && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  Checking…
                </span>
              )}
            </div>

            <dl className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
                <dt className="text-xs uppercase tracking-wide text-slate-400">Default service</dt>
                <dd className="mt-1 text-base font-semibold text-white">
                  {loading ? "…" : health?.env.defaultServiceId ?? "Not set"}
                </dd>
                <p className="mt-1 text-xs text-slate-400">
                  Uses SICKW_DEFAULT_SERVICE_ID when a service isn&apos;t chosen by the user.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
                <dt className="text-xs uppercase tracking-wide text-slate-400">Timezone</dt>
                <dd className="mt-1 text-base font-semibold text-white">
                  {loading ? "…" : health?.env.timezone ?? "America/Chicago"}
                </dd>
                <p className="mt-1 text-xs text-slate-400">Applied to Sheets tab naming and timestamps.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
                <dt className="text-xs uppercase tracking-wide text-slate-400">SickW configured</dt>
                <dd className="mt-1 text-base font-semibold text-white">
                  {loading ? "…" : health?.env.sickwConfigured ? "Yes" : "No"}
                </dd>
                <p className="mt-1 text-xs text-slate-400">
                  Update SICKW_API_KEY (and default service) in the environment or tenant config.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
                <dt className="text-xs uppercase tracking-wide text-slate-400">Sheets configured</dt>
                <dd className="mt-1 text-base font-semibold text-white">
                  {loading ? "…" : health?.env.sheetsConfigured ? "Yes" : "No"}
                </dd>
                <p className="mt-1 text-xs text-slate-400">
                  Requires GOOGLE_SHEETS_ID and service account email/key with edit access.
                </p>
              </div>
            </dl>
            <form onSubmit={handleSave} className="mt-6 grid gap-4">
              {!credsReady ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="h-48 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
                  <div className="h-72 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
                    <h3 className="text-lg font-semibold text-white">SickW</h3>
                    <label className="mt-3 block text-xs uppercase tracking-wide text-slate-400">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={sickwKey}
                      onChange={(e) => setSickwKey(e.target.value)}
                      placeholder="SICKW_API_KEY"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">Google Sheets</h3>
                      <label className="flex items-center gap-2 text-xs text-slate-200">
                        <input
                          type="checkbox"
                          checked={syncToSheets}
                          onChange={(e) => setSyncToSheets(e.target.checked)}
                          className="h-4 w-4 rounded border-white/30 bg-white/10 text-indigo-500 focus:ring-indigo-500/60"
                        />
                        Sync to Sheets
                      </label>
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={autoMonthlySheets}
                          onChange={(e) => setAutoMonthlySheets(e.target.checked)}
                          className="h-4 w-4 rounded border-white/30 bg-white/10 text-indigo-500 focus:ring-indigo-500/60"
                        />
                        <span className="uppercase tracking-wide">Auto-create monthly sheets</span>
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {currentSheetMonth ? `Current: ${currentSheetMonth}` : "No monthly sheet yet"}
                      </span>
                    </div>
                    <label className="mt-3 block text-xs uppercase tracking-wide text-slate-400">
                      Monthly sheet prefix
                    </label>
                    <input
                      value={monthlySheetPrefix}
                      onChange={(e) => setMonthlySheetPrefix(e.target.value)}
                      placeholder="e.g. ClientA Lookups"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      disabled={!autoMonthlySheets}
                    />
                    <label className="mt-3 block text-xs uppercase tracking-wide text-slate-400">
                      Auto-share emails (comma separated)
                    </label>
                    <input
                      value={autoShareEmails}
                      onChange={(e) => setAutoShareEmails(e.target.value)}
                      placeholder="ops@example.com, qc@example.com"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      disabled={!autoMonthlySheets}
                    />
                    <label className="mt-3 block text-xs uppercase tracking-wide text-slate-400">
                      Sheet ID
                    </label>
                    <input
                      value={googleSheetsId}
                      onChange={(e) => setGoogleSheetsId(e.target.value)}
                      placeholder="Spreadsheet ID"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <label className="mt-3 block text-xs uppercase tracking-wide text-slate-400">
                      Service Account Email
                    </label>
                    <input
                      value={googleServiceAccountEmail}
                      onChange={(e) => setGoogleServiceAccountEmail(e.target.value)}
                      placeholder="service-account@project.iam.gserviceaccount.com"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <label className="mt-3 block text-xs uppercase tracking-wide text-slate-400">
                      Service Account Private Key
                    </label>
                    <textarea
                      value={googleServiceAccountPrivateKey}
                      onChange={(e) => setGoogleServiceAccountPrivateKey(e.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <label className="mt-3 block text-xs uppercase tracking-wide text-slate-400">
                      Default tab (optional)
                    </label>
                    <input
                      value={defaultTab}
                      onChange={(e) => setDefaultTab(e.target.value)}
                      placeholder="e.g. DECEMBER 23"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <label className="mt-3 block text-xs uppercase tracking-wide text-slate-400">
                      Timezone
                    </label>
                    <input
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="America/Chicago"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save settings"}
                </button>
                {saveMessage && (
                  <span className="text-xs text-slate-200">{saveMessage}</span>
                )}
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}



