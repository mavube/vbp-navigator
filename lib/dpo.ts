// DPO Group (formerly Direct Pay Online) payment gateway client — Phase
// 14 production readiness, Area 1. DPO's v6 API is plain XML over HTTP,
// not JSON, so this is a small hand-rolled client rather than an SDK —
// there's no official DPO Node SDK, and pulling in a general XML
// library for three flat fields would be more surface area than the
// problem needs.
//
// Three env vars configure this (see .env.example) — all server-only,
// never exposed to the browser:
//   DPO_COMPANY_TOKEN  — issued by DPO. Diallo's is a PRODUCTION
//                         credential (confirmed 2026-09-17) — there is
//                         no sandbox account behind this code. See the
//                         file comment on createToken below for what
//                         that means for how this gets tested.
//   DPO_SERVICE_TYPE   — the Service Type ID DPO issued alongside the
//                         company token, identifying which configured
//                         payment product a transaction belongs to.
//   DPO_PAYMENT_URL    — the hosted checkout base URL DPO gave Diallo
//                         directly. Deliberately not hardcoded to any
//                         of the several base paths DPO's own public
//                         docs use inconsistently (payv2.php, pay.asp,
//                         …) — the URL actually issued to this merchant
//                         account is the only one guaranteed correct.
//   DPO_API_URL        — optional override; defaults to DPO's
//                         documented v6 endpoint.
//
// Every field sent that isn't a bare number is XML-escaped
// (escapeXml) — this handles real customer names/emails/addresses,
// so unescaped XML injection here would be a real bug, not a
// theoretical one.

const DEFAULT_API_URL = "https://secure.3gdirectpay.com/API/v6/";

export function isDpoConfigured(): boolean {
  return Boolean(process.env.DPO_COMPANY_TOKEN && process.env.DPO_SERVICE_TYPE && process.env.DPO_PAYMENT_URL);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Minimal single-level tag extraction — sufficient for DPO's flat
// response bodies (Result, ResultExplanation, TransToken, TransRef,
// TransactionAmount, …; none of the fields this code reads are nested).
// Returns null when the tag is absent or empty, so callers can tell
// "field not present" apart from "field present but blank" only when
// they need to (most callers here treat both the same).
function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match) return null;
  const value = match[1].trim();
  return value.length > 0 ? value : null;
}

// Rebuilds the same hosted-checkout URL createToken returns, from a
// previously-stored TransToken — used by the e-invoice page to render
// the "Pay Now" link without re-calling createToken on every view (a
// DPO token is created once, at issue time, and reused for the life of
// that invoice's payment window).
export function buildDpoPaymentUrl(transToken: string): string | null {
  const base = process.env.DPO_PAYMENT_URL;
  if (!base) return null;
  return `${base}${base.includes("?") ? "&" : "?"}ID=${encodeURIComponent(transToken)}`;
}

export interface CreateTokenInput {
  amount: number;
  currency: string;
  companyRef: string; // this app's own reference — the document id
  redirectUrl: string;
  backUrl: string;
  serviceDescription: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
}

export interface CreateTokenResult {
  ok: boolean;
  resultCode: string | null;
  resultExplanation: string | null;
  transToken: string | null;
  transRef: string | null;
  paymentUrl: string | null;
  raw: string;
}

