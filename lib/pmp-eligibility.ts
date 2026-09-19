// Phase 2 of the /start Warm Lead Intelligence plan — PMP eligibility,
// facts only. Diallo's explicit decision (2026-09-19): do not compute
// a "PMP Readiness score." PMI doesn't publish one, and GDC hasn't
// defined its own readiness rubric yet — a number here would be false
// precision. This module instead produces plain facts: which of PMI's
// four real eligibility pathways the visitor's stated education
// matches, whether their reported experience meets that pathway's
// minimum, whether it falls in PMI's required 10-year window, and
// whether the 35-hour training requirement (or an active CAPM) is
// met — each stated as what-was-reported, never scored or weighted
// into a single number. Shared by components/public/StartForm.tsx
// (where the visitor sees their own facts back on the success screen —
// the "give something useful back" moment) and
// components/pipeline/LeadItem.tsx / components/prospects/ProspectItem.tsx
// (where staff see the same facts as talking points, computed live from
// the stored answers rather than a separately-persisted result, so
// there's exactly one place this logic lives).
//
// Source: pmi.org/certifications/project-management-pmp/how-to-apply,
// verified directly via a live fetch (not from training data) on
// 2026-09-19. PMI publishes four education/experience pathways, all
// requiring the qualifying experience to have been earned within the
// last 10 years, plus 35 hours of project management education (an
// active CAPM certification satisfies the training requirement
// automatically):
//   - High school diploma / GED..................... 60 months (5 yrs)
//   - Associate's degree or global equivalent........ 48 months (4 yrs)
//   - Bachelor's degree or global equivalent......... 36 months (3 yrs)
//   - Bachelor's/postgrad from a PMI GAC program..... 24 months (2 yrs)
//
// isPmpProduct() is a deliberately narrow, catalog-read signal (does
// the product name mention PMP?) rather than a new catalog field —
// GDC's real catalog has exactly one Certification Program item today.
// A future non-PMP certification (different criteria entirely — a
// Six Sigma belt, an Agile credential) would need its own eligibility
// framework; this file's narrow naming keeps that seam visible rather
// than silently misapplying PMI's PMP-specific rules to something
// else. Revisit if/when GDC's catalog grows a second certification.

import type { AssessmentQuestion } from "@/lib/assessment-questions";

export function isPmpProduct(productName: string): boolean {
  return /pmp/i.test(productName);
}

export const EDUCATION_PATHWAYS: { value: string; requiredMonths: number }[] = [
  { value: "High school diploma or equivalent (GED)", requiredMonths: 60 },
  { value: "Associate's degree or global equivalent", requiredMonths: 48 },
  { value: "Bachelor's degree or global equivalent", requiredMonths: 36 },
  { value: "Bachelor's or postgraduate degree from a PMI Global Accreditation Center (GAC) program", requiredMonths: 24 },
];

const RECENCY_OPTIONS = ["Yes, all of it", "Most of it — some is older", "No, it's mostly or entirely older than 10 years"] as const;

const TRAINING_OPTIONS = [
  "35+ hours of project management education",
  "Active CAPM certification",
  "Some project management training, but under 35 hours",
  "No formal project management training yet",
] as const;

const TRAINING_MET: ReadonlySet<string> = new Set(["35+ hours of project management education", "Active CAPM certification"]);

export const PMP_ELIGIBILITY_QUESTIONS: AssessmentQuestion[] = [
  {
    key: "educationPathway",
    label: "Highest education level completed",
    type: "select",
    options: EDUCATION_PATHWAYS.map((p) => p.value),
  },
  {
    key: "experienceMonths",
    label: "Months of experience leading and directing projects",
    type: "number",
  },
  {
    key: "experienceRecency",
    label: "Was this experience earned within the last 10 years?",
    type: "select",
    options: [...RECENCY_OPTIONS],
  },
  {
    key: "training",
    label: "Project management education completed",
    type: "select",
    options: [...TRAINING_OPTIONS],
  },
];

export interface PmpEligibilityFacts {
  pathway: { label: string; requiredMonths: number } | null;
  reportedMonths: number | null;
  meetsExperienceMinimum: boolean | null;
  recency: string | null;
  recencyOk: boolean | null; // true = all within 10 years, false = not, null = partial/mixed
  training: string | null;
  trainingOk: boolean | null;
  statement: string;
  missing: string[];
}

// Pure function — no I/O, safe to call identically from the public
// form (client-side, right after the visitor answers) and from the
// staff-facing Lead/Prospect pages (recomputed from the stored
// assessmentAnswers jsonb, never persisted separately).
export function checkPmpEligibility(answers: Record<string, unknown>): PmpEligibilityFacts {
  const educationPathway = typeof answers.educationPathway === "string" ? answers.educationPathway : "";
  const experienceRecency = typeof answers.experienceRecency === "string" ? answers.experienceRecency : "";
  const training = typeof answers.training === "string" ? answers.training : "";

  const pathwayMatch = EDUCATION_PATHWAYS.find((p) => p.value === educationPathway) ?? null;

  const rawMonths = answers.experienceMonths;
  const parsedMonths = rawMonths !== undefined && rawMonths !== null && rawMonths !== "" ? Number(rawMonths) : NaN;
  const reportedMonths = Number.isFinite(parsedMonths) && parsedMonths >= 0 ? parsedMonths : null;

  const meetsExperienceMinimum = pathwayMatch && reportedMonths !== null ? reportedMonths >= pathwayMatch.requiredMonths : null;

  const recencyOk =
    experienceRecency === "Yes, all of it" ? true : experienceRecency === "No, it's mostly or entirely older than 10 years" ? false : experienceRecency === "Most of it — some is older" ? null : null;

  const trainingOk = TRAINING_MET.has(training) ? true : training ? false : null;

  const missing: string[] = [];
  if (!pathwayMatch) missing.push("education level");
  if (reportedMonths === null) missing.push("months of experience");
  if (!experienceRecency) missing.push("experience recency");
  if (!training) missing.push("training completed");

  let statement: string;
  if (missing.length > 0) {
    statement = `Not enough information yet to check this against PMI's eligibility pathways — still missing: ${missing.join(", ")}.`;
  } else if (meetsExperienceMinimum && recencyOk === true && trainingOk) {
    statement = "Based on what you told us, this appears to align with a PMP eligibility pathway.";
  } else if (meetsExperienceMinimum === false) {
    statement = `Based on what you told us, reported experience is below the ${pathwayMatch!.requiredMonths}-month minimum for that education pathway — GDC can help map out the fastest way to close the gap.`;
  } else if (recencyOk === false) {
    statement = "Based on what you told us, the qualifying experience may fall outside PMI's required 10-year window — worth reviewing directly with GDC.";
  } else if (recencyOk === null) {
    statement = "Based on what you told us, some of the experience may fall outside PMI's 10-year window — GDC can help work out exactly how much counts.";
  } else if (!trainingOk) {
    statement = "Based on what you told us, PMI's required 35 hours of project management education (or an active CAPM) is still needed — GDC's programs can cover this.";
  } else {
    statement = "Based on what you told us, this is a mixed picture against PMI's published criteria — worth a conversation with GDC to go through the details.";
  }

  return {
    pathway: pathwayMatch ? { label: pathwayMatch.value, requiredMonths: pathwayMatch.requiredMonths } : null,
    reportedMonths,
    meetsExperienceMinimum,
    recency: experienceRecency || null,
    recencyOk,
    training: training || null,
    trainingOk,
    statement,
    missing,
  };
}
