import { NextResponse } from "next/server";
import type { SickWErrorCode } from "@/types/imei";
import { processLookup, type RequestBody } from "./handler";
import { SickWApiError } from "@/lib/sickw";

const jsonError = (message: string, status = 400, code?: SickWErrorCode) =>
  NextResponse.json({ error: message, code }, { status });

export async function POST(req: Request) {
  try {
    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return jsonError(
        "Invalid request body. Please send JSON with 'imei' field.",
        400,
        "UNKNOWN",
      );
    }

    const payload = await processLookup(body, {
      logPrefix: "check-imei",
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to process IMEI lookup", error);
    if (error instanceof SickWApiError) {
      return jsonError(error.message, error.status ?? 400, error.code);
    }

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to process IMEI lookup right now.",
      500,
      "UNKNOWN",
    );
  }
}

