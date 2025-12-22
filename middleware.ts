import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow auth endpoints without checks
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Protect app routes and API routes
  const isProtected =
    pathname.startsWith("/app") || pathname.startsWith("/api");

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = await getToken({ req });
  if (!token) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = "/login";
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/api/:path*"],
};

