import { NextResponse } from "next/server";
import { getOrgBySlug } from "@/lib/organizations";
import { createProspect, type ProspectSource } from "@/lib/db-prospects";
import { recordAndCheckRateLimit } from "@/lib/db-rate-limit";
import { isTurnstileConfigured, verifyTurnstileToken } from "@/lib/turnstile";
import { getOrgSettings } from "@/lib/db-org-settings";

export const dynamic = "force-dynamic";

const MAX_ANSWER_FIELDS = 30;

// Vercel (and most reverse proxies) set x-forwarded-for to a
// comma-separated "client, proxy1, proxy2, ..." chain — the first
// entry is the actual visitor. Falls back to x-real-ip, then a fixed
// placeholder for local dev (no proxy in front of `next start` here),
// which still rate-limits correctly since every local request shares
// that one placeholder "address."
function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local-dev";
}

// POST /api/public/org/:slug/prospects — unauthenticated. The one
// public-facing write in the whole app: backs /start (and the /apply,
// /assess redirects it now serves) — source "apply" for the general
// application/discovery path, "assessment" for the certification
// eligibility path. Both can carry assessmentAnswers since /start's
// Phase 1 (intake backbone): "assessment" for the four/six PMI or
// generic certification questions, "apply" for general discovery's
// five questions plus one adaptive question (lib/discovery-
// questions.ts) — despite the name, "apply" has captured structured
// answers since Phase 1 shipped, not just the free-text `message`
// field. org_id is resolved here from the URL's org slug, never
// accepted from the request body — a submitter can't claim to be
// applying to an org they didn't actually land the page for.
//
// Bug fix (found during Phase 3 — Conversation Brief): this route
// used to gate assessmentAnswers capture on `source === "assessment"`
// only, a leftover from before Phase 1 added the general-discovery
// pattern to the "apply" source. Every general-discovery submission
// since Phase 1 shipped had its five-question answers silently
// dropped at intake — accepted with a 201, but never actually stored,
// so nothing downstream (Prospect review, promotion, the Conversation
// Brief this phase adds) ever saw them. Phase 1's own verification
// only checked for a 201 response, not that the answers round-tripped
// through storage, which is how this went unnoticed. Fixed by
// capturing assessmentAnswers whenever the client sends them, for
// either source.
//
// Post-Phase-G public-form hardening: two gates now sit in front of
// createProspect, in this order. (1) Rate limiting always applies,
// independent of Turnstile — an org that hasn't configured a Turnstile
// key yet still isn't wide open to a submission flood (see
// lib/db-rate-limit.ts). (2) Turnstile verification applies only when
// the org has actually configured a site key AND this deploy has a
// secret key set — same graceful-when-unconfigured shape as DPO/
// Mailtrap elsewhere in this app, so a fresh org isn't blocked from
// receiving any public submissions before they've gotten around to
// setting up CAPTCHA.
//
// Input is trimmed and length-capped the same way every other
// POST route in this app caps free text (see app/api/leads/route.ts),
// slightly stricter here since this is the one endpoint anyone on the
// internet can call without an account.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ip = clientIp(req);
  const { allowed } = await recordAndCheckRateLimit(org.id, ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many submissions from this address — please try again in a few minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));

  if (typeof body.fullName !== "string" || !body.fullName.trim()) {
    return NextResponse.json({ error: "fullName is required" }, { status: 400 });
  }

  // Whether CAPTCHA is required is decided from the org's own stored
  // settings, never from anything the client claims — a submitter
  // can't skip verification just by omitting a field from the request
  // body.
  if (isTurnstileConfigured()) {
    const orgSettings = await getOrgSettings(org.id);
    if (orgSettings.turnstileSiteKey) {
      const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
      const result = await verifyTurnstileToken(token, ip);
      if (!result.success) {
        return NextResponse.json({ error: "CAPTCHA verification failed — please try again." }, { status: 400 });
      }
    }
  }

  const source: ProspectSource = body.source === "assessment" ? "assessment" : "apply";

  let assessmentAnswers: Record<string, unknown> | undefined;
  if (body.assessmentAnswers && typeof body.assessmentAnswers === "object") {
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