// createToken — starts a DPO transaction and returns a token to redirect
// the customer to DPO's hosted checkout page with.
//
// IMPORTANT — this has deliberately never been called against DPO's
// live API during this build. The company token behind this code is a
// PRODUCTION credential (real money), and this environment has no DPO
// sandbox account to exercise it safely against. What *has* been
// verified (see the Phase 14 build notes) is the XML this function
// builds and the parser that reads DPO's documented response shape,
// against hand-constructed fixture strings matching DPO's own published
// examples — not a live round trip. The first live call this code makes
// should be a small, deliberate, watched test transaction, not an
// automated one.
export async function createDpoToken(input: CreateTokenInput): Promise<CreateTokenResult> {
  const companyToken = process.env.DPO_COMPANY_TOKEN;
  const serviceType = process.env.DPO_SERVICE_TYPE;
  const apiUrl = process.env.DPO_API_URL || DEFAULT_API_URL;
  if (!companyToken || !serviceType) {
    throw new Error("DPO is not configured — DPO_COMPANY_TOKEN and DPO_SERVICE_TYPE must be set");
  }

  const serviceDate = new Date().toISOString().slice(0, 16).replace("T", " ");
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${escapeXml(companyToken)}</CompanyToken>
  <Request>createToken</Request>
  <Transaction>
    <PaymentAmount>${input.amount.toFixed(2)}</PaymentAmount>
    <PaymentCurrency>${escapeXml(input.currency)}</PaymentCurrency>
    <CompanyRef>${escapeXml(input.companyRef)}</CompanyRef>
    <RedirectURL>${escapeXml(input.redirectUrl)}</RedirectURL>
    <BackURL>${escapeXml(input.backUrl)}</BackURL>
    <customerEmail>${escapeXml(input.customerEmail)}</customerEmail>
    <customerFirstName>${escapeXml(input.customerFirstName)}</customerFirstName>
    <customerLastName>${escapeXml(input.customerLastName)}</customerLastName>
  </Transaction>
  <Services>
    <Service>
      <ServiceType>${escapeXml(serviceType)}</ServiceType>
      <ServiceDescription>${escapeXml(input.serviceDescription)}</ServiceDescription>
      <ServiceDate>${serviceDate}</ServiceDate>
    </Service>
  </Services>
</API3G>`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/xml; charset=utf-8", Accept: "application/xml" },
    body: xml,
  });
  const raw = await res.text();

  const resultCode = extractXmlTag(raw, "Result");
  const transToken = extractXmlTag(raw, "TransToken");
  const paymentUrl = transToken ? buildDpoPaymentUrl(transToken) : null;

  return {
    ok: resultCode === "000",
    resultCode,
    resultExplanation: extractXmlTag(raw, "ResultExplanation"),
    transToken,
    transRef: extractXmlTag(raw, "TransRef"),
    paymentUrl,
    raw,
  };
}

export interface VerifyTokenResult {
  ok: boolean;
  paid: boolean;
  pending: boolean;
  resultCode: string | null;
  resultExplanation: string | null;
  transactionAmount: string | null;
  transactionCurrency: string | null;
  raw: string;
}

// verifyToken — the ONLY source of truth this app trusts for "was this
// invoice actually paid." The customer's browser redirect back to
// RedirectURL after DPO checkout is not trusted on its own (a redirect
// can be spoofed, abandoned, or hit twice) — the callback route always
// calls this before calling lib/db-documents.ts's recordPayment.
export async function verifyDpoToken(transToken: string): Promise<VerifyTokenResult> {
  const companyToken = process.env.DPO_COMPANY_TOKEN;
  const apiUrl = process.env.DPO_API_URL || DEFAULT_API_URL;
  if (!companyToken) {
    throw new Error("DPO is not configured — DPO_COMPANY_TOKEN must be set");
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${escapeXml(companyToken)}</CompanyToken>
  <Request>verifyToken</Request>
  <TransactionToken>${escapeXml(transToken)}</TransactionToken>
</API3G>`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/xml; charset=utf-8", Accept: "application/xml" },
    body: xml,
  });
  const raw = await res.text();
  const resultCode = extractXmlTag(raw, "Result");

  // Per DPO's documented v7 result codes: 000 "Transaction Paid" and
  // 001 "Authorized" both mean the money moved; 900 means not paid yet
  // (customer hasn't completed checkout) — a real, distinct outcome
  // from failure, not an error.
  return {
    ok: resultCode !== null,
    paid: resultCode === "000" || resultCode === "001",
    pending: resultCode === "900",
    resultCode,
    resultExplanation: extractXmlTag(raw, "ResultExplanation"),
    transactionAmount: extractXmlTag(raw, "TransactionAmount"),
    transactionCurrency: extractXmlTag(raw, "TransactionCurrency"),
    raw,
  };
}

// Exported for the smoke test — confirms the parser reads DPO's own
// documented fixture shapes correctly without making a network call.
export const __test__ = { extractXmlTag, escapeXml };
