"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SICKW_SERVICES } from "@/config/sickwServices";
import type {
  ApiErrorResponse,
  CheckImeiResponse,
  NormalizedDeviceInfo,
  RecentLookup,
} from "@/types/imei";

const resultFields: Array<{
  label: string;
  key: keyof NormalizedDeviceInfo;
}> = [
  { label: "Manufacturer", key: "manufacturer" },
  { label: "Model Name", key: "modelName" },
  { label: "Model Code", key: "modelCode" },
  { label: "Storage", key: "storage" },
  { label: "Description", key: "description" },
  { label: "Carrier", key: "carrier" },
  { label: "Purchase Country", key: "purchaseCountry" },
  { label: "FMI / iCloud", key: "fmiStatus" },
  { label: "iCloud Lock", key: "icloudLock" },
  { label: "SIM / Lock Status", key: "simLock" },
  { label: "Blacklist Status", key: "blacklistStatus" },
];

type ServiceOption = {
  id: string;
  name: string;
  price?: string;
  source: "curated" | "api";
  description?: string;
};

type ServicesApiResponse = {
  "Service List"?: Array<{
    service: string;
    name: string;
    price?: string;
  }>;
};

const curatedServiceOptions: ServiceOption[] = Object.values(SICKW_SERVICES).map(
  (service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    price: service.price,
    source: "curated",
  }),
);

const DEFAULT_SERVICE_ID =
  SICKW_SERVICES.iphoneCarrierFmiBlacklist?.id ??
  SICKW_SERVICES.iphoneCarrierFmi?.id ??
  curatedServiceOptions[0]?.id ??
  "";

