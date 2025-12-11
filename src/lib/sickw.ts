import { getServiceMetaById } from "@/config/sickwServices";
import type {
  NormalizedDeviceInfo,
  SickWError,
  SickWErrorCode,
  SickWRawResponse,
} from "@/types/imei";
import { ensureEnv, env } from "./env";

export type SickWFormat = "beta" | "json";

export type SickWQueryParams = {
  imei: string;
  serviceId?: string;
  format?: SickWFormat;
};

type SickWRequestParams = Record<string, string>;

const normalizeKey = (key: string): string =>
  key.trim().toLowerCase().replace(/\s+/g, " ");

const stringifyUnknown = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value.toString();
  }

  return JSON.stringify(value);
};

export class SickWApiError extends Error {
  code: SickWErrorCode;
  status: number;

  constructor(message: string, code: SickWErrorCode = "UNKNOWN", status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const ERROR_PATTERNS: Array<{
  regex: RegExp;
  code: SickWErrorCode;
  message: string;
  status?: number;
}> = [
  {
    regex: /E01/i,
    code: "E01_INVALID_IMEI",
    message: "IMEI failed validation. Please double-check and rescan.",
  },
  {
    regex: /E02/i,
    code: "E02_INVALID_SN",
    message: "IMEI/SN is wrong or unsupported by this service.",
  },
  {
    regex: /R01/i,
    code: "R01_NOT_FOUND",
    message: "Device not found. Try another service or confirm the IMEI.",
  },
  {
    regex: /B01/i,
    code: "B01_LOW_BALANCE",
    message: "SickW balance is low. Please top up before retrying.",
    status: 402,
  },
  {
    regex: /S01/i,
    code: "S01_SERVICE_INVALID",
    message: "The requested service ID is invalid or doesn't exist.",
  },
  {
    regex: /S02/i,
    code: "S02_SERVICE_INCOMPATIBLE",
    message: "This service doesn't support this device model. Try a different service or device.",
  },
  {
    regex: /A0[123]/i,
    code: "A01_API_KEY_INVALID",
    message: "The SickW API key is invalid or disabled.",
    status: 401,
  },
];

const mapErrorFromMessage = (message: string): SickWError => {
  const matched =
    ERROR_PATTERNS.find((pattern) => pattern.regex.test(message)) ?? null;

  if (matched) {
    return {
      code: matched.code,
      message: matched.message,
      rawMessage: message,
    };
  }

  return {
    code: "UNKNOWN",
    message,
    rawMessage: message,
  };
};

const extractError = (payload: SickWRawResponse): SickWError | null => {
  if (payload.status === "success") {
    return null;
  }

  const rawMessage =
    payload.error ||
    payload.message ||
    (typeof payload.result === "string" ? payload.result : undefined) ||
    "SickW returned an error.";

  return mapErrorFromMessage(rawMessage);
};

const toRecord = (
  result: SickWRawResponse["result"],
): Record<string, string> => {
  if (!result) return {};

  if (typeof result === "string") {
    const record: Record<string, string> = {};
    result
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const sanitized = line.replace(/=>/g, ":");
        const separatorIndex = sanitized.indexOf(":");
        if (separatorIndex === -1) return;
        const key = sanitized.slice(0, separatorIndex).trim();
        const value = sanitized.slice(separatorIndex + 1).trim();
        if (!key) return;

        record[key] = value;
        record[normalizeKey(key)] = value;
      });

    return record;
  }

  return Object.entries(result).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      const normalizedKey = normalizeKey(key);
      acc[key] = stringifyUnknown(value);
      if (normalizedKey !== key) {
        acc[normalizedKey] = acc[key];
      }
      return acc;
    },
    {},
  );
};

const pickField = (
  record: Record<string, string>,
  labels: string[],
): string | undefined => {
  for (const label of labels) {
    const normalized = normalizeKey(label);
    if (record[label]) return record[label];
    if (record[normalized]) return record[normalized];
  }
  return undefined;
};

