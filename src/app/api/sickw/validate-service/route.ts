import { NextResponse } from "next/server";
import { validateServiceId, SickWApiError } from "@/lib/sickw";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("serviceId");

    if (!serviceId) {
      return NextResponse.json(
        { error: "Missing serviceId parameter" },
        { status: 400 },
      );
    }

    const result = await validateServiceId(serviceId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to validate service", error);
    if (error instanceof SickWApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Unable to validate service." },
      { status: 500 },
    );
  }
}

