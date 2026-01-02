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
  autoMonthlySheets?: boolean;
  monthlySheetPrefix?: string;
  currentSheetMonth?: string | null;
  currentSheetId?: string | null;
  autoShareEmails?: string[] | null;
  onMonthlySheetChange?: (args: {
    monthKey: string;
    sheetId: string;
    spreadsheetTitle: string;
  }) => Promise<void> | void;
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
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  return google.sheets({ version: "v4", auth });
};

const getDriveClient = async (config?: SheetsConfig) => {
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
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
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

const formatMonthKey = (iso: string, timezone?: string): string => {
  const date = new Date(iso);
  const year = date.toLocaleString("en-US", {
    timeZone: timezone ?? "America/Chicago",
    year: "numeric",
  });
  const month = date.toLocaleString("en-US", {
    timeZone: timezone ?? "America/Chicago",
    month: "2-digit",
  });
  return `${year}-${month}`;
};

const createSpreadsheet = async (
  sheets: sheets_v4.Sheets,
  title: string,
): Promise<string> => {
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
    },
    fields: "spreadsheetId",
  });
  const spreadsheetId = res.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("Failed to create spreadsheet");
  }
  return spreadsheetId;
};

const shareSpreadsheetIfNeeded = async (
  spreadsheetId: string,
  emails?: string[] | null,
  config?: SheetsConfig,
) => {
  if (!emails || emails.length === 0) return;
  const drive = await getDriveClient(config);
  for (const email of emails) {
    const trimmed = email.trim();
    if (!trimmed) continue;
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        sendNotificationEmail: false,
        requestBody: {
          type: "user",
          role: "writer",
          emailAddress: trimmed,
        },
      });
    } catch (err) {
      console.error("Failed to share spreadsheet with", trimmed, err);
    }
  }
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
  const saEmail = config?.serviceAccountEmail ?? env.googleServiceAccountEmail;
  const saKey =
    config?.serviceAccountPrivateKey ?? env.googleServiceAccountPrivateKey;

  if (
    !shouldSync ||
    info.status !== "success" ||
    !(saEmail && saKey)
  ) {
    return;
  }

  try {
    let sheets: sheets_v4.Sheets | null = null;
    const getClient = async () => {
      if (!sheets) {
        sheets = await getSheetsClient(config);
      }
      return sheets;
    };

    const monthKey = config?.autoMonthlySheets
      ? formatMonthKey(info.checkedAt, config?.timezone)
      : undefined;

    // If auto-monthly is on, force month-specific handling (do not use base Sheet ID).
    let spreadsheetId = config?.autoMonthlySheets
      ? undefined
      : config?.sheetsId ?? env.googleSheetsId ?? config?.currentSheetId ?? undefined;

    if (config?.autoMonthlySheets) {
      const hasCurrent =
        config.currentSheetMonth === monthKey && config.currentSheetId;
      if (hasCurrent) {
        spreadsheetId = config.currentSheetId ?? spreadsheetId;
      } else {
        const client = await getClient();
        const spreadsheetTitle = `${
          config?.monthlySheetPrefix?.trim() || "Lookups"
        } - ${monthKey}`;
        spreadsheetId = await createSpreadsheet(client, spreadsheetTitle);
        await shareSpreadsheetIfNeeded(
          spreadsheetId,
          config?.autoShareEmails,
          config,
        );
        if (config?.onMonthlySheetChange) {
          await config.onMonthlySheetChange({
            monthKey: monthKey ?? "",
            sheetId: spreadsheetId,
            spreadsheetTitle,
          });
        }
      }
    }

    if (!spreadsheetId) {
      return;
    }

    const sheetsClient = await getClient();
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

    await ensureSheetExists(sheetsClient, spreadsheetId, sheetTitle, headers);

    await sheetsClient.spreadsheets.values.append({
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

