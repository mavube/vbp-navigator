import { NextResponse } from "next/server";
import { listEnrollmentsByCustomer } from "@/lib/db-enrollments";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/customers/:id/enrollments — Phase E (Customer Workspace
// rebuild): every class this customer is (or was) enrolled in, so the
// workspace can show "which classes has this person actually taken"
// without the client fetching every class's own roster to find out.
// Read-only, same org-wide visibility as the rest of Customers.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const enrollments = await listEnrollmentsByCustomer(orgId, id);
  return NextResponse.json(enrollments);
}
