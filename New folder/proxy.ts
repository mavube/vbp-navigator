import { NextRequest, NextResponse } from "next/server";
import { refreshSession } from "@/lib/supabase/middleware";

// v2.0: real per-user Supabase Auth replaces v1.0's shared passcode
// (that gate — APP_PASSCODE, app/api/login — is gone; see
// claude/vbp-navigator-standalone-app.md for why). If Supabase env vars
// aren't set, the app stays open — same "fine for local dev, set it
// before deploying" behavior v1.0 had.
//
// Named "proxy" (not "middleware") per Next.js 16's renamed convention.

export async function proxy(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // v3.0 roadmap Phase 4: /apply and /assess are the public,
  // unauthenticated entry points (§6-7), and /api/public/** is the
  // only API surface they're allowed to call — both need to stay
  // reachable with no session, same as /login and /auth already are.
  if (
    pathname === "/login" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/apply") ||
    pathname.startsWith("/assess") ||
    pathname.startsWith("/api/public")
  ) {
    return NextResponse.next();
  }

  const { response, user } = await refreshSession(req);
  if (user) return response;

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)"],
};
