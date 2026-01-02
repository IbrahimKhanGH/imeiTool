import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { decryptField, encryptField } from "@/lib/crypto";

const requireSession = async () => {
  const session = await getServerSession(authOptions);
  const tenantId = (session?.user as any)?.tenantId;
  const userId = (session?.user as any)?.id;
  const role = (session?.user as any)?.role;
  if (!session || !tenantId || !userId) {
    return { error: "Unauthorized", status: 401 as const };
  }
  if (role !== "admin") {
    return { error: "Admins only", status: 403 as const };
  }
  return { tenantId };
};

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { tenantId } = auth;

  const cred = await prisma.credential.findUnique({
    where: { tenantId },
  });
  const credAny = cred as any;

  return NextResponse.json({
    sickwKey: decryptField(cred?.sickwKeyEnc) ?? "",
    googleSheetsId: decryptField(cred?.googleSheetsIdEnc) ?? "",
    googleServiceAccountEmail: decryptField(cred?.googleServiceAccountEmailEnc) ?? "",
    googleServiceAccountPrivateKey: decryptField(cred?.googleServiceAccountPrivateKeyEnc) ?? "",
    defaultTab: cred?.defaultTab ?? "",
    timezone: cred?.timezone ?? "America/Chicago",
    syncToSheets: cred?.syncToSheets ?? true,
    autoMonthlySheets: credAny?.autoMonthlySheets ?? false,
    monthlySheetPrefix: credAny?.monthlySheetPrefix ?? "",
    currentSheetMonth: credAny?.currentSheetMonth ?? null,
    currentSheetId: decryptField(credAny?.currentSheetIdEnc) ?? null,
    currentSheetUrl: credAny?.currentSheetIdEnc
      ? `https://docs.google.com/spreadsheets/d/${decryptField(credAny.currentSheetIdEnc)}/edit`
      : null,
    autoShareEmails:
      credAny?.monthlyShareEmailsEnc &&
      decryptField(credAny.monthlyShareEmailsEnc)
        ?.split(",")
        .map((e) => e.trim())
        .filter(Boolean),
  });
}

export async function PUT(req: Request) {
  const auth = await requireSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { tenantId } = auth;

  let body: {
    sickwKey?: string;
    googleSheetsId?: string;
    googleServiceAccountEmail?: string;
    googleServiceAccountPrivateKey?: string;
    defaultTab?: string;
    timezone?: string;
    syncToSheets?: boolean;
    autoMonthlySheets?: boolean;
    monthlySheetPrefix?: string;
    autoShareEmails?: string[];
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = {
    sickwKeyEnc: encryptField(body.sickwKey?.trim() || null),
    googleSheetsIdEnc: encryptField(body.googleSheetsId?.trim() || null),
    googleServiceAccountEmailEnc: encryptField(
      body.googleServiceAccountEmail?.trim() || null,
    ),
    googleServiceAccountPrivateKeyEnc: encryptField(
      body.googleServiceAccountPrivateKey?.trim() || null,
    ),
    defaultTab: body.defaultTab?.trim() || null,
    timezone: body.timezone?.trim() || "America/Chicago",
    syncToSheets: body.syncToSheets ?? true,
    autoMonthlySheets: body.autoMonthlySheets ?? false,
    monthlySheetPrefix: body.monthlySheetPrefix?.trim() || null,
    monthlyShareEmailsEnc: encryptField(
      (body.autoShareEmails ?? [])
        .map((e) => e.trim())
        .filter(Boolean)
        .join(",") || null,
    ),
  };

  const updated = await prisma.credential.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data as any,
  });
  const updatedAny = updated as any;

  return NextResponse.json({
    sickwKey: decryptField(updated.sickwKeyEnc) ?? "",
    googleSheetsId: decryptField(updated.googleSheetsIdEnc) ?? "",
    googleServiceAccountEmail: decryptField(updated.googleServiceAccountEmailEnc) ?? "",
    googleServiceAccountPrivateKey:
      decryptField(updated.googleServiceAccountPrivateKeyEnc) ?? "",
    defaultTab: updated.defaultTab ?? "",
    timezone: updated.timezone ?? "America/Chicago",
    syncToSheets: updated.syncToSheets,
    autoMonthlySheets: updatedAny?.autoMonthlySheets ?? false,
    monthlySheetPrefix: updatedAny?.monthlySheetPrefix ?? "",
    currentSheetMonth: updatedAny?.currentSheetMonth ?? null,
    currentSheetId: decryptField(updatedAny.currentSheetIdEnc) ?? null,
    currentSheetUrl: updatedAny.currentSheetIdEnc
      ? `https://docs.google.com/spreadsheets/d/${decryptField(updatedAny.currentSheetIdEnc)}/edit`
      : null,
    autoShareEmails:
      updatedAny?.monthlyShareEmailsEnc &&
      decryptField(updatedAny.monthlyShareEmailsEnc)
        ?.split(",")
        .map((e) => e.trim())
        .filter(Boolean),
  });
}

