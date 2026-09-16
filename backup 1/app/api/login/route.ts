import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "vbp_auth";

export async function POST(req: NextRequest) {
  const passcode = process.env.APP_PASSCODE;
  const body = await req.json().catch(() => ({}));

  if (!passcode) {
    return NextResponse.json({ ok: true });
  }
  if (body.passcode !== passcode) {
    return NextResponse.json({ ok: false, error: "Incorrect passcode" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, passcode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
