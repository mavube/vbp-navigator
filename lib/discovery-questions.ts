// Shared by components/public/StartForm.tsx (where these are asked, on
// /start's non-Certification path — the "General GDC Discovery" pattern
// from the /start warm-lead-intelligence plan, Phase 1) and, later,
// wherever a Lead's captured context needs to render with the same
// labels it was asked with (the Conversation Brief work, Phase 3 —
// not built yet). Same shared-definition-not-duplicated reasoning as
// lib/assessment-questions.ts: one place defines the question text, so
// the form that asks and whatever later displays the answer can never
// drift apart.
//
// Five questions, not one per catalog item — the whole point of this
// pattern (see the plan doc, section "don't over-question") is that
// every non-Certification offering, whatever it is, shares one short
// intake instead of GDC building a separate questionnaire per product.
import { type AssessmentQuestion } from "@/lib/assessment-questions";

export const DISCOVERY_QUESTIONS: AssessmentQuestion[] = [
  { key: "desiredOutcome", label: "What are you trying to achieve?", type: "text" },
  { key: "mainChallenge", label: "What's the main challenge you're facing?", type: "text" },
  { key: "whatTried", label: "What have you tried so far?", type: "text" },
  { key: "whoFor", label: "Who is this for?", type: "select", options: ["Myself", "My team", "My organization", "My client/customer"] },
  { key: "startTiming", label: "When do you plan to start?", type: "select", options: ["Immediately", "Within 1 month", "1–3 months", "3–6 months", "Later", "Not sure"] },
];

// At most ONE extra question, chosen by the selected catalog item's own
// `category` (the same five real values Products & Services Catalog
// already suggests — see components/settings/PriceCatalogManager.tsx's
// CATEGORY_SUGGESTIONS). A category with no entry here simply gets no
// adaptive question — never a placeholder, never forced — so adding a
// sixth business line to the catalog later doesn't silently break this
// form; it just means nobody's written that category's one question
// yet. Keyed by the exact category string, not a slug, so this stays a
// straight lookup with nothing to keep in sync by hand.
export const CATEGORY_ADAPTIVE_QUESTION: Record<string, AssessmentQuestion> = {
  "Training & Capability Development": {
    key: "categoryContext",
    label: "How are you currently building this skill or capability?",
    type: "select",
    options: ["Self-study", "On-the-job, no formal training yet", "Another training provider", "Not started yet"],
  },
  "Business Transformation & ICT Advisory": {
    key: "categoryContext",
    label: "What has this situation affected most?",
    type: "select",
    options: ["Cost", "Time", "Delivery", "People", "Customers", "Visibility & control", "Other"],
  },
  "Project Management & Implementation Advisory": {
    key: "categoryContext",
    label: "What has this situation affected most?",
    type: "select",
    options: ["Cost", "Time", "Delivery", "People", "Customers", "Visibility & control", "Other"],
  },
  "Business Process & Value Advisory": {
    key: "categoryContext",
    label: "What has this situation affected most?",
    type: "select",
    options: ["Cost", "Time", "Delivery", "People", "Customers", "Visibility & control", "Other"],
  },
  "Technology & Digital Solutions": {
    key: "categoryContext",
    label: "How are you currently handling this?",
    type: "select",
    options: ["Spreadsheets or a manual process", "An existing system", "No system yet", "Not sure"],
  },
};
