// Hand-worked regression check for lib/payroll.ts's progressive PAYE
// calculation and full compensation computation. Not part of the app's
// runtime — a standalone script to re-run whenever the DEFAULT_RATE_CONFIG
// brackets change, or an org's compensation_rate_configs need a sanity
// check against known numbers.
//
// Run with: npx tsx scripts/verify-payroll.ts

import { computePaye, computeCompensation, DEFAULT_RATE_CONFIG } from "../lib/payroll";

let failures = 0;
function assertEqual(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 0.01) {
    console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`OK: ${label} (${actual})`);
  }
}

// Bracket-by-bracket PAYE check: taxable = 600,000
// 0-270,000 @ 0% = 0; 270,000-520,000 @ 8% = 20,000; 520,000-600,000 @ 20% = 16,000
assertEqual(computePaye(600000, DEFAULT_RATE_CONFIG.payeBrackets), 36000, "PAYE on 600,000 taxable");

// Entirely below the tax-free threshold
assertEqual(computePaye(150000, DEFAULT_RATE_CONFIG.payeBrackets), 0, "PAYE on 150,000 taxable (tax-free)");

// Reaches the top (uncapped) bracket
// 0-270k@0=0, 270k-520k@8%=20,000, 520k-760k@20%=48,000, 760k-1,000k@25%=60,000, 1,000k-1,200k@30%=60,000
assertEqual(computePaye(1200000, DEFAULT_RATE_CONFIG.payeBrackets), 188000, "PAYE on 1,200,000 taxable (top bracket)");

// Full entry: basicPay 1,000,000 + Housing allowance 200,000 = gross 1,200,000
// NSSF (10% of gross) = 120,000; taxable = 1,080,000
// PAYE on 1,080,000 = 0 + 20,000 + 48,000 + 60,000 + (80,000 * 0.30 = 24,000) = 152,000
// netPay = 1,200,000 − 120,000 − 152,000 = 928,000
const result = computeCompensation(1000000, [{ name: "Housing", amount: 200000 }], DEFAULT_RATE_CONFIG);
assertEqual(result.grossPay, 1200000, "gross pay");
assertEqual(result.deductions.find((d) => d.name.includes("NSSF"))?.amount ?? -1, 120000, "NSSF deduction");
assertEqual(result.deductions.find((d) => d.name === "PAYE")?.amount ?? -1, 152000, "PAYE deduction");
assertEqual(result.netPay, 928000, "net pay");

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll payroll checks passed.");
}
