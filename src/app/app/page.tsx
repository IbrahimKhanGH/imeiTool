"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { SICKW_SERVICES } from "@/config/sickwServices";
import type {
  ApiErrorResponse,
  CheckImeiResponse,
  NormalizedDeviceInfo,
  RecentLookup,
  SickWErrorCode,
} from "@/types/imei";
import { isValidImei, sanitizeImei } from "@/lib/imei";

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

type BatchResult =
  | {
      imei: string;
      ok: true;
      source: CheckImeiResponse["source"];
      data: NormalizedDeviceInfo;
    }
  | {
      imei: string;
      ok: false;
      error: string;
      code?: SickWErrorCode;
    };

type BatchResponse = {
  count: number;
  results: BatchResult[];
};

type QueueStatus = "pending" | "running" | "success" | "error";

type QueueJob = {
  id: string;
  input: string;
  serialMode: boolean;
  serviceId?: string;
  grade?: string;
  cost?: number;
  status: QueueStatus;
  source?: CheckImeiResponse["source"];
  result?: NormalizedDeviceInfo;
  error?: string;
  startedAt?: number;
  completedAt?: number;
};

export default function Home() {
  const { data: session } = useSession();
  const [imei, setImei] = useState("");
  const [serialMode, setSerialMode] = useState(false);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>(
    curatedServiceOptions,
  );
  const [serviceId, setServiceId] = useState<string>(DEFAULT_SERVICE_ID);
  const [userGrade, setUserGrade] = useState("");
  const [singleCost, setSingleCost] = useState<string>("");
  const [batchCost, setBatchCost] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NormalizedDeviceInfo | null>(null);
  const [source, setSource] = useState<CheckImeiResponse["source"] | null>(
    null,
  );
  const [recent, setRecent] = useState<RecentLookup[]>([]);
  const [seen, setSeen] = useState<{
    lastDate: string;
    grade?: string;
    cost?: number | null;
    count: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoSubmitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [batchText, setBatchText] = useState("");
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchPending, setBatchPending] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueJob[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [toast, setToast] = useState<{
    id: string;
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CONCURRENCY = 1;

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
    return undefined;
  }, [fetchRecent]);

  useEffect(() => {
    return () => {
      if (autoSubmitTimer.current) {
        clearTimeout(autoSubmitTimer.current);
      }
    };
  }, []);

  // Seen-before chip
  useEffect(() => {
    if (!imei) {
      setSeen(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const candidate = serialMode ? imei.trim().toUpperCase() : sanitizeImei(imei);
        if (!candidate) {
          setSeen(null);
          return;
        }
        if (!serialMode && !isValidImei(candidate)) {
          setSeen(null);
          return;
        }

        const res = await fetch(
          `/api/history/seen?imei=${encodeURIComponent(candidate)}&limit=5`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!res.ok) {
          setSeen(null);
          return;
        }
        const data = await res.json();
        const records = (data?.data as any[]) ?? [];
        if (!records.length) {
          setSeen(null);
          return;
        }
        const last = records[0];
        setSeen({
          lastDate: last.checkedAt || last.createdAt,
          grade: last.userGrade ?? undefined,
          cost: last.userCost ?? null,
          count: records.length,
        });
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setSeen(null);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [imei, serialMode]);

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

        const allowedIds = new Set(["61", "82"]);
        const dynamicOptions: ServiceOption[] = list
          .filter((item) => item.service && item.name && allowedIds.has(item.service))
          .map((item) => ({
            id: item.service,
            name: decodeHtml(item.name),
            price: item.price,
            source: "api",
          }));

        // Merge curated with any dynamic overrides for the allowed ids
        setServiceOptions(() => {
          const byId = new Map<string, ServiceOption>();
          [...curatedServiceOptions, ...dynamicOptions].forEach((option) => {
            byId.set(option.id, option);
          });
          return Array.from(byId.values());
        });
      } catch (serviceError) {
        console.warn("Failed to load SickW service list", serviceError);
      }
    };

    loadServices();
  }, []);

  const batchImeis = useMemo(() => {
    if (serialMode) {
      return batchText
        .split(/\r?\n/)
        .map((line) => line.trim().toUpperCase())
        .filter(Boolean);
    }

    const matches = batchText.match(/\d+/g) ?? [];
    return matches
      .map((chunk) => sanitizeImei(chunk))
      .filter((digits): digits is string => Boolean(digits));
  }, [batchText, serialMode]);

  const batchValidImeis = useMemo(() => {
    if (serialMode) {
      return batchImeis.filter(
        (value) => value.length >= 5 && value.length <= 40,
      );
    }
    return batchImeis.filter((value) => isValidImei(value));
  }, [batchImeis, serialMode]);
  const batchInvalidImeis = useMemo(() => {
    if (serialMode) {
      return batchImeis.filter(
        (value) => value.length < 5 || value.length > 40,
      );
    }
    return batchImeis.filter((value) => !isValidImei(value));
  }, [batchImeis, serialMode]);

  const parseSingleCostInput = (): number | undefined => {
    const raw = singleCost.trim();
    if (!raw) return undefined;
    const normalized = raw.replace(/^\$/, "").replace(/,/g, "");
    if (!normalized || normalized === ".") return undefined;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : undefined;
  };

  const parseBatchCostInput = (): number | undefined => {
    const raw = batchCost.trim();
    if (!raw) return undefined;
    const normalized = raw.replace(/^\$/, "").replace(/,/g, "");
    if (!normalized || normalized === ".") return undefined;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : undefined;
  };

  const triggerToast = useCallback(
    (message: string, tone: "success" | "error") => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}`;
      setToast({ id, message, tone });
      toastTimer.current = setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
      }, 3200);
    },
    [],
  );

  const enqueueLookup = (imeiValue: string) => {
    const sanitized = serialMode ? imeiValue.trim() : sanitizeImei(imeiValue);
    if (!sanitized) {
      setError(serialMode ? "Please enter a serial." : "Please enter an IMEI.");
      return;
    }

    if (!serialMode && !isValidImei(sanitized)) {
      setError("Not an IMEI. Please rescan.");
      return;
    }
    if (serialMode && (sanitized.length < 5 || sanitized.length > 40)) {
      setError("Please enter a valid serial (5-40 characters).");
      return;
    }

    const parsedCost = parseSingleCostInput();
    const job: QueueJob = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `job-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      input: sanitized,
      serialMode,
      serviceId: serviceId || undefined,
      grade: userGrade || undefined,
      cost: parsedCost,
      status: "pending",
      completedAt: undefined,
      startedAt: undefined,
    };

    setQueue((current) => [...current, job]);
    setImei("");
    setError(null);
    inputRef.current?.focus();
  };

  const runJob = useCallback(
    async (job: QueueJob) => {
      setQueue((items) =>
        items.map((item) =>
          item.id === job.id
            ? {
                ...item,
                status: "running",
                error: undefined,
                startedAt: Date.now(),
              }
            : item,
        ),
      );
      setActiveCount((count) => count + 1);

      try {
        const response = await fetch("/api/check-imei", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imei: job.input,
            serviceId: job.serviceId || undefined,
            grade: job.grade || undefined,
            cost: job.cost,
            serialMode: job.serialMode,
          }),
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
        setError(null);
        fetchRecent();

        setQueue((items) =>
          items.map((item) =>
            item.id === job.id
              ? {
                  ...item,
                  status: "success",
                  result: payload.data,
                  source: payload.source,
                  completedAt: Date.now(),
                }
              : item,
          ),
        );
        triggerToast(`Scan done: ${job.input}`, "success");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Lookup failed. Please retry.";
        setError(message);
        setResult(null);
        setSource(null);
        setQueue((items) =>
          items.map((item) =>
            item.id === job.id
              ? {
                  ...item,
                  status: "error",
                  error: message,
                  completedAt: Date.now(),
                }
              : item,
          ),
        );
        triggerToast(`Scan failed: ${job.input}`, "error");
      } finally {
        setActiveCount((count) => Math.max(0, count - 1));
      }
    },
    [fetchRecent, triggerToast],
  );

  useEffect(() => {
    if (activeCount >= CONCURRENCY) return;
    const next = queue.find((item) => item.status === "pending");
    if (!next) return;
    runJob(next);
  }, [queue, activeCount, runJob, CONCURRENCY]);

  const retryJob = (id: string) => {
    setQueue((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, status: "pending", error: undefined, result: undefined }
          : item,
      ),
    );
  };

  const removeJob = (id: string) => {
    setQueue((items) => items.filter((item) => item.id !== id));
  };

  const runBatch = async () => {
    if (batchPending) return;

    if (batchImeis.length === 0) {
      setBatchError("Paste one IMEI per line (up to 50).");
      return;
    }

    if (batchImeis.length > 50) {
      setBatchError("Batch limit is 50 IMEIs per request.");
      return;
    }

    setBatchPending(true);
    setBatchError(null);
    setBatchResults([]);

    try {
      const parsedCost = parseBatchCostInput();
      const payload = {
        imeis: batchImeis,
        serviceId: serviceId || undefined,
        grade: userGrade || undefined,
        cost: parsedCost,
        serialMode,
      };

      const response = await fetch("/api/check-imei/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Batch lookup failed.");
      }

      const data = (await response.json()) as BatchResponse;
      setBatchResults(data.results);
      fetchRecent();
    } catch (err) {
      console.error(err);
      setBatchError(err instanceof Error ? err.message : "Batch lookup failed.");
    } finally {
      setBatchPending(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!imei.trim()) {
      setError(serialMode ? "Please enter a serial." : "Please enter an IMEI.");
      return;
    }
    enqueueLookup(imei.trim());
  };

  const handleImeiChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    let nextValue = serialMode ? raw.toUpperCase() : sanitizeImei(raw);

    if (!serialMode && nextValue.length > 17) {
      // Clamp to the latest 17 digits to avoid concatenated scans.
      nextValue = nextValue.slice(-17);
    }

    setImei(nextValue);
    setError(null);

    if (autoSubmitTimer.current) {
      clearTimeout(autoSubmitTimer.current);
    }

    if (!serialMode && nextValue.length >= 14 && nextValue.length <= 17) {
      autoSubmitTimer.current = setTimeout(async () => {
        if (isValidImei(nextValue)) {
          enqueueLookup(nextValue);
        } else {
          setError("Not an IMEI. Please rescan.");
          setImei("");
          inputRef.current?.focus();
        }
      }, 200);
    } else if (serialMode) {
      const len = nextValue.trim().length;

      if (len > 40) {
        setError("Please enter a valid serial (5-40 characters).");
        setImei("");
        inputRef.current?.focus();
        return;
      }

      if (len >= 5) {
        autoSubmitTimer.current = setTimeout(() => {
          enqueueLookup(nextValue.trim());
        }, 200);
      }
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

  const stepPillClass = (state: "idle" | "active" | "done" | "error") => {
    const base =
      "rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide";
    switch (state) {
      case "active":
        return `${base} border-indigo-400/60 bg-indigo-400/15 text-indigo-100`;
      case "done":
        return `${base} border-emerald-400/60 bg-emerald-400/15 text-emerald-100`;
      case "error":
        return `${base} border-rose-400/60 bg-rose-400/15 text-rose-100`;
      case "idle":
      default:
        return `${base} border-white/10 bg-white/5 text-slate-200/70`;
    }
  };

  return (
    <div className="flex flex-col gap-8 md:py-2">
      <header className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-fuchsia-500/10 backdrop-blur">
        <div className="space-y-2 pb-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-200/80">
            imeiTool
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Instant IMEI intake workspace
          </h1>
          <p className="text-base text-slate-300 md:w-3/4">
            Scan devices, run SickW instant checks, keep a local cache, and mirror into Google
            Sheets—without exposing provider keys.
          </p>
        </div>
      </header>
      <div className="flex flex-col gap-8">

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-fuchsia-500/10 backdrop-blur-md md:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
              <div>
                <label
                  htmlFor="imei"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  IMEI or Serial
                </label>
                <input
                  id="imei"
                  name="imei"
                  ref={inputRef}
                  autoFocus
                  autoComplete="off"
                  inputMode={serialMode ? "text" : "numeric"}
                  pattern={serialMode ? undefined : "[0-9]*"}
                  maxLength={serialMode ? 40 : 17}
                  placeholder={
                    serialMode ? "Type or paste serial..." : "Scan or type IMEI..."
                  }
                  value={imei}
                  onChange={handleImeiChange}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-base tracking-wide text-white placeholder:text-white/40 shadow-inner shadow-black/20 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
                <div className="mt-2 flex flex-col gap-1 text-xs text-slate-400 md:flex-row md:items-center md:justify-between">
                  <p>
                    {serialMode
                      ? "Serial mode: no Luhn check. Enter 5-40 letters/numbers."
                      : "Scans auto-run when a valid IMEI is detected; invalid scans clear so you can rescan immediately."}
                  </p>
              {seen && (
                <span className="flex items-center gap-2 text-emerald-200">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                    Seen before · {seen.count}x
                  </span>
                  <span className="text-[11px] text-emerald-100/80">
                    Last: {formatDate(seen.lastDate)}
                    {seen.grade ? ` · Grade ${seen.grade}` : ""}
                    {typeof seen.cost === "number" ? ` · $${seen.cost.toFixed(2)}` : ""}
                  </span>
                </span>
              )}
                  <label className="flex items-center gap-2 text-slate-200">
                    <input
                      type="checkbox"
                      checked={serialMode}
                      onChange={(e) => {
                        setSerialMode(e.target.checked);
                        setImei("");
                        setError(null);
                      }}
                      className="h-4 w-4 rounded border-white/30 bg-white/10 text-fuchsia-500 focus:ring-fuchsia-500/60"
                    />
                    <span className="text-xs uppercase tracking-wide">
                      Serial mode
                    </span>
                  </label>
                </div>
              </div>
              <div>
                <label
                  htmlFor="grade"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Grade (optional)
                </label>
                <select
                  id="grade"
                  name="grade"
                  value={userGrade}
                  onChange={(e) => setUserGrade(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white shadow-inner shadow-black/10 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                >
                  <option value="">Select grade</option>
                  <option value="NEW">NEW</option>
                  <option value="OB">OB</option>
                  <option value="HSO">HSO</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
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
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. $120 or 120.00"
                  value={singleCost}
                  onChange={(e) => setSingleCost(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 shadow-inner shadow-black/10 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
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
                disabled={false}
                className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 px-6 py-3 text-lg font-semibold text-white shadow-lg shadow-fuchsia-500/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
              >
                Add to queue
              </button>
            </div>
          </form>
          {error && (
            <p className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 shadow-2xl shadow-indigo-500/10 backdrop-blur md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200/80">
                Batch paste
              </p>
              <h2 className="text-2xl font-semibold text-white">
                Run up to 50 IMEIs in one go
              </h2>
              <p className="text-sm text-slate-300">
                We sanitize, dedupe, and Luhn-check before sending to SickW. Invalid IMEIs are
                reported inline.
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>{batchValidImeis.length} valid</div>
              <div>{batchInvalidImeis.length} invalid</div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-200">
            <label className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-400">Grade</span>
              <select
                value={userGrade}
                onChange={(e) => setUserGrade(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white shadow-inner shadow-black/10 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="">—</option>
                <option value="NEW">NEW</option>
                <option value="OB">OB</option>
                <option value="HSO">HSO</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-400">Cost</span>
              <input
                type="text"
                value={batchCost}
                onChange={(e) => setBatchCost(e.target.value)}
                placeholder="$"
                className="w-28 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/40 shadow-inner shadow-black/10 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr]">
            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              rows={8}
              placeholder="Paste IMEIs here, one per line or separated by commas/spaces..."
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white shadow-inner shadow-black/30 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <div className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  Ready to submit
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                  {batchImeis.length} IMEIs
                </span>
              </div>
              {batchInvalidImeis.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100">
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Invalid (Luhn failed)
                  </p>
                  <p className="mt-1 break-words text-xs">
                    {batchInvalidImeis.slice(0, 5).join(", ")}
                    {batchInvalidImeis.length > 5 ? " …" : ""}
                  </p>
                </div>
              )}
              <button
                type="button"
                disabled={
                  batchPending || batchImeis.length === 0 || batchImeis.length > 50
                }
                onClick={runBatch}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {batchPending
                  ? "Running batch..."
                  : `Run batch (${Math.min(batchImeis.length, 50)} IMEIs)`}
              </button>
              <p className="text-xs text-slate-400">
                We process sequentially with a small delay to avoid rate limits. Cache hits
                still append to Sheets.
              </p>
              {batchError && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  {batchError}
                </p>
              )}
            </div>
          </div>

          {batchResults.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-white/90">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">IMEI</th>
                    <th className="py-2 pr-4">Result</th>
                    <th className="py-2 pr-4">Service</th>
                    <th className="py-2 pr-4">Model</th>
                    <th className="py-2 pr-4">Carrier</th>
                    <th className="py-2 pr-4">Blacklist</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.map((entry, idx) => {
                    if (entry.ok) {
                      return (
                        <tr
                          key={`${entry.imei}-${idx}`}
                          className="border-t border-white/5 text-slate-200"
                        >
                          <td className="py-2 pr-4 font-mono text-xs text-white">
                            {entry.imei}
                          </td>
                          <td className="py-2 pr-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                entry.source === "cache"
                                  ? "bg-emerald-400/10 text-emerald-200"
                                  : "bg-blue-400/10 text-blue-200"
                              }`}
                            >
                              {entry.source === "cache" ? "cache" : "live"}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            {entry.data.serviceName ?? `#${entry.data.serviceId}`}
                          </td>
                          <td className="py-2 pr-4">
                            {entry.data.modelName ?? entry.data.description ?? "—"}
                          </td>
                          <td className="py-2 pr-4">{entry.data.carrier ?? "—"}</td>
                          <td className="py-2 pr-4">
                            {entry.data.blacklistStatus ?? "Unknown"}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={`${entry.imei}-${idx}`}
                        className="border-t border-white/5 text-slate-200"
                      >
                        <td className="py-2 pr-4 font-mono text-xs text-white">
                          {entry.imei}
                        </td>
                        <td className="py-2 pr-4" colSpan={5}>
                          <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-200">
                            {entry.error}
                            {entry.code ? ` (${entry.code})` : ""}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {queue.length > 0 && (
          <section className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 shadow-2xl shadow-indigo-500/10 backdrop-blur md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200/80">
                  Lookup queue
                </p>
                <h2 className="text-2xl font-semibold text-white">
                  Pending and recent jobs
                </h2>
                <p className="text-sm text-slate-300">
                  Keep scanning—jobs run in the background. IMEI/serial input clears after
                  enqueue; grade/cost/service stay.
                </p>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>{activeCount} running</div>
                <div>
                  {queue.filter((item) => item.status === "pending").length} pending
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {queue.map((item) => {
                const badgeStyles =
                  item.status === "success"
                    ? "bg-emerald-500/15 text-emerald-100 border border-emerald-500/30"
                    : item.status === "running"
                      ? "bg-amber-500/15 text-amber-100 border border-amber-500/30"
                      : item.status === "error"
                        ? "bg-rose-500/15 text-rose-100 border border-rose-500/30"
                        : "bg-white/5 text-slate-100 border border-white/10";

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <div className="text-xs uppercase tracking-wide text-slate-400">
                          {item.serialMode ? "Serial" : "IMEI"}
                        </div>
                        <div className="font-mono text-sm text-white">
                          {item.input}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className={stepPillClass(
                          item.status === "pending"
                            ? "active"
                            : "done",
                        )}
                      >
                        Queued
                      </span>
                      <span
                        className={stepPillClass(
                          item.status === "running"
                            ? "active"
                            : item.status === "success" || item.status === "error"
                              ? "done"
                              : "idle",
                        )}
                      >
                        Running
                      </span>
                      <span
                        className={stepPillClass(
                          item.status === "success"
                            ? "done"
                            : item.status === "error"
                              ? "error"
                              : "idle",
                        )}
                      >
                        Result
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                      <span>
                        {item.serviceId
                          ? `Service #${item.serviceId}`
                          : "Default service"}
                      </span>
                      {item.grade && <span>Grade {item.grade}</span>}
                      {typeof item.cost === "number" && (
                        <span>Cost ${item.cost.toFixed(2)}</span>
                      )}
                      {item.source && <span>Source {item.source}</span>}
                    </div>
                    {item.error && (
                      <p className="mt-2 text-xs text-rose-200">{item.error}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {item.status === "error" && (
                        <button
                          type="button"
                          onClick={() => retryJob(item.id)}
                          className="rounded-full border border-white/20 px-3 py-1 text-white hover:border-white/40"
                        >
                          Retry
                        </button>
                      )}
                      {item.status !== "running" && (
                        <button
                          type="button"
                          onClick={() => removeJob(item.id)}
                          className="rounded-full border border-white/20 px-3 py-1 text-slate-200 hover:border-white/40"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
      </div>
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
              toast.tone === "success"
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-50"
                : "border-rose-400/40 bg-rose-500/15 text-rose-50"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
