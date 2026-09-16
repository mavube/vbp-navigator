// Financial-year helpers — v3.0 roadmap Phase 3.
//
// Per the confirmed decision (2026-09-16), GDC's fiscal year is the
// calendar year (Jan-Dec) — not the July-June government convention the
// original brief's own "FY 2025/26" example implied. That makes
// "fiscal year" just the plain calendar-year number everywhere in this
// app: no split-year labels, no month-offset math. Kept as its own tiny
// module (rather than inlined per-caller) so there's one place to
// change it if a future org ever needs a non-calendar FY.
//
// Deliberately NOT a stored `fiscal_year` column on budget_requests /
// expenses / compensation_entries — every one of those rows already
// carries a real date (created_at, expense_date, period), and since FY
// is just that date's calendar year, storing a second column would be
// a second source of truth for the same fact with no new information.
// "Queryable attribute" (the roadmap's own phrase) is implemented as a
// computed filter over the existing date columns instead — see
// lib/rollups.ts.

export function currentFiscalYear(): number {
  return new Date().getFullYear();
}

// Every date/timestamp column this app writes is ISO 8601 text starting
// with a 4-digit year ("2026-09-16" or "2026-09-16T08:32:00.000Z"),
// identically on Postgres (timestamptz/date, read back as ISO strings)
// and SQLite (stored as TEXT in that same format) — so this is
// intentionally a substring, not a real date parse. That sidesteps any
// timezone edge case a Date() parse could introduce and matches exactly
// how lib/rollups.ts filters the same columns in SQL.
export function fiscalYearOfDate(dateStr: string): number {
  return parseInt(dateStr.slice(0, 4), 10);
}

// compensation_entries.period is stored as "YYYY-MM" (see
// lib/db-compensation.ts) — same substring approach.
export function fiscalYearOfPeriod(period: string): number {
  return parseInt(period.slice(0, 4), 10);
}

export function fyLabel(fy: number): string {
  return `FY${fy}`;
}

// The three years shown in the "previous FY / current FY / next FY"
// comparison view the v3.0 roadmap's Phase 3 calls for — always
// centered on the real current year, not on whichever year happens to
// have the most data, so an org can see "next FY" is genuinely empty
// rather than have that row silently disappear.
export function adjacentFiscalYears(centerFy: number = currentFiscalYear()): number[] {
  return [centerFy - 1, centerFy, centerFy + 1];
}
