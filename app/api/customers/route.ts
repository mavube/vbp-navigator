import { NextRequest, NextResponse } from "next/server";
import { listCustomers, findOrCreateCustomerByEmailWithFlag } from "@/lib/db-customers";
import { listEngagements } from "@/lib/db-engagements";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/customers — every customer this org has, each admitted from
// a Lead (see app/api/leads/[id]/route.ts) or added directly (Phase 10
// below), plus every Engagement (customer + service pairing) so the
// client can join them without a second round trip — same "small org,
// join client-side" pattern ArchitectureView and Capabilities already
// use. Read-only, same org-wide visibility as everything else here.
export async function GET() {
  const orgId = await getCurrentOrgId();
  const [customers, engagements] = await Promise.all([listCustomers(orgId), listEngagements(orgId)]);
  return NextResponse.json({ customers, engagements });
}

// POST /api/customers — v3.0 roadmap Phase 10 (Cluster C): "no create
// or edit form exists at all" for Customers, so there was no way to add
// one who never came through Pipeline (a walk-in, an existing
// relationship being entered for the first time) or fix a typo'd detail
// on one who did (PATCH /api/customers/[id] handles that half). Open
// creation, same rule as Leads/Tasks — a Customer isn't tied to one
// service, so there's no single service to gate it against; reuses
// findOrCreateCustomerByEmail so submitting an email that already
// exists returns that existing record instead of a duplicate.
export async function POST(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const body = await req.json().catch(() => ({}));

  if (typeof body.fullName !== "string" || !body.fullName.trim()) {
    return NextResponse.json({ error: "fullName is required" }, { status: 400 });
  }

  const { customer, existed } = await findOrCreateCustomerByEmailWithFlag(orgId, {
    fullName: body.fullName.trim().slice(0, 200),
    email: typeof body.email === "string" ? body.email.trim().slice(0, 200) : undefined,
    phone: typeof body.phone === "string" ? body.phone.trim().slice(0, 60) : undefined,
    organizationName: typeof body.organizationName === "string" ? body.organizationName.trim().slice(0, 200) : undefined,
  });

  return NextResponse.json({ ...customer, existed }, { status: existed ? 200 : 201 });
}
