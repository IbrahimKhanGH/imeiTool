import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const tenantId = (session?.user as any)?.tenantId;

  if (!session || !tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const imei = url.searchParams.get("imei")?.trim();
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number.parseInt(limitParam ?? "5", 10) || 5, 1), 50);

  if (!imei) {
    return NextResponse.json({ error: "Missing imei query param" }, { status: 400 });
  }

  const records = await prisma.lookup.findMany({
    where: { tenantId, imei },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    data: records,
  });
}

