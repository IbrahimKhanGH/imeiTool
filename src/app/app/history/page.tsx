"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HistoryRecord = {
  id: number;
  imei: string;
  serial: boolean;
  serviceId: string;
  serviceName?: string | null;
  source?: string | null;
  status: string;
  userGrade?: string | null;
  userCost?: number | null;
  carrier?: string | null;
  modelName?: string | null;
  blacklistStatus?: string | null;
  simLock?: string | null;
  purchaseCountry?: string | null;
  checkedAt: string;
  createdAt: string;
};

type HistoryResponse = {
  data: HistoryRecord[];
  nextCursor: number | null;
  prevCursor: number | null;
};

const gradeOptions = ["NEW", "OB", "HSO", "A", "B", "C"];
const statusOptions = ["success", "error"];
const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    hour12: false,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [prevStack, setPrevStack] = useState<number[]>([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [grade, setGrade] = useState("");
  const [carrier, setCarrier] = useState("");
  const [model, setModel] = useState("");
  const [serialOnly, setSerialOnly] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          pageSize: String(pageSize),
        });
        if (search.trim()) params.set("search", search.trim());
        if (status) params.set("status", status);
        if (grade) params.set("grade", grade);
        if (carrier.trim()) params.set("carrier", carrier.trim());
        if (model.trim()) params.set("model", model.trim());
        if (serialOnly) params.set("serialOnly", "true");
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (cursor) params.set("cursor", String(cursor));

        const res = await fetch(`/api/history?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("Failed to load history");
        }
        const data = (await res.json()) as HistoryResponse;
        setRecords(data.data);
        setNextCursor(data.nextCursor);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError(err instanceof Error ? err.message : "Failed to load history");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [cursor, pageSize, search, status, grade, carrier, model, serialOnly, startDate, endDate]);

  const resetCursor = () => {
    setCursor(null);
    setPrevStack([]);
  };

  const goNext = () => {
    if (!nextCursor) return;
    setPrevStack((stack) => (cursor ? [...stack, cursor] : stack));
    setCursor(nextCursor);
  };

  const goPrev = () => {
    if (!prevStack.length) return;
    const stack = [...prevStack];
    const prev = stack.pop() ?? null;
    setPrevStack(stack);
    setCursor(prev);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:px-10 md:py-14">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-fuchsia-500/10 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200/80">
              History
            </p>
            <h1 className="text-3xl font-semibold text-white">Lookup history</h1>
            <p className="text-sm text-slate-300">
              Search, filter, and export past scans. Data is tenant-scoped.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app"
              className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white/90 hover:border-white/40 hover:bg-white/10"
            >
              Back to app
            </Link>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl shadow-indigo-500/10 backdrop-blur">
          <div className="grid gap-3 md:grid-cols-4 sticky top-4 z-10 bg-slate-900/80 backdrop-blur rounded-2xl p-3 border border-white/5">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetCursor();
              }}
              placeholder="Search IMEI/serial/model/carrier"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                resetCursor();
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="">Status: any</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value);
                resetCursor();
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="">Grade: any</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <input
              value={carrier}
              onChange={(e) => {
                setCarrier(e.target.value);
                resetCursor();
              }}
              placeholder="Carrier contains..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <input
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                resetCursor();
              }}
              placeholder="Model contains..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
              <input
                type="checkbox"
                checked={serialOnly}
                onChange={(e) => {
                  setSerialOnly(e.target.checked);
                  resetCursor();
                }}
                className="h-4 w-4 rounded border-white/30 bg-white/10 text-indigo-500 focus:ring-indigo-500/60"
              />
              <span className="text-xs uppercase tracking-wide text-slate-300">
                Serial only
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  resetCursor();
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  resetCursor();
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
            <div className="flex flex-wrap gap-2">
              {loading && (
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold">
                  Loading…
                </span>
              )}
              {error && (
                <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-100">
                  {error}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Page size</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  resetCursor();
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full text-left text-sm text-white/90">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Grade</th>
                  <th className="px-3 py-2">Cost</th>
                  <th className="px-3 py-2">IMEI/Serial</th>
                  <th className="px-3 py-2">Carrier</th>
                  <th className="px-3 py-2">Lock/Blacklist</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Checked</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-white/5 bg-white/0 text-slate-200"
                  >
                    <td className="px-3 py-2 text-xs">{row.modelName ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{row.userGrade ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {typeof row.userCost === "number"
                        ? `$${row.userCost.toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-white">
                      {row.imei}
                      {row.serial ? " (SN)" : ""}
                    </td>
                    <td className="px-3 py-2 text-xs">{row.carrier ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.simLock ?? row.blacklistStatus ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          row.status === "success"
                            ? "bg-emerald-500/15 text-emerald-100 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-100 border border-rose-500/30"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {formatDate(row.checkedAt || row.createdAt)}
                    </td>
                  </tr>
                ))}
                {!records.length && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-sm text-slate-400"
                    >
                      {loading ? "Loading..." : "No history found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={!prevStack.length}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-xs text-slate-400">
                {cursor ? `Cursor ${cursor}` : "First page"}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={!nextCursor}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

