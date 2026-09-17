import { NextRequest, NextResponse } from "next/server";
import { updateCustomer } from "@/lib/db-customers";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// PATCH /api/customers/:id — v3.0 roadmap Phase 10 (Cluster C): "no way
// to fix a contact detail later." Partial update, same open-editing
// rule as the create path (POST /api/customers) — a Customer isn't
// scoped to one service, so there's no single service to gate this
// against the way Tasks/Leads/Classes are.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const orgId = await getCurrentOrgId();

  const patch: { fullName?: string; email?: string; phone?: string; organizationName?: string } = {};
  if (typeof body.fullName === "string") {
    if (!body.fullName.trim()) return NextResponse.json({ error: "fullName can't be blank" }, { status: 400 });
    patch.fullName = body.fullName.trim().slice(0, 200);
  }
  if (typeof body.email === "string") patch.email = body.email.trim().slice(0, 200);
  if (typeof body.phone === "string") patch.phone = body.phone.trim().slice(0, 60);
  if (typeof body.organizationName === "string") patch.organizationName = body.organizationName.trim().slice(0, 200);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    await updateCustomer(orgId, id, patch);
  } catch (err) {
    // The partial unique index on (org_id, email) (0012) rejects
    // setting this customer's email to one another customer already
    // has — surfaced as a plain message rather than a raw constraint
    // error, same "catch, don't leak SQL" pattern used nowhere else in
    // this app yet only because nothing else lets a client edit a
    // uniquely-constrained field.
    const msg = err instanceof Error ? err.message : "";
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: "Another customer already has that email address" }, { status: 409 });
    }
    return NextResponse.json({ error: "Couldn't update customer" }, { status: 500 });
  }
  return NextResponse.json({ id, ...patch });
}