const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    hour12: false,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Home() {
  const [imei, setImei] = useState("");
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>(
    curatedServiceOptions,
  );
  const [serviceId, setServiceId] = useState(DEFAULT_SERVICE_ID);
  const [userGrade, setUserGrade] = useState("");
  const [userCost, setUserCost] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NormalizedDeviceInfo | null>(null);
  const [source, setSource] = useState<CheckImeiResponse["source"] | null>(
    null,
  );
  const [recent, setRecent] = useState<RecentLookup[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedServiceMeta = useMemo(() => {
    const curated = Object.values(SICKW_SERVICES).find(
      (service) => service.id === serviceId,
    );

    if (curated) return curated;

    return serviceOptions.find((option) => option.id === serviceId) ?? null;
  }, [serviceId, serviceOptions]);

  const fetchRecent = useCallback(async () => {
    try {
      const response = await fetch("/api/recent-lookups", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load recent lookups.");
      }

      const data = (await response.json()) as RecentLookup[];
      setRecent(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
    inputRef.current?.focus();
  }, [fetchRecent]);

  useEffect(() => {
    const decodeHtml = (value: string) => {
      if (!value.includes("&")) return value;
      return value.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      );
    };

    const loadServices = async () => {
      try {
        const response = await fetch("/api/sickw/services", {
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = (await response.json()) as ServicesApiResponse;
        const list = payload["Service List"];
        if (!Array.isArray(list)) return;

        const dynamicOptions: ServiceOption[] = list
          .filter((item) => item.service && item.name)
          .map((item) => ({
            id: item.service,
            name: decodeHtml(item.name),
            price: item.price,
            source: "api",
          }));

        setServiceOptions((current) => {
          const byId = new Map<string, ServiceOption>();
          [...curatedServiceOptions, ...current, ...dynamicOptions].forEach(
            (option) => {
              if (!byId.has(option.id)) {
                byId.set(option.id, option);
              }
            },
          );

          return Array.from(byId.values()).sort((a, b) => {
            const priceA = Number(a.price ?? Number.MAX_VALUE);
            const priceB = Number(b.price ?? Number.MAX_VALUE);
            if (Number.isFinite(priceA) && Number.isFinite(priceB)) {
              if (priceA !== priceB) {
                return priceA - priceB;
              }
            }
            return a.name.localeCompare(b.name);
          });
        });
      } catch (serviceError) {
        console.warn("Failed to load SickW service list", serviceError);
      }
    };

    loadServices();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = imei.trim();
    if (!trimmed) {
      setError("Please enter an IMEI.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const requestBody = {
        imei: trimmed,
        serviceId: serviceId || undefined,
        grade: userGrade || undefined,
        cost: userCost ? Number(userCost) : undefined,
      };

      const response = await fetch("/api/check-imei", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => ({}))) as ApiErrorResponse;
        const message = payload.error ?? "Lookup failed.";
        throw new Error(
          payload.code ? `${message} (${payload.code})` : message,
        );
      }

      const payload = (await response.json()) as CheckImeiResponse;
      setResult(payload.data);
      setSource(payload.source);
      setImei("");
      // Keep grade/cost sticky to ease batch scanning
      inputRef.current?.focus();
      fetchRecent();
    } catch (err) {
      console.error(err);
      setResult(null);
      setSource(null);
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setPending(false);
    }
  };

  const recentRows = useMemo(() => recent.slice(0, 10), [recent]);
  const formatCurrency = (value?: number | null) =>
    typeof value === "number" && !Number.isNaN(value)
      ? `$${value.toFixed(2)}`
      : null;

  const formatPriceLabel = (price?: string) => {
    if (!price) return "";
    const parsed = Number(price);
    if (Number.isFinite(parsed)) {
      return `$${parsed.toFixed(parsed >= 1 ? 2 : 3)}`;
    }
    return price;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-fuchsia-500/30 blur-[140px]" />
        <div className="absolute bottom-0 right-[-10%] h-80 w-80 rounded-full bg-blue-500/20 blur-[120px]" />
      </div>
      <main className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 md:px-10 md:py-16">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-200/80">
            imeiTool
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Instant IMEI intake workspace
          </h1>
          <p className="text-base text-slate-300 md:w-3/4">
            Scan devices, run SickW’s instant info services, keep a local cache,
            and mirror the output into Google Sheets without exposing API keys.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-fuchsia-500/10 backdrop-blur-md md:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
              <div>
                <label
                  htmlFor="imei"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  IMEI Number
                </label>
                <input
                  id="imei"
                  name="imei"
                  ref={inputRef}
                  autoFocus
                  autoComplete="off"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={17}
                  placeholder="Scan or type IMEI..."
                  value={imei}
                  onChange={(event) => setImei(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg tracking-wide text-white placeholder:text-white/40 shadow-inner shadow-black/20 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
                <p className="mt-2 text-xs text-slate-400">
                  Hardware scanners that emulate keyboards can type the IMEI and
                  press Enter to submit.
                </p>
              </div>
              <div>
                <label
                  htmlFor="grade"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Grade (optional)
                </label>
                <input
                  id="grade"
                  name="grade"
                  placeholder="A / B / C / Sealed"
                  value={userGrade}
                  onChange={(e) => setUserGrade(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 shadow-inner shadow-black/10 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>
              <div>
                <label
                  htmlFor="cost"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Our Cost (optional)
                </label>
                <input
                  id="cost"
                  name="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 120.00"
                  value={userCost}
                  onChange={(e) => setUserCost(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 shadow-inner shadow-black/10 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>
              <div>
                <label
                  htmlFor="service"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  SickW Service
                </label>
                <select
                  id="service"
                  name="service"
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white shadow-inner shadow-black/10 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                >
                  <option value="">Use project default</option>
                  {curatedServiceOptions.length > 0 && (
                    <optgroup label="Curated">
                      {curatedServiceOptions.map((meta) => (
                        <option key={`curated-${meta.id}`} value={meta.id}>
                          {meta.name} (#{meta.id}
                          {meta.price ? ` · ${formatPriceLabel(meta.price)}` : ""}
                          )
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {serviceOptions.some((option) => option.source === "api") && (
                    <optgroup label="All SickW services">
                      {serviceOptions
                        .filter((option) => option.source === "api")
                        .map((option) => (
                          <option key={`api-${option.id}`} value={option.id}>
                            {option.name} (#{option.id}
                            {option.price
                              ? ` · ${formatPriceLabel(option.price)}`
                              : ""}
                            )
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
                <p className="mt-2 text-xs text-slate-400">
                  {selectedServiceMeta?.description ??
                    (selectedServiceMeta?.name
                      ? `Using service #${selectedServiceMeta.id} (${selectedServiceMeta.name}).`
                      : "Falls back to the default service configured on the server.")}
                  {selectedServiceMeta?.price
                    ? ` · ${formatPriceLabel(selectedServiceMeta.price)}`
                    : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="text-xs text-slate-400">
                Checks run against SickW via secure backend. API key never hits
                the browser.
              </div>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 px-6 py-3 text-lg font-semibold text-white shadow-lg shadow-fuchsia-500/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
              >
                {pending ? "Checking..." : "Run Lookup"}
              </button>
            </div>
          </form>
          {error && (
            <p className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </p>
          )}
        </section>

        {result && (
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-indigo-500/10 backdrop-blur md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                  {source === "cache" ? "Cached result" : "Fresh lookup"}
                </p>
                <h2 className="text-3xl font-semibold text-white">
                  IMEI {result.imei}
                </h2>
              </div>
              <span className="rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white/70">
                {formatDate(result.checkedAt)}
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-xs uppercase tracking-wide text-white/70">
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">
                Status: {result.status}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">
                Service: {result.serviceName ?? "Custom"} (#{result.serviceId})
              </span>
              {formatCurrency(result.providerPrice) && (
                <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">
                  Provider price {formatCurrency(result.providerPrice)}
                </span>
              )}
              {formatCurrency(result.providerBalanceAfter) && (
                <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">
                  Balance {formatCurrency(result.providerBalanceAfter)}
                </span>
              )}
            </div>
            <dl className="mt-8 grid gap-4 md:grid-cols-2">
              {resultFields.map(({ label, key }) => (
                <div
                  key={key as string}
                  className="rounded-2xl border border-white/5 bg-white/5 p-4"
          >
                  <dt className="text-xs uppercase tracking-wide text-white/60">
                    {label}
                  </dt>
                  <dd className="mt-1 text-base font-medium text-white">
                    {(result[key] as string | undefined) ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wide text-white/60">
                Raw SickW Payload
              </p>
              <pre className="mt-2 max-h-64 overflow-auto rounded-2xl border border-white/5 bg-black/60 p-4 text-xs text-emerald-200">
                {JSON.stringify(result.rawResult, null, 2)}
              </pre>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-fuchsia-500/5 backdrop-blur md:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              Recent scans
            </h2>
            <button
              type="button"
              onClick={fetchRecent}
              className="text-sm font-medium text-fuchsia-300 hover:text-fuchsia-200"
            >
              Refresh
            </button>
          </div>
          {recentRows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No lookups yet. Your last 10 results will appear here for quick
              confirmation.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-white/90">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">IMEI</th>
                    <th className="py-2 pr-4">Service</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Model</th>
                    <th className="py-2 pr-4">Carrier</th>
                    <th className="py-2 pr-4">Blacklist</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-t border-white/5 text-slate-200"
                    >
                      <td className="py-2 pr-4">{formatDate(entry.createdAt)}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-white">
                        {entry.imei}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="text-xs font-medium text-white">
                          {entry.serviceName ?? `#${entry.serviceId}`}
                        </div>
                        {entry.price !== null && (
                          <div className="text-xs text-slate-400">
                            {formatCurrency(entry.price)}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            entry.status === "success"
                              ? "bg-emerald-400/20 text-emerald-200"
                              : "bg-red-400/20 text-red-200"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{entry.modelName ?? "—"}</td>
                      <td className="py-2 pr-4">{entry.carrier ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            entry.blacklistStatus
                              ? entry.blacklistStatus
                                  .toLowerCase()
                                  .includes("black")
                                ? "bg-red-400/20 text-red-200"
                                : "bg-emerald-400/20 text-emerald-200"
                              : "bg-white/10 text-slate-200"
                          }`}
                        >
                          {entry.blacklistStatus ?? "Unknown"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        </div>
          )}
        </section>
      </main>
    </div>
  );
}
