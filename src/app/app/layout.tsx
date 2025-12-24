"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

type HealthStatus = "ok" | "not_configured" | "degraded" | "error";

type HealthResponse = {
  sickw: { status: HealthStatus; message?: string; balance?: number | null };
  sheets: { status: HealthStatus; message?: string; tab?: string };
  db: { status: HealthStatus; message?: string };
  env: {
    sickwConfigured: boolean;
    sheetsConfigured: boolean;
    defaultServiceId: string | null;
    timezone: string;
  };
  serverTime: string;
};

const statusBadgeClass = (status: HealthStatus) => {
  switch (status) {
    case "ok":
      return "bg-emerald-500/15 text-emerald-100 border border-emerald-500/30";
    case "degraded":
      return "bg-amber-500/15 text-amber-100 border border-amber-500/30";
    case "not_configured":
      return "bg-white/10 text-slate-200 border border-white/10";
    case "error":
    default:
      return "bg-rose-500/15 text-rose-100 border border-rose-500/30";
  }
};

const ScanIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8 8h8v8H8z" />
  </svg>
);

const HistoryIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 1 1 3 6.7" />
    <path d="M3 12h6" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1 1.6V21a2 2 0 0 1-4 0v-.1a1.8 1.8 0 0 0-1-1.6 1.8 1.8 0 0 0-2 .4l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.6-1H3a2 2 0 0 1 0-4h.1a1.8 1.8 0 0 0 1.6-1 1.8 1.8 0 0 0-.4-2l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.8 1.8 0 0 0 2 .4h.2A1.8 1.8 0 0 0 11 3.1V3a2 2 0 0 1 4 0v.1a1.8 1.8 0 0 0 1 1.6 1.8 1.8 0 0 0 2-.4l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.6 1H21a2 2 0 0 1 0 4h-.1a1.8 1.8 0 0 0-1.5 1Z" />
  </svg>
);

const ProfileIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.6-3 4.5-5 8-5s6.4 2 8 5" />
  </svg>
);

const ChevronIcon = ({ direction }: { direction: "left" | "right" }) => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {direction === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
  </svg>
);

const HealthIcon = ({ type }: { type: "sickw" | "sheets" | "db" }) => {
  switch (type) {
    case "sickw":
      return (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12h4l3 8 4-16 3 8h4" />
        </svg>
      );
    case "sheets":
      return (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 5a2 2 0 0 1 2-2h6.5L20 10.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
          <path d="M14 3v6h6" />
          <path d="M8 13h2" />
          <path d="M8 17h8" />
        </svg>
      );
    case "db":
    default:
      return (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v14c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
          <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
        </svg>
      );
  }
};

const LogoutIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <path d="M10 17l5-5-5-5" />
    <path d="M15 12H3" />
  </svg>
);

