import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";

const clampPageSize = (value: string | null): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) return 20;
  return Math.min(Math.max(parsed, 1), 100);
};

const parseCursor = (raw: string | null): number | null => {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const tenantId = (session?.user as any)?.tenantId;

  if (!session || !tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const searchParams = url.searchParams;

  const cursor = parseCursor(searchParams.get("cursor"));
  const direction = searchParams.get("direction") === "prev" ? "prev" : "next";
  const pageSize = clampPageSize(searchParams.get("pageSize"));
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status")?.trim();
  const grade = searchParams.get("grade")?.trim();
  const carrier = searchParams.get("carrier")?.trim();
  const model = searchParams.get("model")?.trim();
  const startDate = searchParams.get("startDate")?.trim();
  const endDate = searchParams.get("endDate")?.trim();
  const serialOnly = searchParams.get("serialOnly") === "true";

  const where: Prisma.LookupWhereInput = { tenantId } as any;
  if (status) (where as any).status = status;
  if (grade) (where as any).userGrade = grade;
  if (carrier) (where as any).carrier = { contains: carrier, mode: "insensitive" };
  if (model) (where as any).modelName = { contains: model, mode: "insensitive" };
  if (serialOnly) (where as any).serial = true;

  if (search) {
    where.OR = [
      { imei: { contains: search, mode: "insensitive" } },
      { modelName: { contains: search, mode: "insensitive" } as any },
      { carrier: { contains: search, mode: "insensitive" } as any },
      { serviceName: { contains: search, mode: "insensitive" } as any },
    ] as any;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      if (!Number.isNaN(start.getTime())) {
        where.createdAt.gte = start;
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!Number.isNaN(end.getTime())) {
        where.createdAt.lte = end;
      }
    }
  }

  const takeSigned = direction === "prev" ? -(pageSize + 1) : pageSize + 1;
  const records = await prisma.lookup.findMany({
    where,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    take: takeSigned,
    select: {
      id: true,
      imei: true,
      serial: true,
      serviceId: true,
      serviceName: true,
      source: true,
      status: true,
      userGrade: true,
      userCost: true,
      carrier: true,
      modelName: true,
      blacklistStatus: true,
      simLock: true,
      purchaseCountry: true,
      checkedAt: true,
      createdAt: true,
      resultJson: true,
    } as any,
  });

  let items = records;
  let hasMoreNext = false;
  let hasMorePrev = false;

  if (direction === "prev") {
    items = items.reverse();
    hasMorePrev = items.length > pageSize;
    if (hasMorePrev) {
      items = items.slice(1);
    }
    hasMoreNext = Boolean(cursor);
  } else {
    hasMoreNext = items.length > pageSize;
    if (hasMoreNext) {
      items = items.slice(0, pageSize);
    }
    hasMorePrev = Boolean(cursor);
  }

  const nextCursor = hasMoreNext ? items[items.length - 1]?.id ?? null : null;
  const prevCursor = hasMorePrev ? items[0]?.id ?? null : null;

  return NextResponse.json({
    data: items,
    nextCursor,
    prevCursor,
  });
}

