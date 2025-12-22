import { NextResponse } from "next/server";
import { google } from "googleapis";
import { fetchSickWBalance } from "@/lib/sickw";
import { env, isSheetsConfigured } from "@/lib/env";

type HealthStatus = "ok" | "not_configured" | "degraded" | "error";

export async function GET() {
  const sickw: {
    status: HealthStatus;
    message?: string;
    balance?: number | null;
    defaultServiceId?: string;
  } = {
    status: env.sickwApiKey ? "degraded" : "not_configured",
    defaultServiceId: env.sickwDefaultServiceId || undefined,
  };

  const sheets: {
    status: HealthStatus;
    message?: string;
    tab?: string;
  } = {
    status: isSheetsConfigured() ? "degraded" : "not_configured",
    tab: env.googleSheetsTab || undefined,
  };

  // Check SickW balance (lightweight GET)
  if (env.sickwApiKey) {
    try {
      const { balance } = await fetchSickWBalance();
      sickw.status = "ok";
      sickw.balance = balance ?? null;
    } catch (error) {
      sickw.status = "error";
      sickw.message =
        error instanceof Error ? error.message : "Failed to reach SickW.";
    }
  }

  // Check Sheets auth (metadata only, no writes)
  if (isSheetsConfigured()) {
    try {
      const auth = new google.auth.JWT({
        email: env.googleServiceAccountEmail,
        key: env.googleServiceAccountPrivateKey.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
      const sheetsClient = google.sheets({ version: "v4", auth });
      await sheetsClient.spreadsheets.get({
        spreadsheetId: env.googleSheetsId,
        fields: "spreadsheetId",
      });
      sheets.status = "ok";
    } catch (error) {
      sheets.status = "error";
      sheets.message =
        error instanceof Error ? error.message : "Failed to reach Sheets.";
    }
  }

  return NextResponse.json({
    sickw,
    sheets,
    serverTime: new Date().toISOString(),
    env: {
      sickwConfigured: Boolean(env.sickwApiKey),
      sheetsConfigured: isSheetsConfigured(),
      defaultServiceId: env.sickwDefaultServiceId || null,
      timezone: "America/Chicago",
    },
  });
}