const parseNumber = (value?: string): number | null => {
  if (!value) return null;
  const normalized = value.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseModelDescription = (
  desc?: string,
): { modelName?: string; storage?: string } => {
  if (!desc) return {};
  // Example: "IPHONE 16 PRO MAX NATURAL 256GB-USA"
  const match = desc.match(/^(.+?)\s+(\d+GB)/i);
  if (match) {
    return {
      modelName: match[1].trim(),
      storage: match[2].trim(),
    };
  }
  return { modelName: desc };
};

const parseCarrier = (carrier?: string): string | undefined => {
  if (!carrier) return undefined;
  // Example: "23 - US AT&T Activation Policy" -> "US AT&T" or "AT&T"
  const match = carrier.match(/(?:US\s+)?(AT&T|T-Mobile|Verizon|Sprint|Cricket)/i);
  if (match) return match[1];
  // If no match, try to extract carrier name after dash
  const parts = carrier.split("-");
  if (parts.length > 1) {
    return parts[1].trim().replace(/\s+Activation Policy.*/i, "");
  }
  return carrier;
};

const normalizePayload = (
  raw: SickWRawResponse,
  fallbackServiceId: string,
): NormalizedDeviceInfo => {
  const record = toRecord(raw.result);
  const serviceId = raw.service ?? fallbackServiceId;
  const serviceMeta = getServiceMetaById(serviceId);
  const checkedAt = new Date().toISOString();

  // Parse Model Description if present
  const modelDesc = pickField(record, ["Model Description"]);
  const parsedModel = modelDesc ? parseModelDescription(modelDesc) : {};

  // Parse carrier from Locked Carrier field
  const lockedCarrier = pickField(record, ["Locked Carrier"]);
  const parsedCarrier = lockedCarrier ? parseCarrier(lockedCarrier) : undefined;

  const normalized: NormalizedDeviceInfo = {
    imei: raw.imei || "",
    serviceId,
    serviceName: serviceMeta?.name,
    status: raw.status,
    storage:
      pickField(record, ["Storage", "Capacity", "Storage Capacity"]) ||
      parsedModel.storage,
    manufacturer: pickField(record, [
      "Manufacturer",
      "Brand",
      "Device Manufacturer",
    ]),
    modelName:
      pickField(record, ["Model Name", "Model", "Device"]) ||
      parsedModel.modelName,
    modelCode: pickField(record, [
      "Model Code",
      "Model Number",
      "Part Number",
    ]),
    description:
      pickField(record, ["Description", "Device info"]) || modelDesc,
    fmiStatus: pickField(record, [
      "FMI Status",
      "Find My iPhone",
      "FMI",
      "iCloud FMI",
      "iCloud Status",
    ]),
    icloudLock: pickField(record, [
      "iCloud Lock",
      "iCloud Status",
      "iCloud",
    ]),
    blacklistStatus: pickField(record, [
      "Blacklist Status",
      "Blacklisted",
      "GSMA Status",
      "Blacklist",
    ]),
    carrier:
      pickField(record, ["Carrier", "Carrier Lock", "Network"]) ||
      parsedCarrier,
    purchaseCountry: pickField(record, [
      "Purchase Country",
      "Country",
      "Purchase Country Code",
    ]),
    simLock: pickField(record, [
      "SIM-Lock",
      "Sim-Lock Status",
      "Lock Status",
      "Sim Lock Status",
      "SIM Lock",
    ]),
    providerPrice: parseNumber(raw.price),
    providerBalanceAfter: parseNumber(raw.balance),
    rawResult: raw.result ?? record,
    rawResponse: raw,
    checkedAt,
    extraFields: Object.entries(record).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        if (key === normalizeKey(key)) {
          return acc;
        }
        acc[key] = value;
        return acc;
      },
      {},
    ),
  };

  return normalized;
};

