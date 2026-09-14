import { NextRequest, NextResponse } from "next/server";

// Lightweight shared-passcode gate for a small internal team (Jennifer,
// Edwin, Anne, Twesa, Diallo) — not real per-user authentication. If
// APP_PASSCODE isn't set, the app is open (fine for local dev / a private
// preview URL). Set it once you deploy somewhere reachable by anyone with
// the link.
//
// This is deliberately simple: one shared password, one cookie, no user
// accounts. If per-person accounts or roles are ever needed, swap this for
// NextAuth or similar — nothing else in the app assumes this approach.
//
// Named "proxy" (not "middleware") per Next.js 16's renamed convention.

const COOKIE_NAME = "vbp_auth";

export function proxy(req: NextRequest) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie === passcode) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
