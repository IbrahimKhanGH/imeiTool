import { prisma } from "@/lib/db";
import { sanitizeImei, isValidImei } from "@/lib/imei";
import { appendToSheet } from "@/lib/sheets";
import { querySickW, SickWApiError, rehydrateNormalized } from "@/lib/sickw";
import { SICKW_SERVICES, type SickWServiceKey } from "@/config/sickwServices";
import type {
  CheckImeiResponse,
  NormalizedDeviceInfo,
  SickWErrorCode,
} from "@/types/imei";
import type { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { decryptField } from "@/lib/crypto";

export type RequestBody = {
  imei?: string;
  serviceId?: string;
  serviceKey?: SickWServiceKey;
  grade?: string;
  cost?: number;
  serialMode?: boolean;
};

type LookupContext = {
  tenantId: string;
  userId: string;
};

export const resolveServiceId = (body: RequestBody): string | undefined => {
  if (body.serviceId?.trim()) {
    return body.serviceId.trim();
  }

  if (body.serviceKey && SICKW_SERVICES[body.serviceKey]) {
    return SICKW_SERVICES[body.serviceKey].id;
  }

  return env.sickwDefaultServiceId?.trim();
};

export const processLookup = async (
  body: RequestBody,
  context: LookupContext,
  opts?: { now?: Date; logPrefix?: string },
): Promise<CheckImeiResponse> => {
  const now = opts?.now ?? new Date();
  const logPrefix = opts?.logPrefix ?? "check-imei";
  const t0 = Date.now();
  const logStep = (label: string) => {
    const delta = Date.now() - t0;
    console.log(`[${logPrefix}] ${label} +${delta}ms`);
  };

  let imei = "";
  let serviceId: string | undefined;
  const isSerial = Boolean(body.serialMode);

  try {
    imei = isSerial
      ? (body.imei ?? "").trim().toUpperCase()
      : sanitizeImei(body.imei ?? "");

    if (isSerial) {
      if (!imei || imei.length < 5 || imei.length > 40) {
        throw new SickWApiError(
          "Please enter a valid serial (5-40 characters).",
          "E02_INVALID_SN",
          400,
        );
      }
      logStep("validated-serial");
    } else {
      if (!isValidImei(imei)) {
        throw new SickWApiError(
          "Please enter a valid IMEI (14-17 digits, passing Luhn).",
          "E01_INVALID_IMEI",
          400,
        );
      }
      logStep("validated-imei");
    }

    serviceId = resolveServiceId(body);
    if (!serviceId) {
      throw new SickWApiError(
        "Missing SickW service ID. Please configure SICKW_DEFAULT_SERVICE_ID.",
        "S01_SERVICE_INVALID",
        400,
      );
    }

    const cached = await prisma.lookup.findFirst({
      where: { imei, serviceId, status: "success", tenantId: context.tenantId },
      orderBy: { createdAt: "desc" },
    });
    logStep("checked-cache");

    if (cached?.resultJson) {
      const data = cached.resultJson as NormalizedDeviceInfo;
      const hydrated = rehydrateNormalized(data, serviceId);

      if (typeof body.grade === "string") {
        hydrated.userGrade = body.grade.trim() || hydrated.userGrade;
      }
      if (typeof body.cost === "number" && !Number.isNaN(body.cost)) {
        hydrated.userCost = body.cost;
      }

      await appendToSheet(hydrated, {
        syncToSheets: true,
      });
      logStep("cache-hit-sheets-append");

      return { source: "cache", data: hydrated };
    }

    logStep("calling-sickw");
    const credential = await prisma.credential.findUnique({
      where: { tenantId: context.tenantId },
    });

    const apiKey = decryptField(credential?.sickwKeyEnc) || env.sickwApiKey;

    const fresh = await querySickW(
      {
        imei,
        serviceId,
        format: "beta",
      },
      { apiKey },
    );
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
        serial: isSerial,
        serviceId: fresh.serviceId,
        serviceName: fresh.serviceName ?? null,
        source: "live",
        status: fresh.status,
        price: fresh.providerPrice ?? null,
        balance: fresh.providerBalanceAfter ?? null,
        userGrade: fresh.userGrade ?? null,
        userCost: fresh.userCost ?? null,
        carrier: fresh.carrier ?? null,
        modelName: fresh.modelName ?? null,
        blacklistStatus: fresh.blacklistStatus ?? null,
        simLock: fresh.simLock ?? null,
        purchaseCountry: fresh.purchaseCountry ?? null,
        checkedAt: new Date(fresh.checkedAt),
        tenantId: context.tenantId,
        userId: context.userId,
        resultJson,
      },
    });
    logStep("db-write");

    await appendToSheet(fresh, {
      syncToSheets: credential?.syncToSheets ?? true,
      sheetsId: decryptField(credential?.googleSheetsIdEnc) ?? undefined,
      serviceAccountEmail:
        decryptField(credential?.googleServiceAccountEmailEnc) ?? undefined,
      serviceAccountPrivateKey:
        decryptField(credential?.googleServiceAccountPrivateKeyEnc) ?? undefined,
      tab: credential?.defaultTab ?? undefined,
      timezone: credential?.timezone ?? "America/Chicago",
    });
    logStep("sheets-append");

    return {
      source: "live",
      data: fresh,
    };
  } catch (error) {
    console.error(`[${logPrefix}] Failed lookup`, error);

    if (error instanceof SickWApiError) {
      try {
        await prisma.lookup.create({
          data: {
            imei,
            serial: isSerial,
            serviceId: serviceId ?? env.sickwDefaultServiceId ?? "",
            serviceName: null,
            source: "error",
            status: "error",
            price: null,
            balance: null,
            userGrade:
              typeof body.grade === "string" ? body.grade.trim() || null : null,
            userCost:
              typeof body.cost === "number" && !Number.isNaN(body.cost)
                ? body.cost
                : null,
            carrier: null,
            modelName: null,
            blacklistStatus: null,
            simLock: null,
            purchaseCountry: null,
            checkedAt: now,
            tenantId: context.tenantId,
            userId: context.userId,
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

      throw error;
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : "Unable to process IMEI lookup right now.",
    );
  }
};


