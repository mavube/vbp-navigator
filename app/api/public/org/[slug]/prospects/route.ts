import { NextResponse } from "next/server";
import { getOrgBySlug } from "@/lib/organizations";
import { createProspect, type ProspectSource } from "@/lib/db-prospects";

export const dynamic = "force-dynamic";

const MAX_ANSWER_FIELDS = 30;

// POST /api/public/org/:slug/prospects — unauthenticated. The one
// public-facing write in the whole app: backs both /apply (source
// "apply") and /assess (source "assessment", carries
// assessmentAnswers). org_id is resolved here from the URL's org slug,
// never accepted from the request body — a submitter can't claim to be
// applying to an org they didn't actually land the page for.
//
// Input is trimmed and length-capped the same way every other
// POST route in this app caps free text (see app/api/leads/route.ts),
// slightly stricter here since this is the one endpoint anyone on the
// internet can call without an account.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  if (typeof body.fullName !== "string" || !body.fullName.trim()) {
    return NextResponse.json({ error: "fullName is required" }, { status: 400 });
  }
  const source: ProspectSource = body.source === "assessment" ? "assessment" : "apply";

  let assessmentAnswers: Record<string, unknown> | undefined;
  if (source === "assessment" && body.assessmentAnswers && typeof body.assessmentAnswers === "object") {
    const entries = Object.entries(body.assessmentAnswers as Record<string, unknown>).slice(0, MAX_ANSWER_FIELDS);
    assessmentAnswers = Object.fromEntries(
      entries.map(([k, v]) => [String(k).slice(0, 120), typeof v === "string" ? v.slice(0, 500) : v])
    );
  }

  const prospect = await createProspect(org.id, {
    serviceId: typeof body.serviceId === "string" && body.serviceId ? body.serviceId : null,
    productServiceId: typeof body.productServiceId === "string" && body.productServiceId ? body.productServiceId : null,
    source,
    fullName: body.fullName.trim().slice(0, 200),
    email: typeof body.email === "string" ? body.email.trim().slice(0, 200) : undefined,
    phone: typeof body.phone === "string" ? body.phone.trim().slice(0, 60) : undefined,
    message: typeof body.message === "string" ? body.message.slice(0, 4000) : undefined,
    assessmentAnswers,
  });

  return NextResponse.json({ id: prospect.id }, { status: 201 });
}
