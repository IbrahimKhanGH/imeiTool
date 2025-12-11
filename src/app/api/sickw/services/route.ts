import { NextResponse } from "next/server";
import { fetchSickWServices, SickWApiError } from "@/lib/sickw";

export async function GET() {
  try {
    const payload = await fetchSickWServices();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to fetch SickW services", error);
    if (error instanceof SickWApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Unable to fetch SickW services." },
      { status: 500 },
    );
  }
}




