import { NextRequest, NextResponse } from "next/server";
import { listLeads, createLead } from "@/lib/db-leads";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/leads?serviceId=... — all leads for the caller's org,
// optionally filtered to one service (typically Readiness Assessment or
// Candidate Admission — the two gap CVS this module exists to give a
// de facto owner to).
export async function GET(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const serviceId = req.nextUrl.searchParams.get("serviceId") ?? undefined;
  const leads = await listLeads(orgId, serviceId);
  return NextResponse.json(leads);
}

// POST /api/leads — log a new lead. Same open-creation rule as tasks
// (see app/api/tasks/route.ts) — anyone can log one; only that
// service's owner/contributor can advance its stage.
export async function POST(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const body = await req.json().catch(() => ({}));

  if (typeof body.serviceId !== "string" || !body.serviceId) {
    return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
  }
  if (typeof body.contactName !== "string" || !body.contactName.trim()) {
    return NextResponse.json({ error: "contactName is required" }, { status: 400 });
  }

  const lead = await createLead(orgId, {
    serviceId: body.serviceId,
    contactName: body.contactName.trim().slice(0, 200),
    contactEmail: typeof body.contactEmail === "string" ? body.contactEmail.slice(0, 200) : undefined,
    contactPhone: typeof body.contactPhone === "string" ? body.contactPhone.slice(0, 60) : undefined,
    notes: typeof body.notes === "string" ? body.notes.slice(0, 4000) : undefined,
  });
  return NextResponse.json(lead, { status: 201 });
}
