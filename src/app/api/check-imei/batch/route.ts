import { NextResponse } from "next/server";
import { isValidImei, sanitizeImei } from "@/lib/imei";
import { SickWApiError } from "@/lib/sickw";
import { processLookup, type RequestBody } from "../handler";
import type { SickWErrorCode, CheckImeiResponse } from "@/types/imei";

type BatchBody = RequestBody & {
  imeis?: string[];
  delayMs?: number;
};

type BatchResult =
  | {
      imei: string;
      ok: true;
      source: CheckImeiResponse["source"];
      data: CheckImeiResponse["data"];
    }
  | {
      imei: string;
      ok: false;
      error: string;
      code?: SickWErrorCode;
    };

const jsonError = (message: string, status = 400, code?: SickWErrorCode) =>
  NextResponse.json({ error: message, code }, { status });

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    let body: BatchBody;
    try {
      body = (await req.json()) as BatchBody;
    } catch {
      return jsonError(
        "Invalid request body. Please send JSON with 'imeis' array.",
        400,
        "UNKNOWN",
      );
    }

    const rawImeis = Array.isArray(body.imeis) ? body.imeis : [];
    const cleaned = Array.from(
      new Set(
        rawImeis
          .map((value) => sanitizeImei(String(value ?? "")))
          .filter(Boolean),
      ),
    );

    if (cleaned.length === 0) {
      return jsonError("No IMEIs provided.", 400, "UNKNOWN");
    }

    if (cleaned.length > 50) {
      return jsonError("Batch limit is 50 IMEIs per request.", 400, "UNKNOWN");
    }

    const delayMs = Math.min(Math.max(body.delayMs ?? 350, 0), 2000);
    const results: BatchResult[] = [];

    for (let i = 0; i < cleaned.length; i += 1) {
      const candidate = cleaned[i];

      if (!isValidImei(candidate)) {
        results.push({
          imei: candidate,
          ok: false,
          error: "Please enter a valid IMEI (14-17 digits, passing Luhn).",
          code: "E01_INVALID_IMEI",
        });
        continue;
      }

      try {
        const payload = await processLookup(
          {
            ...body,
            imei: candidate,
          },
          { logPrefix: "check-imei-batch" },
        );

        results.push({
          imei: payload.data.imei,
          ok: true,
          source: payload.source,
          data: payload.data,
        });
      } catch (error) {
        if (error instanceof SickWApiError) {
          results.push({
            imei: candidate,
            ok: false,
            error: error.message,
            code: error.code,
          });
        } else {
          results.push({
            imei: candidate,
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to process IMEI lookup.",
            code: "UNKNOWN",
          });
        }
      }

      if (i < cleaned.length - 1 && delayMs > 0) {
        await delay(delayMs);
      }
    }

    return NextResponse.json({
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Failed to process batch IMEI lookup", error);
    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to process batch IMEI lookup.",
      500,
      "UNKNOWN",
    );
  }
}

