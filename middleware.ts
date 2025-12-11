import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const APP_TOKEN = process.env.APP_ACCESS_TOKEN;

const isPublicPath = (pathname: string) =>
  pathname.startsWith("/_next") ||
  pathname.startsWith("/favicon") ||
  pathname.startsWith("/robots.txt") ||
  pathname.startsWith("/sitemap.xml") ||
  pathname.startsWith("/gate");

export function middleware(req: NextRequest) {
  if (!APP_TOKEN) {
    // Gate disabled if no token configured
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get("app_token")?.value;

  if (token === APP_TOKEN) {
    return NextResponse.next();
  }

  // If API, return 401; otherwise redirect to gate.
  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

