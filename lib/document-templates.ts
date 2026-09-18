// Templates for the Phase 5 Document Generation Engine — v3.0 roadmap
// §8. Deliberately plain code, not a database-editable template system:
// nobody asked for a template editor, and building one would be scope
// this phase doesn't need. Each function takes the same shared context
// and returns { title, body }; `body` is plain text (blank-line-
// separated paragraphs, no markdown syntax) — rendered with
// white-space: pre-wrap in the UI rather than through a markdown
// parser, so this doesn't need a new dependency for something this
// small.
//
// `details` is the one free-text field staff fill in per document — the
// specific price, date, venue, or justification a template can't know
// on its own. Every other field comes from real data (org/service/
// recipient), never invented.

export type DocumentType =
  | "proposal"
  | "quotation"
  | "invoice"
  | "invitation"
  | "approval_request"
  | "confirmation"
  | "welcome_communication"
  | "completion_record";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  proposal: "Proposal",
  quotation: "Quotation",
  invoice: "Invoice",
  invitation: "Invitation",
  approval_request: "Approval Request",
  confirmation: "Confirmation",
  welcome_communication: "Welcome Communication",
  completion_record: "Completion Record",
};

// Phase 14 (production readiness, Area 1): proposal/quotation/invoice
// are "commercial documents" — money-bearing, chainable (one can be
// converted from another, see lib/db-documents.ts's convertDocument),
// and independently startable (an invoice doesn't need a prior
// proposal or quotation to exist — a phone/email order can go straight
// to Invoice). They use the 8-state commercial lifecycle
// (draft/generated/under_review/approved/issued/sent/delivered/
// acknowledged) and the amount/line_items/payment columns added in
// migration 0020, not the plain 4-state draft/pending_approval/
// approved/rejected flow the other five types still use.
export const COMMERCIAL_TYPES: ReadonlySet<DocumentType> = new Set(["proposal", "quotation", "invoice"]);

// Pre-engagement types can be generated against a Lead (no Customer
// exists yet); post-engagement types need a real Engagement. Used both
// to validate on the server and to drive which anchor picker the UI
// shows for a given type. Commercial types (above) are exempt from
// this pre/post split entirely — they can anchor to a lead, an
// engagement, a customer directly, or nothing at all.
//
// Phase F (portfolio correction, Track 2) renamed these from
// PRE_ADMISSION_TYPES/POST_ADMISSION_TYPES — "admission" was PMP's own
// Candidate Admission CVS vocabulary leaking into a generic document
// rule that applies to every GDC offering (MS Project Training,
// ValueBlueprint Advisory, anything future). The split itself is
// unchanged: it's about whether a Lead or an Engagement exists yet,
// not about any one service's process name.
export const PRE_ENGAGEMENT_TYPES: ReadonlySet<DocumentType> = new Set(["invitation", "approval_request"]);
export const POST_ENGAGEMENT_TYPES: ReadonlySet<DocumentType> = new Set(["confirmation", "welcome_communication", "completion_record"]);

