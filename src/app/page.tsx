"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";

export default function LandingPage() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      window.location.href = "/app";
    }
  }, [status]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-fuchsia-500/25 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-80 w-80 rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="absolute left-[-20%] top-1/3 h-72 w-72 rounded-full bg-cyan-400/10 blur-[120px]" />
      </div>
      <main className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 py-14 md:px-10 md:py-20">
        <header className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-5 text-center md:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-fuchsia-200/80">
              imeiTool
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
              Secure, fast IMEI intake for operators and resellers
            </h1>
            <p className="text-base text-slate-300 md:w-5/6">
              Scan back-to-back with auto-queue, run instant SickW checks, cache locally, and mirror
              into Sheets—without exposing provider keys.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-start">
              <Link
                href="/login"
                className="rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition hover:brightness-110"
              >
                Log in
              </Link>
              <span className="text-xs uppercase tracking-wide text-slate-400">
                Auth required · Keys stay server-side
              </span>
            </div>
          </div>
          <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-fuchsia-500/10 backdrop-blur">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-indigo-500/10" />
            <div className="relative grid gap-4 text-sm text-slate-200">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/30">
                <p className="text-xs uppercase tracking-wide text-slate-400">Modes</p>
                <p className="mt-1 font-semibold text-white">Queue + Batch</p>
                <p className="text-xs text-slate-300">
                  Scan-and-go queue for operators, plus 50-line batch runs with cache-aware lookups.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/30">
                <p className="text-xs uppercase tracking-wide text-slate-400">Data flow</p>
                <p className="mt-1 font-semibold text-white">SickW → Cache → Sheets</p>
                <p className="text-xs text-slate-300">
                  Caches successful lookups, still appends to Sheets on cache hits.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/30">
                <p className="text-xs uppercase tracking-wide text-slate-400">Security</p>
                <p className="mt-1 font-semibold text-white">Server-side keys</p>
                <p className="text-xs text-slate-300">
                  Auth-gated access. Provider keys never reach the browser.
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Secure by design",
              body: "API keys stay server-side. Auth gate prevents unauthorized scans.",
            },
            {
              title: "Blazing intake",
              body: "Auto-queue scans, batch up to 50, cache for instant replays.",
            },
            {
              title: "Ops-ready logs",
              body: "Append to Sheets even on cache hits; keep local history with service, price, balance.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/20"
            >
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-2 text-sm text-slate-300">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 rounded-3xl border border-white/10 bg-black/30 p-6 shadow-2xl shadow-indigo-500/10 md:grid-cols-3">
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/80">
              Workflow
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              Optimized for scanners and fast operators
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>• Auto-submit IMEIs on Luhn-valid scans; serial mode for Wi‑Fi devices.</li>
              <li>• Queue lets you keep scanning; background lookups show per-item status.</li>
              <li>• Batch paste up to 50 with grade/cost tagging; cache hits still sync to Sheets.</li>
              <li>• Recent lookups with service, price, balance, status.</li>
            </ul>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 shadow-inner shadow-black/20">
            <p className="text-xs uppercase tracking-wide text-slate-400">Get access</p>
            <p>Use your issued credentials to log in. Need access? Contact the admin.</p>
            <Link
              href="/login"
              className="mt-2 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition hover:brightness-110"
            >
              Log in
            </Link>
        </div>
        </section>
      </main>
    </div>
  );
}


