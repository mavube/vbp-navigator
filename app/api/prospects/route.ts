import { NextRequest, NextResponse } from "next/server";
import { listProspects, createProspect } from "@/lib/db-prospects";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/prospects — everyone submitted via /apply and /assess (plus
// anyone staff logged directly, Phase 10 below) for this org, newest
// first. Same org-wide visibility as Leads — no extra gate beyond being
// in the org.
export async function GET() {
  const orgId = await getCurrentOrgId();
  const prospects = await listProspects(orgId);
  return NextResponse.json(prospects);
}

// POST /api/prospects — v3.0 roadmap Phase 10 (Cluster C): "no
// staff-facing 'log an inquiry' form (public intake only)." Someone
// calls or emails in rather than using /apply or /assess — this is how
// that gets into the same review queue instead of living only in
// someone's inbox. Same open-creation rule as logging a Lead directly;
// source is always 'manual' here regardless of what the client sends,
// so this route can never be used to forge a public-intake record.
export async function POST(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const body = await req.json().catch(() => ({}));

  if (typeof body.fullName !== "string" || !body.fullName.trim()) {
    return NextResponse.json({ error: "fullName is required" }, { status: 400 });
  }

  const prospect = await createProspect(orgId, {
    serviceId: typeof body.serviceId === "string" && body.serviceId ? body.serviceId : null,
    productServiceId: typeof body.productServiceId === "string" && body.productServiceId ? body.productServiceId : null,
    source: "manual",
    fullName: body.fullName.trim().slice(0, 200),
    email: typeof body.email === "string" ? body.email.trim().slice(0, 200) : undefined,
    phone: typeof body.phone === "string" ? body.phone.trim().slice(0, 60) : undefined,
    message: typeof body.message === "string" ? body.message.slice(0, 4000) : undefined,
  });
  return NextResponse.json(prospect, { status: 201 });
}
