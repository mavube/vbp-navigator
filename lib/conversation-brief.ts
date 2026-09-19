// Phase 3 of the /start Warm Lead Intelligence plan — Conversation
// Brief + Task-based follow-up, on the Lead page. Diallo's own words
// on why this exists: "I'd wish to see the lead's assessment score,
// what drives them, what challenges they're facing... real talking
// points for a sales follow-up call." A templated summary built only
// from what was actually captured — "why they came," "what they told
// us," "what they've tried," "who this is for," "timing" — with
// "Not yet established" for anything the visitor didn't answer, never
// a guess or an invented detail.
//
// Three different question sets can produce the answers this reads
// (lib/discovery-questions.ts's general pattern, lib/assessment-
// questions.ts's older generic certification questions, and
// lib/pmp-eligibility.ts's PMI-specific questions), each using its own
// keys for the same underlying idea — this module is the one place
// that reconciles them into one shape, rather than three separate
// display panels each needing their own "why/what/who/timing" reading.
// A key naturally missing from a given question set (e.g. no
// "mainChallenge" was ever asked on the PMP path) reads the same as a
// question that was asked but left blank — "Not yet established"
// either way, since a caller of buildConversationBrief has no way to
// tell those apart from the stored answers alone, and doesn't need to:
// the point is what's known now, not why it isn't.
//
// Pure, no I/O — called from components/pipeline/LeadItem.tsx and
// components/prospects/ProspectItem.tsx (recomputed live from the
// stored assessmentAnswers, same pattern as lib/pmp-eligibility.ts,
// nothing persisted separately) and from lib/db-prospects.ts's
// promoteProspectToLead (to write the follow-up Task's description).

import { START_TIMING_OPTIONS } from "@/lib/discovery-questions";

export interface ConversationBrief {
  whyTheyCame: string | null;
  mainChallenge: string | null;
  whatTried: string | null;
  who: string | null;
  timing: string | null;
  categoryContext: string | null;
  hasContent: boolean;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function buildConversationBrief(answers: Record<string, unknown> | null | undefined): ConversationBrief {
  const a = answers ?? {};
  // "Why they came" reads discovery's desiredOutcome or either
  // question set's motivation — the same underlying question asked
  // with different keys/wording depending on which path the visitor
  // took, not two different ideas.
  const whyTheyCame = strOrNull(a.desiredOutcome) ?? strOrNull(a.motivation);
  const mainChallenge = strOrNull(a.mainChallenge);
  const whatTried = strOrNull(a.whatTried);
  const who = strOrNull(a.whoFor);
  const timing = strOrNull(a.startTiming) ?? strOrNull(a.timing);
  const categoryContext = strOrNull(a.categoryContext);

  return {
    whyTheyCame,
    mainChallenge,
    whatTried,
    who,
    timing,
    categoryContext,
    hasContent: [whyTheyCame, mainChallenge, whatTried, who, timing, categoryContext].some((v) => v !== null),
  };
}

const NOT_YET = "Not yet established";

// Plain-text rendering — used for the follow-up Task's description
// (lib/db-prospects.ts's promoteProspectToLead), where there's no JSX
// to lay this out as labeled panel rows the way LeadItem.tsx and
// ProspectItem.tsx render it.
export function formatConversationBriefText(brief: ConversationBrief): string {
  const lines = [
    `Why they came: ${brief.whyTheyCame ?? NOT_YET}`,
    `What they told us: ${brief.mainChallenge ?? NOT_YET}`,
    `What they've tried: ${brief.whatTried ?? NOT_YET}`,
    `Who this is for: ${brief.who ?? NOT_YET}`,
    `Timing: ${brief.timing ?? NOT_YET}`,
  ];
  if (brief.categoryContext) lines.push(`Also noted: ${brief.categoryContext}`);
  return lines.join("\n");
}

// Suggests a follow-up due date from the visitor's own stated timing —
// a scheduling heuristic this app is making, not a fact the visitor
// gave us, so it's kept separate from ConversationBrief itself (which
// only ever holds what was actually captured). The logic: the sooner
// someone wants to start, the sooner the follow-up call needs to
// happen relative to today, not relative to when they want to start —
// a lead who wants to start "Immediately" needs a call tomorrow, not
// in a month. Recognizes both timing vocabularies in the app today
// (discovery/PMP's six-option set and the older generic assessment
// questions' three-option set — see lib/assessment-questions.ts);
// anything else, including no timing given at all, falls back to one
// week out, a reasonable default rather than an arbitrary guess dressed
// up as one.
const DUE_DATE_OFFSET_DAYS: Record<string, number> = {
  "Immediately": 1,
  "As soon as possible": 1,
  "Within 1 month": 3,
  "1–3 months": 7,
  "Next quarter": 7,
  "3–6 months": 14,
  "Later": 21,
  "Just exploring for now": 21,
  "Not sure": 7,
};
const DEFAULT_OFFSET_DAYS = 7;

export function suggestFollowUpDueDate(timing: string | null, from: Date = new Date()): string {
  const offset = timing !== null && timing in DUE_DATE_OFFSET_DAYS ? DUE_DATE_OFFSET_DAYS[timing] : DEFAULT_OFFSET_DAYS;
  const due = new Date(from);
  due.setDate(due.getDate() + offset);
  return due.toISOString().slice(0, 10);
}

// Re-exported so a caller only needs to import this module to
// recognize every timing value this app currently asks for, without
// also importing lib/discovery-questions.ts directly.
export { START_TIMING_OPTIONS };

// The raw assessmentAnswers keys buildConversationBrief reads. Used by
// LeadItem.tsx / ProspectItem.tsx to filter their older, more literal
// "dump every answer" panels (the generic-assessment entries list and
// the raw key:value fallback) down to only what the Brief doesn't
// already show — otherwise a key like "motivation" or "timing" that's
// shared between the old generic assessment questions and the Brief's
// own mapping would render twice, in two different panels, with two
// different labels for the same underlying answer.
export const BRIEF_CONSUMED_KEYS: ReadonlySet<string> = new Set([
  "desiredOutcome",
  "motivation",
  "mainChallenge",
  "whatTried",
  "whoFor",
  "startTiming",
  "timing",
  "categoryContext",
]);
