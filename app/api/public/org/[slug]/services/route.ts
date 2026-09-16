import { NextResponse } from "next/server";
import { getOrgBySlug } from "@/lib/organizations";
import { listServices } from "@/lib/db-services";

export const dynamic = "force-dynamic";

// GET /api/public/org/:slug/services — unauthenticated. Backs the
// service picker on /apply and /assess. Deliberately returns only
// Customer Value Services (never Enabling Services, which are internal
// machinery a public applicant has no reason to see or apply to) and
// only the handful of fields that make sense to show someone outside
// the org — no provider/backup names, no department, no dependency
// graph. This is the one place in the app that intentionally narrows
// what listServices() returns before it leaves the server.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const services = await listServices(org.id);
  const publicServices = services
    .filter((s) => s.type === "cvs")
    .map((s) => ({ id: s.id, name: s.name, description: s.description, customerNeed: s.customerNeed }));

  return NextResponse.json({ orgName: org.name, services: publicServices });
}