export interface DocumentContext {
  orgName: string;
  serviceName: string;
  serviceDescription: string;
  customerNeed: string;
  recipientName: string;
  details: string;
  engagementStartDate?: string; // ISO date, only set for post-engagement types
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

function proposal(ctx: DocumentContext) {
  return {
    title: `Proposal: ${ctx.serviceName} for ${ctx.recipientName}`,
    body: [
      `Dear ${ctx.recipientName},`,
      `Thank you for your interest in ${ctx.serviceName}, offered by ${ctx.orgName}.`,
      ctx.serviceDescription ? `About this service: ${ctx.serviceDescription}` : "",
      ctx.customerNeed ? `What this addresses: ${ctx.customerNeed}` : "",
      ctx.details ? `Scope and details:\n${ctx.details}` : "",
      `We'd welcome the chance to discuss this further and answer any questions you have.`,
      `Regards,\n${ctx.orgName}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function quotation(ctx: DocumentContext) {
  return {
    title: `Quotation: ${ctx.serviceName} for ${ctx.recipientName}`,
    body: [
      `Dear ${ctx.recipientName},`,
      `Please find below our quotation for ${ctx.serviceName}.`,
      ctx.details ? `Pricing and terms:\n${ctx.details}` : "Pricing and terms: to be confirmed.",
      `This quotation is provided by ${ctx.orgName} and is valid until otherwise noted or renewed.`,
      `Please let us know if you have any questions or would like to proceed.`,
      `Regards,\n${ctx.orgName}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function invoice(ctx: DocumentContext) {
  return {
    title: `Invoice: ${ctx.serviceName} for ${ctx.recipientName}`,
    body: [
      `Dear ${ctx.recipientName},`,
      `Please find attached our invoice for ${ctx.serviceName}. The itemized amount due and payment link are on the invoice itself.`,
      ctx.details ? `Notes:\n${ctx.details}` : "",
      `Thank you for your business.`,
      `Regards,\n${ctx.orgName}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function invitation(ctx: DocumentContext) {
  return {
    title: `Invitation: ${ctx.serviceName} for ${ctx.recipientName}`,
    body: [
      `Dear ${ctx.recipientName},`,
      `You're invited to take part in ${ctx.serviceName} with ${ctx.orgName}.`,
      ctx.details ? `Details:\n${ctx.details}` : "",
      `We look forward to having you join us.`,
      `Regards,\n${ctx.orgName}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function approvalRequest(ctx: DocumentContext) {
  return {
    title: `Approval Request: ${ctx.serviceName} — ${ctx.recipientName}`,
    body: [
      `Approval requested for: ${ctx.serviceName}, regarding ${ctx.recipientName}.`,
      ctx.details ? `Justification:\n${ctx.details}` : "Justification: not provided.",
      `Routed to ${ctx.orgName}'s Budget Approver for a decision, the same authority that approves Budget Requests and finalizes Compensation.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function confirmation(ctx: DocumentContext) {
  return {
    title: `Confirmation: ${ctx.serviceName} for ${ctx.recipientName}`,
    body: [
      `Dear ${ctx.recipientName},`,
      `This confirms your engagement with ${ctx.orgName} for ${ctx.serviceName}${ctx.engagementStartDate ? `, effective ${fmtDate(ctx.engagementStartDate)}` : ""}.`,
      ctx.details ? `Additional details:\n${ctx.details}` : "",
      `Regards,\n${ctx.orgName}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function welcomeCommunication(ctx: DocumentContext) {
  return {
    title: `Welcome — ${ctx.serviceName}`,
    body: [
      `Dear ${ctx.recipientName},`,
      `Congratulations — you're all set for ${ctx.serviceName} with ${ctx.orgName}${ctx.engagementStartDate ? `, starting ${fmtDate(ctx.engagementStartDate)}` : ""}.`,
      ctx.details ? `What happens next:\n${ctx.details}` : "",
      `We're glad to have you.`,
      `Regards,\n${ctx.orgName}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function completionRecord(ctx: DocumentContext) {
  return {
    title: `Certificate of Completion — ${ctx.serviceName}`,
    body: [
      `This certifies that ${ctx.recipientName} has completed ${ctx.serviceName}, provided by ${ctx.orgName}.`,
      ctx.details ? `Notes:\n${ctx.details}` : "",
      `Issued by ${ctx.orgName}.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

const TEMPLATES: Record<DocumentType, (ctx: DocumentContext) => { title: string; body: string }> = {
  proposal,
  quotation,
  invoice,
  invitation,
  approval_request: approvalRequest,
  confirmation,
  welcome_communication: welcomeCommunication,
  completion_record: completionRecord,
};

export function renderDocument(docType: DocumentType, ctx: DocumentContext): { title: string; body: string } {
  return TEMPLATES[docType](ctx);
}
