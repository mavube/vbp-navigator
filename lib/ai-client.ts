// v3.0 roadmap Phase 8 — AI Operating Layer (§19). A thin, lazy wrapper
// around the Anthropic SDK — deliberately not constructed at module
// load time, so a missing ANTHROPIC_API_KEY never breaks the build or
// any unrelated route (Vercel builds don't have this key; only a live
// request to /api/ai/observe needs it). Callers get a specific,
// catchable AiNotConfiguredError instead of an unhandled crash.

import Anthropic from "@anthropic-ai/sdk";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set — the AI Operating Layer isn't configured yet.");
    this.name = "AiNotConfiguredError";
  }
}

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiNotConfiguredError();
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// Sonnet, not Opus: this phase's Observe/Understand/Advise pass is a
// structured-summarization task over a few KB of the org's own data,
// not deep multi-step reasoning — Sonnet 5 is Anthropic's stated
// speed/intelligence balance pick and meaningfully cheaper than Opus 5
// for a call a 5-person org might trigger daily. Revisit this constant
// if a future phase (Forecast/Assist, §19's later half) turns out to
// need Opus-level reasoning for something harder than this.
export const AI_MODEL = "claude-sonnet-5";
