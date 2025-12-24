"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const email = session?.user?.email ?? "—";
  const role = (session?.user as any)?.role ?? "—";
  const tenantId = (session?.user as any)?.tenantId ?? "—";
  const userId = (session?.user as any)?.id ?? "—";

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-fuchsia-500/25 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-80 w-80 rounded-full bg-indigo-500/20 blur-[120px]" />
      </div>
      <main className="relative mx-auto flex max-w-4xl flex-col gap-8 px-6 py-14 md:px-10 md:py-18">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-200/80">
              Profile
            </p>
            <h1 className="text-3xl font-semibold text-white">Account overview</h1>
            <p className="text-sm text-slate-300">
              View your account metadata and role. Contact an admin to change access.
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link
              href="/app"
              className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 font-semibold text-white hover:border-white/40 hover:bg-white/10"
            >
              ← Back to app
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-xl border border-white/30 bg-white/5 px-3 py-2 font-semibold text-white hover:border-white/50 hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-fuchsia-500/10 backdrop-blur">
          <dl className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
              <dt className="text-xs uppercase tracking-wide text-slate-400">Status</dt>
              <dd className="mt-1 text-base font-semibold text-white">
                {loading ? "Loading…" : "Signed in"}
              </dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
              <dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt>
              <dd className="mt-1 text-base font-semibold text-white">{email}</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
              <dt className="text-xs uppercase tracking-wide text-slate-400">Role</dt>
              <dd className="mt-1 text-base font-semibold text-white">{role}</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
              <dt className="text-xs uppercase tracking-wide text-slate-400">Tenant ID</dt>
              <dd className="mt-1 font-mono text-sm text-white">{tenantId}</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
              <dt className="text-xs uppercase tracking-wide text-slate-400">User ID</dt>
              <dd className="mt-1 font-mono text-sm text-white">{userId}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-400">
            For password or access changes, contact your administrator.
          </p>
        </section>
      </main>
    </div>
  );
}