const getInitials = (email?: string | null) => {
  if (!email) return "U";
  const name = email.split("@")[0] ?? "";
  if (!name) return "U";
  const parts = name.replace(/[^a-zA-Z0-9]/g, " ").trim().split(" ");
  const [a, b] = parts;
  if (a && b) return `${a[0]}${b[0]}`.toUpperCase();
  return a ? a.slice(0, 2).toUpperCase() : "U";
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const initials = useMemo(() => getInitials((session?.user as any)?.email ?? null), [session]);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as HealthResponse;
        if (mounted) setHealth(payload);
      } catch (err) {
        if (mounted) setHealth(null);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const navItems = [
    { href: "/app", label: "Scan", icon: <ScanIcon /> },
    { href: "/app/history", label: "History", icon: <HistoryIcon /> },
  ];

  const isActive = (href: string) => {
    if (href === "/app") return pathname === "/app";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-fuchsia-500/30 blur-[140px]" />
        <div className="absolute bottom-0 right-[-10%] h-80 w-80 rounded-full bg-blue-500/20 blur-[120px]" />
      </div>
      <div className="relative mx-auto flex max-w-7xl gap-4 px-2 py-8 md:px-6">
        <aside
          className={`sticky top-4 hidden h-[calc(100vh-80px)] flex-col border border-white/10 bg-slate-900/90 shadow-2xl shadow-slate-900/40 backdrop-blur transition-all duration-200 md:flex ${
            navCollapsed ? "w-16 rounded-xl p-3" : "w-64 rounded-2xl p-4"
          }`}
        >
          <div className="flex items-center gap-2">
            {!navCollapsed && <div className="text-sm font-semibold text-white">imeiTool</div>}
            <div className={navCollapsed ? "mx-auto" : "ml-auto"}>
              <button
                type="button"
                aria-label="Toggle navigation width"
                onClick={() => setNavCollapsed((v) => !v)}
                className="rounded-full border border-white/10 bg-white/5 p-1 text-slate-200 hover:border-white/20 hover:bg-white/10"
              >
                <ChevronIcon direction={navCollapsed ? "right" : "left"} />
              </button>
            </div>
          </div>
          <nav className="mt-4 flex flex-col gap-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center rounded-xl border text-sm font-semibold transition ${
                    active
                      ? "border-fuchsia-400/50 bg-fuchsia-500/10 text-white"
                      : "border-white/5 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
                  } ${
                    navCollapsed
                      ? "justify-center gap-0 px-2 py-2"
                      : "gap-3 px-3 py-2"
                  }`}
                >
                  <span className="text-white">{item.icon}</span>
                  {!navCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3">
            <div className="flex flex-col gap-2 text-xs">
              {[
                { type: "sickw" as const, status: health?.sickw.status },
                { type: "sheets" as const, status: health?.sheets.status },
                { type: "db" as const, status: health?.db?.status },
              ].map((item) => (
                <span
                  key={item.type}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${statusBadgeClass(
                    item.status ?? "degraded",
                  )} ${navCollapsed ? "justify-center px-2" : ""}`}
                  title={item.type.toUpperCase()}
                >
                  <HealthIcon type={item.type} />
                  {!navCollapsed && <span className="capitalize">{item.type}</span>}
                </span>
              ))}
            </div>
            <div
              className={`flex rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white ${
                navCollapsed ? "flex-col items-center gap-2" : "items-center gap-3"
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500/80 to-indigo-500/80 text-xs font-bold uppercase text-white">
                {initials}
              </div>
              {navCollapsed ? (
                <div className="flex flex-col items-center gap-2">
                  <Link
                    href="/app/profile"
                    className="rounded-full border border-white/10 bg-white/10 p-2 text-white hover:border-white/20 hover:bg-white/20"
                    title="Profile"
                  >
                    <ProfileIcon />
                  </Link>
                  <Link
                    href="/app/settings"
                    className="rounded-full border border-white/10 bg-white/10 p-2 text-white hover:border-white/20 hover:bg-white/20"
                    title="Settings"
                  >
                    <SettingsIcon />
                  </Link>
                </div>
              ) : (
                <div className="flex-1 text-xs text-slate-200">
                  <div className="font-semibold text-white">
                    {session?.user?.email ?? "Account"}
                  </div>
                  {(session?.user as any)?.role && (
                    <div className="text-slate-400">{(session?.user as any)?.role}</div>
                  )}
                  <div className="mt-1 flex gap-2 text-[11px] font-semibold uppercase text-fuchsia-200/80">
                    <Link
                      href="/app/profile"
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-1 hover:border-white/20 hover:bg-white/10"
                    >
                      Profile
                    </Link>
                    <Link
                      href="/app/settings"
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-1 hover:border-white/20 hover:bg-white/10"
                    >
                      Settings
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:border-white/20 hover:bg-white/10 ${
                navCollapsed ? "justify-center" : ""
              }`}
            >
              <LogoutIcon />
              {!navCollapsed && <span>Log out</span>}
            </button>
          </div>
        </aside>
        <main className="relative flex-1 flex-col gap-6 md:py-2">{children}</main>
      </div>
    </div>
  );
}

