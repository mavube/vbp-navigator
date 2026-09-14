import { NextResponse } from "next/server";
import { listFindings, seedMissing } from "@/lib/db";
import { FINDINGS } from "@/lib/findings-data";

export const dynamic = "force-dynamic";

// GET /api/findings — full current state of all findings, seeding any that
// don't exist yet (first run against a fresh database).
export async function GET() {
  await seedMissing(FINDINGS.map((f) => f.id));
  const rows = await listFindings();
  return NextResponse.json(rows);
}