export const rehydrateNormalized = (
  existing: NormalizedDeviceInfo,
  fallbackServiceId: string,
): NormalizedDeviceInfo => {
  // If we already have key fields, keep the cached result
  if (
    existing.manufacturer ||
    existing.modelName ||
    existing.carrier ||
    existing.purchaseCountry
  ) {
    return existing;
  }

  const rawResult =
    (existing.rawResponse as SickWRawResponse | undefined)?.result ??
    existing.rawResult;

  if (!rawResult) return existing;

  const record = toRecord(rawResult);
  const modelDesc = pickField(record, ["Model Description"]);
  const parsedModel = modelDesc ? parseModelDescription(modelDesc) : {};
  const lockedCarrier = pickField(record, ["Locked Carrier"]);
  const parsedCarrier = lockedCarrier ? parseCarrier(lockedCarrier) : undefined;

  const serviceId = existing.serviceId || fallbackServiceId;
  const serviceMeta = getServiceMetaById(serviceId);

  return {
    ...existing,
    serviceId,
    serviceName: existing.serviceName ?? serviceMeta?.name,
    manufacturer:
      existing.manufacturer ??
      pickField(record, ["Manufacturer", "Brand", "Device Manufacturer"]),
    modelName:
      existing.modelName ??
      pickField(record, ["Model Name", "Model", "Device"]) ??
      parsedModel.modelName,
    modelCode:
      existing.modelCode ??
      pickField(record, ["Model Code", "Model Number", "Part Number"]),
    storage:
      existing.storage ??
      pickField(record, ["Storage", "Capacity", "Storage Capacity"]) ??
      parsedModel.storage,
    description:
      existing.description ??
      pickField(record, ["Description", "Device info"]) ??
      modelDesc,
    fmiStatus:
      existing.fmiStatus ??
      pickField(record, [
        "FMI Status",
        "Find My iPhone",
        "FMI",
        "iCloud FMI",
        "iCloud Status",
      ]),
    icloudLock:
      existing.icloudLock ??
      pickField(record, ["iCloud Lock", "iCloud Status", "iCloud"]),
    blacklistStatus:
      existing.blacklistStatus ??
      pickField(record, ["Blacklist Status", "Blacklisted", "GSMA Status", "Blacklist"]),
    carrier:
      existing.carrier ??
      pickField(record, ["Carrier", "Carrier Lock", "Network"]) ??
      parsedCarrier,
    purchaseCountry:
      existing.purchaseCountry ??
      pickField(record, ["Purchase Country", "Country", "Purchase Country Code"]),
    simLock:
      existing.simLock ??
      pickField(record, [
        "SIM-Lock",
        "Sim-Lock Status",
        "Lock Status",
        "Sim Lock Status",
        "SIM Lock",
      ]),
    rawResult: rawResult,
  };
};

const performRequest = async <T = unknown>(
  params: SickWRequestParams,
): Promise<T> => {
  const apiKey = ensureEnv(env.sickwApiKey, "SICKW_API_KEY");
  const url = new URL(env.sickwBaseUrl);

  Object.entries({ key: apiKey, ...params }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new SickWApiError(
      `SickW request failed (${response.status}): ${body.slice(0, 200)}`,
      "UNKNOWN",
      response.status,
    );
  }

  return (await response.json()) as T;
};

export const querySickW = async (
  params: SickWQueryParams,
): Promise<NormalizedDeviceInfo> => {
  const fallbackServiceId =
    (params.serviceId ?? env.sickwDefaultServiceId)?.trim() ?? "";

  if (!fallbackServiceId) {
    throw new SickWApiError(
      "Missing SickW service ID. Provide one or set SICKW_DEFAULT_SERVICE_ID.",
      "S01_SERVICE_INVALID",
    );
  }

  const format: SickWFormat = params.format ?? "beta";
  const raw = await performRequest<SickWRawResponse>({
    format,
    imei: params.imei,
    service: fallbackServiceId,
  });

  const error = extractError(raw);
  if (error) {
    // If we get S02, verify the service actually exists to provide better context
    if (error.code === "S02_SERVICE_INCOMPATIBLE") {
      const validation = await validateServiceId(fallbackServiceId);
      if (validation.exists) {
        throw new SickWApiError(
          `Service #${fallbackServiceId} (${validation.name}) exists but doesn't support this device model. Try a different service or device.`,
          error.code,
          400,
        );
      }
    }
    throw new SickWApiError(error.message, error.code, error.code === "B01_LOW_BALANCE" ? 402 : 400);
  }

  return normalizePayload(raw, fallbackServiceId);
};

export const fetchSickWBalance = async (): Promise<{ balance: number | null }> => {
  const raw = await performRequest<{ balance?: string }>({ action: "balance" });
  return { balance: parseNumber(raw.balance) };
};

export const fetchSickWServices = async (): Promise<unknown> => {
  return performRequest({ action: "services", format: "json" });
};

export const validateServiceId = async (
  serviceId: string,
): Promise<{ exists: boolean; name?: string; price?: string }> => {
  try {
    const services = (await fetchSickWServices()) as {
      "Service List"?: Array<{ service: string; name: string; price?: string }>;
    };
    const list = services["Service List"];
    if (!Array.isArray(list)) {
      return { exists: false };
    }
    const found = list.find((s) => s.service === serviceId);
    return found
      ? { exists: true, name: found.name, price: found.price }
      : { exists: false };
  } catch {
    return { exists: false };
  }
};

