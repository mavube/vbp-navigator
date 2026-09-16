import { NextRequest, NextResponse } from "next/server";
import { listCompensationEntries, createCompensationEntry } from "@/lib/db-compensation";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/compensation?serviceId=... — compensation entries for the
// caller's org, optionally filtered to one service (normally just the
// Compensation Earning Service, but the field isn't hardcoded to it).
export async function GET(req: NextRequest) {
  const ctx = await getUserContext();
  const serviceId = req.nextUrl.searchParams.get("serviceId") ?? undefined;
  const entries = await listCompensationEntries(ctx.orgId, serviceId);
  return NextResponse.json(entries);
}

// POST /api/compensation — create a draft entry for one person, one pay
// period. Deductions and Net Pay are computed server-side from the
// org's configured rates (lib/payroll.ts) — the client only supplies
// Basic Pay and Allowances. Gated to that service's owner/contributor
// or an Org Admin (Jennifer runs this process — alignment doc Section
// 7); finalizing is a separate, more restricted step (see [id]/route.ts).
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  const body = await req.json().catch(() => ({}));

  if (typeof body.serviceId !== "string" || !body.serviceId) {
    return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
  }
  if (typeof body.employeeName !== "string" || !body.employeeName.trim()) {
    return NextResponse.json({ error: "employeeName is required" }, { status: 400 });
  }
  if (typeof body.period !== "string" || !/^\d{4}-\d{2}$/.test(body.period)) {
    return NextResponse.json({ error: "period must be in 'YYYY-MM' form" }, { status: 400 });
  }
  const basicPay = Number(body.basicPay);
  if (!Number.isFinite(basicPay) || basicPay < 0) {
    return NextResponse.json({ error: "basicPay must be a non-negative number" }, { status: 400 });
  }
  const allowances = Array.isArray(body.allowances)
    ? body.allowances
        .filter((a: unknown): a is { name: unknown; amount: unknown } => typeof a === "object" && a !== null)
        .map((a: { name: unknown; amount: unknown }) => ({
          name: typeof a.name === "string" ? a.name.slice(0, 100) : "Allowance",
          amount: Number(a.amount) || 0,
        }))
    : [];

  if (!canManageService(ctx, body.serviceId)) {
    return NextResponse.json({ error: "Not allowed to create a compensation entry for this service" }, { status: 403 });
  }

  const entry = await createCompensationEntry(ctx.orgId, {
    serviceId: body.serviceId,
    employeeId: typeof body.employeeId === "string" ? body.employeeId : null,
    employeeName: body.employeeName.trim().slice(0, 200),
    period: body.period,
    basicPay,
    allowances,
  });
  return NextResponse.json(entry, { status: 201 });
}
