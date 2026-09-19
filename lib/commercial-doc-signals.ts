// Shared decision-support signals for commercial documents (proposals,
// quotations, invoices) — split out so the definitions of "overdue"
// and "stalled" live in exactly one place instead of drifting between
// the pages that show them (Customer Workspace, Commercial Docs
// workspace, the document item card itself). Same reasoning as
// lib/assessment-questions.ts's extraction: two UI surfaces reading
// one definition beats two copies that can quietly diverge.
//
// Post-Phase-G, third of Diallo's confirmed next steps ("this is a
// decision-supporting system, not QuickBooks or Tally"): these are the
// first genuinely NEW facts surfaced anywhere in the app, not just a
// formatting change — an invoice sitting unpaid past its due date, or
// a proposal/quotation sent and never acknowledged, was previously
// visible only by opening that one document and doing the date math
// yourself.
//
// Both signals are computed client-side from fields the API already
// returns (dueDate, paymentStatus, status, sentAt) — no new schema, no
// new endpoint, nothing invented.

// Minimal shape each check needs — CustomerDocument (customers/types.ts)
// and CommercialDocument (commercial/types.ts) both satisfy this
// structurally, so one function serves both pages.
export interface OverdueCheckable {
  docType: string;
  paymentStatus: string;
  dueDate: string | null;
}

export function isOverdueInvoice(doc: OverdueCheckable): boolean {
  if (doc.docType !== "invoice") return false;
  if (doc.paymentStatus !== "unpaid" && doc.paymentStatus !== "failed") return false;
  if (!doc.dueDate) return false;
  return new Date(doc.dueDate).getTime() < Date.now();
}

export function daysOverdue(dueDate: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000));
}

// A document "sitting" in sent/delivered with no reply is a judgment
// call about what counts as "too long" — 14 days is a reasonable
// starting point (two business weeks), not a figure derived from GDC's
// own historical response times (there isn't enough production history
// yet to derive one honestly). Worth revisiting once real data exists.
export const STALL_THRESHOLD_DAYS = 14;

export interface StallCheckable {
  status: string;
  sentAt: string | null;
}

export function isStalledDocument(doc: StallCheckable): boolean {
  if (doc.status !== "sent" && doc.status !== "delivered") return false;
  if (!doc.sentAt) return false;
  return daysSince(doc.sentAt) >= STALL_THRESHOLD_DAYS;
}

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
