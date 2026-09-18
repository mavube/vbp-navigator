import { NextResponse } from "next/server";
import { getOrgBySlug } from "@/lib/organizations";
import { listPriceCatalogItems } from "@/lib/db-price-catalog";

export const dynamic = "force-dynamic";

// GET /api/public/org/:slug/products — unauthenticated. Phase C
// (portfolio correction): the public counterpart to
// app/api/public/org/[slug]/services/route.ts, but sourced from the
// real Products & Services Catalog instead of the internal Service &
// Value Architecture — the correction this whole track exists for is
// exactly this: a prospect applying to GDC should be choosing from
// GDC's real, sellable offerings, not from an internal capability list
// (Readiness Assessment, Candidate Admission, ...) that only makes
// sense to staff. Returns only active items and only the handful of
// fields that make sense to show someone outside the org — no price,
// no internal pricing model, no required-capabilities link. Empty
// until Diallo enters GDC's real portfolio (Truth Mode — nothing here
// is invented); components/public/ApplyForm.tsx falls back to the
// existing internal-service picker whenever this list is empty, so the
// public forms never go blank waiting on the catalog to be filled in.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await listPriceCatalogItems(org.id);
  const publicProducts = items
    .filter((i) => i.active)
    .map((i) => ({ id: i.id, name: i.name, category: i.category, description: i.standardOffering || i.description }));

  return NextResponse.json({ orgName: org.name, products: publicProducts });
}
