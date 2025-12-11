export type SickWRawResponse = {
  result?: Record<string, unknown> | string;
  imei: string;
  balance?: string;
  price?: string;
  service?: string;
  id?: string;
  status: "success" | "error";
  message?: string;
  error?: string;
};

export type SickWErrorCode =
  | "E01_INVALID_IMEI"
  | "E02_INVALID_SN"
  | "R01_NOT_FOUND"
  | "B01_LOW_BALANCE"
  | "S01_SERVICE_INVALID"
  | "S02_SERVICE_INCOMPATIBLE"
  | "A01_API_KEY_INVALID"
  | "UNKNOWN";

export type SickWError = {
  code: SickWErrorCode;
  message: string;
  rawMessage?: string;
};

export type LookupStatus = "success" | "error";

export type NormalizedDeviceInfo = {
  imei: string;
  serviceId: string;
  serviceName?: string;
  status: LookupStatus;
  userGrade?: string;
  userCost?: number | null;
  manufacturer?: string;
  modelName?: string;
  modelCode?: string;
  description?: string;
  fmiStatus?: string;
  icloudLock?: string;
  blacklistStatus?: string;
  carrier?: string;
  purchaseCountry?: string;
  simLock?: string;
  providerPrice?: number | null;
  providerBalanceAfter?: number | null;
  rawResult: Record<string, unknown> | string | null;
  rawResponse?: SickWRawResponse;
  checkedAt: string;
  extraFields?: Record<string, string>;
  error?: SickWError;
};

export type CheckImeiResponse = {
  source: "cache" | "live";
  data: NormalizedDeviceInfo;
};

export type ApiErrorResponse = {
  error: string;
  code?: SickWErrorCode;
};

export type RecentLookup = {
  id: number;
  imei: string;
  serviceId: string;
  serviceName?: string | null;
  status: LookupStatus;
  price?: number | null;
  balance?: number | null;
  createdAt: string;
  modelName?: string | null;
  carrier?: string | null;
  blacklistStatus?: string | null;
};

