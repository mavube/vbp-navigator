import { NextResponse } from "next/server";
import { getCurrentOrgId } from "@/lib/current-org";
import { buildAiOrgSnapshot } from "@/lib/ai-context";
import { getAnthropicClient, AiNotConfiguredError, AI_MODEL } from "@/lib/ai-client";

export const dynamic = "force-dynamic";

// v3.0 roadmap Phase 8 — AI Operating Layer (§19), Observe/Understand/
// Advise stage only. POST, not GET: this triggers a real, billed call
// to the Claude API, so it's an action the caller takes on purpose
// (the Advisor page only calls this from an explicit "Generate
// insights" button click — never on page load), not something that
// should fire from a link prefetch or a browser revisiting the URL.
//
// Forecast/Assist (drafting documents, demand forecasting) are
// explicitly a later stage of §19, not built here — this route only
// ever reads and summarizes; it never writes anything back to the
// database or drafts anything the rest of the app would act on.
export interface AiInsights {
  observations: string;
  connections: string[];
  recommendations: string[];
  generatedAt: string;
  // Present only if the model's response couldn't be parsed as the
  // requested JSON shape — the UI falls back to showing this raw text
  // rather than silently discarding a real response.
  raw?: string;
}

const SYSTEM_PROMPT = `You are the AI Operating Layer inside VBP Navigator OS, an internal operations tool used by one organization's own team. You only ever see the single organization's own data included in the user message below — never any other organization's.

This is the Observe/Understand/Advise stage of the AI layer (the first stage — a later stage may eventually draft documents or forecast demand, but that is not this request; do not attempt it here).

Given a live JSON snapshot of the organization's services, work, blockers, pipeline, and finances, respond with a JSON object with exactly these three fields:

"observations": 2-4 plain-language sentences on what's actually happening right now — the shape of the situation, not a restatement of every number in the snapshot.

"connections": an array of specific, factual links between two or more real items in the snapshot (for example: a service with no provider assigned that also has a high-impact blocker open, or a pipeline stage backing up in a way that will hit a service that's already overloaded). Reference real service, task, and blocker names from the snapshot. Never invent a fact that isn't in the data. Return an empty array if there is genuinely nothing worth connecting — do not force one.

"recommendations": an array of at most 5 concrete, prioritized next actions a small team could actually take this week. Each one must reference a real name from the snapshot. Never give generic advice ("communicate better", "monitor closely") that isn't tied to something specific in the data.

Respond with ONLY the JSON object — no markdown code fences, no prose before or after it.`;

export async function POST() {
  const orgId = await getCurrentOrgId();

  let client;
  try {
    client = getAnthropicClient();
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }

  const snapshot = await buildAiOrgSnapshot(orgId);

  let responseText: string;
  try {
    // The trailing assistant-role message with a literal "{" is a
    // standard Claude prefill technique for biasing the completion
    // toward valid JSON with no wrapper prose — the model continues
    // from that character rather than starting a fresh turn, so the
    // "{" is prepended back on below before parsing.
    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Organization snapshot (JSON):\n${JSON.stringify(snapshot, null, 2)}` },
        { role: "assistant", content: "{" },
      ],
    });
    const block = message.content[0];
    responseText = "{" + (block && block.type === "text" ? block.text : "");
  } catch (err) {
    console.error("AI Operating Layer call failed:", err);
    return NextResponse.json({ error: "The AI service didn't respond — try again in a moment." }, { status: 502 });
  }

  let parsed: { observations?: string; connections?: string[]; recommendations?: string[] } = {};
  let raw: string | undefined;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    raw = responseText;
  }

  const insights: AiInsights = {
    observations: parsed.observations ?? "",
    connections: Array.isArray(parsed.connections) ? parsed.connections : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    generatedAt: new Date().toISOString(),
    ...(raw ? { raw } : {}),
  };

  return NextResponse.json(insights);
}
