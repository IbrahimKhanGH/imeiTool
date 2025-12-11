type EnvMap = {
  SICKW_API_KEY: string;
  SICKW_DEFAULT_SERVICE_ID: string;
  SICKW_API_BASE_URL?: string;
  GOOGLE_SHEETS_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
};

const DEFAULT_SICKW_BASE_URL = "https://sickw.com/api.php";

const get = (key: keyof EnvMap): string | undefined => {
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }

  return process.env[key];
};

export const env = {
  sickwApiKey: get("SICKW_API_KEY") ?? "",
  sickwDefaultServiceId: get("SICKW_DEFAULT_SERVICE_ID") ?? "",
  sickwBaseUrl: get("SICKW_API_BASE_URL") ?? DEFAULT_SICKW_BASE_URL,
  googleSheetsId: get("GOOGLE_SHEETS_ID") ?? "",
  googleServiceAccountEmail: get("GOOGLE_SERVICE_ACCOUNT_EMAIL") ?? "",
  googleServiceAccountPrivateKey:
    get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY") ?? "",
} as const;

export const isSheetsConfigured = (): boolean =>
  Boolean(
    env.googleSheetsId &&
      env.googleServiceAccountEmail &&
      env.googleServiceAccountPrivateKey,
  );

export const ensureEnv = (value: string, name: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};



