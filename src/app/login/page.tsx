"use client";

import { FormEvent, Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });
    setLoading(false);

    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(res?.url || "/app");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-fuchsia-500/25 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-80 w-80 rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="absolute left-[-20%] top-1/3 h-72 w-72 rounded-full bg-cyan-400/10 blur-[120px]" />
      </div>
      <div className="relative mx-auto flex max-w-5xl flex-col gap-10 px-6 py-14 md:flex-row md:items-center md:justify-between md:px-10 md:py-20">
        <div className="max-w-xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-fuchsia-200/80">
            imeiTool
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
            Log in to your intake workspace
          </h1>
          <p className="text-base text-slate-300">
            Secure access for operators and admins. Credentials stay server-side; SickW and Sheets
            keys are never exposed in the browser.
          </p>
          <Link
            href="/"
            className="text-sm text-fuchsia-200 underline-offset-4 hover:text-white hover:underline"
          >
            ← Back to splash
          </Link>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-fuchsia-500/10 backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Sign in</h2>
              <p className="text-xs text-slate-400">Use your issued email and password.</p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
              Secure
            </span>
          </div>
          <label className="text-sm text-slate-200">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white shadow-inner shadow-black/20 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            />
          </label>
          <label className="text-sm text-slate-200">
            Password
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 shadow-inner shadow-black/10 focus-within:border-fuchsia-400 focus-within:ring-2 focus-within:ring-fuchsia-500/40">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="m1 1 22 22" />
                    <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88" />
                    <path d="M15 12a3 3 0 0 0-3-3" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M1 12S4 4 12 4s11 8 11 8-3 8-11 8S1 12 1 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <p className="text-center text-xs text-slate-400">
            Need access? Contact your admin to create an account.
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
