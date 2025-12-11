import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sanitizeImei, isValidImei } from "@/lib/imei";
import { appendToSheet } from "@/lib/sheets";
import { querySickW, SickWApiError, rehydrateNormalized } from "@/lib/sickw";
import { SICKW_SERVICES, type SickWServiceKey } from "@/config/sickwServices";
import type {
  NormalizedDeviceInfo,
  CheckImeiResponse,
  SickWErrorCode,
} from "@/types/imei";
import type { Prisma } from "@prisma/client";
import { env } from "@/lib/env";

type RequestBody = {
  imei?: string;
  serviceId?: string;
  serviceKey?: SickWServiceKey;
  grade?: string;
  cost?: number;
};

const jsonError = (message: string, status = 400, code?: SickWErrorCode) =>
  NextResponse.json({ error: message, code }, { status });

const resolveServiceId = (body: RequestBody): string | undefined => {
  if (body.serviceId?.trim()) {
    return body.serviceId.trim();
  }

  if (body.serviceKey && SICKW_SERVICES[body.serviceKey]) {
    return SICKW_SERVICES[body.serviceKey].id;
  }

  return env.sickwDefaultServiceId?.trim();
};

export async function POST(req: Request) {
  const now = new Date();
  let imei = "";
  let serviceId: string | undefined;

  const t0 = Date.now();
  const logStep = (label: string) => {
    const delta = Date.now() - t0;
    console.log(`[check-imei] ${label} +${delta}ms`);
  };

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
    logStep("parsed-body");

    imei = sanitizeImei(body.imei ?? "");

    if (!isValidImei(imei)) {
      return jsonError(
        "Please enter a valid IMEI (14-17 digits, passing Luhn).",
        400,
        "E01_INVALID_IMEI",
      );
    }
    logStep("validated-imei");

    serviceId = resolveServiceId(body);

    if (!serviceId) {
      return jsonError(
        "Missing SickW service ID. Please configure SICKW_DEFAULT_SERVICE_ID.",
        400,
        "S01_SERVICE_INVALID",
      );
    }

    const cached = await prisma.lookup.findFirst({
      where: { imei, serviceId, status: "success" },
      orderBy: { createdAt: "desc" },
    });
    logStep("checked-cache");

    if (cached?.resultJson) {
      const data = cached.resultJson as NormalizedDeviceInfo;
      const hydrated = rehydrateNormalized(data, serviceId);
      const payload: CheckImeiResponse = { source: "cache", data: hydrated };
      logStep("cache-hit-return");
      return NextResponse.json(payload);
    }

    logStep("calling-sickw");
    const fresh = await querySickW({
      imei,
      serviceId,
      format: "beta",
    });
    logStep("sickw-complete");

    if (typeof body.grade === "string") {
      fresh.userGrade = body.grade.trim() || undefined;
    }
    if (typeof body.cost === "number" && !Number.isNaN(body.cost)) {
      fresh.userCost = body.cost;
    }

    const resultJson = JSON.parse(
      JSON.stringify(fresh),
    ) as Prisma.InputJsonValue;

    await prisma.lookup.create({
      data: {
        imei,
        serviceId: fresh.serviceId,
        status: fresh.status,
        price: fresh.providerPrice ?? null,
        balance: fresh.providerBalanceAfter ?? null,
        resultJson,
      },
    });
    logStep("db-write");

    await appendToSheet(fresh);
    logStep("sheets-append");

    const payload: CheckImeiResponse = {
      source: "live",
      data: fresh,
    };

    logStep("response-ready");
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to process IMEI lookup", error);
    if (error instanceof SickWApiError) {
      try {
        await prisma.lookup.create({
          data: {
            imei,
            serviceId: serviceId ?? env.sickwDefaultServiceId ?? "",
            status: "error",
            price: null,
            balance: null,
            resultJson: {
              code: error.code,
              message: error.message,
              timestamp: now.toISOString(),
            },
          },
        });
      } catch (dbError) {
        console.warn("Failed to persist SickW error", dbError);
      }

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

