import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/sign/") ||
    pathname.startsWith("/reports/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms")
  ) {
    return NextResponse.next();
  }

  if (!req.cookies.get("segguinee_auth")?.value) {
    const url = new URL("/login", req.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|static|favicon\\.ico|.*\\.svg).*)"],
};
