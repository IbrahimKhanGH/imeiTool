import { google, sheets_v4 } from "googleapis";
import type { NormalizedDeviceInfo } from "@/types/imei";
import { ensureEnv, env, isSheetsConfigured } from "./env";

let sheetsClient: sheets_v4.Sheets | null = null;

const getSheetsClient = async (): Promise<sheets_v4.Sheets> => {
  if (sheetsClient) {
    return sheetsClient;
  }

  const email = ensureEnv(
    env.googleServiceAccountEmail,
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  );
  const privateKey = ensureEnv(
    env.googleServiceAccountPrivateKey,
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  ).replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
};

const formatDateForSheet = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
};

const simplifyLockStatus = (value?: string): string => {
  if (!value) return "";
  const lower = value.toLowerCase();
  if (lower.includes("unlock") || lower.includes("unlocked")) return "Unlocked";
  if (lower.includes("lock")) return "Locked";
  return value;
};

const formatDailySheetTitle = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
  });
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
): Promise<void> => {
  if (!isSheetsConfigured() || info.status !== "success") {
    return;
  }

  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = ensureEnv(env.googleSheetsId, "GOOGLE_SHEETS_ID");
    const lockStatus = simplifyLockStatus(info.simLock);
    const costDisplay =
      typeof info.userCost === "number" && Number.isFinite(info.userCost)
        ? `$${info.userCost}`
        : "";
    const sheetTitle = formatDailySheetTitle(info.checkedAt);
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
            formatDateForSheet(info.checkedAt), // Date scanned
          ],
        ],
      },
    });
  } catch (error) {
    console.error("Failed to append lookup to Google Sheets", error);
  }
};

