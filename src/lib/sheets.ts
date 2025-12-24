import { google, sheets_v4 } from "googleapis";
import type { NormalizedDeviceInfo } from "@/types/imei";
import { ensureEnv, env, isSheetsConfigured } from "./env";

export type SheetsConfig = {
  syncToSheets?: boolean;
  sheetsId?: string;
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
  tab?: string;
  timezone?: string;
};

const getSheetsClient = async (
  config?: SheetsConfig,
): Promise<sheets_v4.Sheets> => {
  const email =
    config?.serviceAccountEmail ??
    ensureEnv(env.googleServiceAccountEmail, "GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey =
    config?.serviceAccountPrivateKey ??
    ensureEnv(
      env.googleServiceAccountPrivateKey,
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    );

  const auth = new google.auth.JWT({
    email,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
};

const formatDateForSheet = (iso: string, timezone?: string): string => {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone ?? "America/Chicago",
  });
};

const simplifyLockStatus = (value?: string): string => {
  if (!value) return "";
  const lower = value.toLowerCase();
  if (lower.includes("unlock") || lower.includes("unlocked")) return "Unlocked";
  if (lower.includes("lock")) return "Locked";
  return value;
};

const formatDailySheetTitle = (iso: string, timezone?: string): string => {
  const date = new Date(iso);
  const title = date.toLocaleString("en-US", {
    timeZone: timezone ?? "America/Chicago",
    month: "long",
    day: "numeric",
  });
  return title.toUpperCase();
};

const ensureSheetExists = async (
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string,
  headers: string[],
) => {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });

  const exists = meta.data.sheets?.some(
    (sheet) => sheet.properties?.title === title,
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title },
            },
          },
        ],
      },
    });

    // Seed headers on the new sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${title}'!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] },
    });
  }
};

export const appendToSheet = async (
  info: NormalizedDeviceInfo,
  config?: SheetsConfig,
): Promise<void> => {
  const shouldSync = config?.syncToSheets ?? true;
  const sheetsId = config?.sheetsId ?? env.googleSheetsId;
  const saEmail = config?.serviceAccountEmail ?? env.googleServiceAccountEmail;
  const saKey =
    config?.serviceAccountPrivateKey ?? env.googleServiceAccountPrivateKey;

  if (
    !shouldSync ||
    info.status !== "success" ||
    !(sheetsId && saEmail && saKey)
  ) {
    return;
  }

  try {
    const sheets = await getSheetsClient(config);
    const spreadsheetId = sheetsId;
    const lockStatus = simplifyLockStatus(info.simLock);
    const costDisplay =
      typeof info.userCost === "number" && Number.isFinite(info.userCost)
        ? `$${info.userCost}`
        : "";
    const sheetTitle =
      (config?.tab && config.tab.trim().length > 0
        ? config.tab.trim()
        : formatDailySheetTitle(info.checkedAt, config?.timezone)) ||
      formatDailySheetTitle(info.checkedAt, config?.timezone);
    const headers = [
      "Product",
      "Storage",
      "Grade",
      "IMEI/SN",
      "Cost",
      "Carrier",
      "Lock Status",
      "Date",
    ];

    await ensureSheetExists(sheets, spreadsheetId, sheetTitle, headers);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetTitle}'!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            info.modelName ?? info.description ?? "", // Product
            info.storage ?? "", // Storage
            info.userGrade ?? "", // Grade (user-supplied)
            info.imei, // IMEI
            costDisplay, // Our cost (user-supplied)
            info.carrier ?? "", // Carrier
            lockStatus, // Lock Status
            formatDateForSheet(info.checkedAt, config?.timezone), // Date scanned
          ],
        ],
      },
    });
  } catch (error) {
    console.error("Failed to append lookup to Google Sheets", error);
  }
};

