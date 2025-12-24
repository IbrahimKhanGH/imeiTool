import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { SickWErrorCode } from "@/types/imei";
import { processLookup, type RequestBody } from "./handler";
import { SickWApiError } from "@/lib/sickw";
import { authOptions } from "@/lib/auth";

const jsonError = (message: string, status = 400, code?: SickWErrorCode) =>
  NextResponse.json({ error: message, code }, { status });

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = (session?.user as any)?.tenantId;
    const userId = (session?.user as any)?.id;

    if (!session || !tenantId || !userId) {
      return jsonError("Unauthorized", 401, "UNKNOWN");
    }

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

    const payload = await processLookup(
      body,
      { tenantId, userId },
      {
        logPrefix: "check-imei",
      },
    );

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

