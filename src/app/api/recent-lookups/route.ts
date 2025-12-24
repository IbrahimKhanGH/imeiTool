import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import type { NormalizedDeviceInfo, RecentLookup } from "@/types/imei";
import type { Lookup } from "@prisma/client";
import { authOptions } from "@/lib/auth";

const serializeLookup = (lookup: Lookup): RecentLookup => {
  const data = lookup.resultJson as NormalizedDeviceInfo | null;

  return {
    id: lookup.id,
    imei: lookup.imei,
    serviceId: lookup.serviceId,
    serviceName: data?.serviceName ?? null,
    status: lookup.status as RecentLookup["status"],
    price: lookup.price ?? null,
    balance: lookup.balance ?? null,
    createdAt: lookup.createdAt.toISOString(),
    modelName: data?.modelName ?? null,
    carrier: data?.carrier ?? null,
    blacklistStatus: data?.blacklistStatus ?? null,
  };
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = (session?.user as any)?.tenantId;

    if (!session || !tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lookups = await prisma.lookup.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      where: { tenantId },
    });

    return NextResponse.json(lookups.map(serializeLookup));
  } catch (error) {
    console.error("Failed to fetch recent lookups", error);
    return NextResponse.json(
      { error: "Unable to load recent lookups." },
      { status: 500 },
    );
  }
}

