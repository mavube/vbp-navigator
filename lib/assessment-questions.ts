// Shared by components/public/StartForm.tsx (where these questions are
// asked, on /start's Certification Program path — formerly a separate
// /assess page, now folded into /start's adaptive form) and
// components/pipeline/LeadItem.tsx (where the answers are shown again,
// on a Lead created by promoting a prospect who answered them). Pulled
// out of the old ApplyForm.tsx into its own module (post-Phase-G) so
// the two places render the exact same question labels from one
// definition instead of a label string being duplicated — and risking
// drifting — between the form that asks and the panel that displays
// the answer.
//
// These questions are VBP's own intake questionnaire, not a
// reproduction of PMI's actual PMP certification eligibility criteria
// (which this app has no source for) — framed that way on /start
// itself so nobody mistakes it for an official eligibility check.
export interface AssessmentQuestion {
  key: string;
  label: string;
  type: "select" | "text" | "number";
  options?: string[];
}

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  { key: "experience", label: "Years of project-related work experience", type: "select", options: ["Less than 1 year", "1–3 years", "3–5 years", "5+ years"] },
  { key: "certification", label: "Do you currently hold a related certification or qualification?", type: "select", options: ["No", "Yes — in progress", "Yes — completed"] },
  { key: "timing", label: "Preferred start timing", type: "select", options: ["As soon as possible", "Next quarter", "Just exploring for now"] },
  { key: "motivation", label: "What's prompting you to pursue this now?", type: "text" },
];
