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

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (res.ok) {
          setHealth((await res.json()) as HealthResponse);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

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
                  {health?.env.defaultServiceId ?? "Not set"}
                </dd>
                <p className="mt-1 text-xs text-slate-400">
                  Uses SICKW_DEFAULT_SERVICE_ID when a service isn&apos;t chosen by the user.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
                <dt className="text-xs uppercase tracking-wide text-slate-400">Timezone</dt>
                <dd className="mt-1 text-base font-semibold text-white">
                  {health?.env.timezone ?? "America/Chicago"}
                </dd>
                <p className="mt-1 text-xs text-slate-400">Applied to Sheets tab naming and timestamps.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
                <dt className="text-xs uppercase tracking-wide text-slate-400">SickW configured</dt>
                <dd className="mt-1 text-base font-semibold text-white">
                  {health?.env.sickwConfigured ? "Yes" : "No"}
                </dd>
                <p className="mt-1 text-xs text-slate-400">
                  Update SICKW_API_KEY (and default service) in the environment or tenant config.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
                <dt className="text-xs uppercase tracking-wide text-slate-400">Sheets configured</dt>
                <dd className="mt-1 text-base font-semibold text-white">
                  {health?.env.sheetsConfigured ? "Yes" : "No"}
                </dd>
                <p className="mt-1 text-xs text-slate-400">
                  Requires GOOGLE_SHEETS_ID and service account email/key with edit access.
                </p>
              </div>
            </dl>
            <p className="mt-4 text-xs text-slate-400">
              To update credentials, deploy with new env values (or future tenant-level settings once added).
            </p>
          </section>
        )}
      </main>
    </div>
  );
}


