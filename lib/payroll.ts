// Pure payroll math for the Compensation Earning Service (Phase 5). No
// database or framework imports on purpose — this is the one piece of
// the module worth unit-testing in isolation, and keeping it pure makes
// that trivial (see scripts/test-payroll.mjs).
//
// IMPORTANT: the rates below are an illustrative Tanzania default, not
// verified current NSSF/WCF/TRA figures — this is a starting
// configuration for the app to function with, not payroll or tax
// advice. Diallo/Jennifer should confirm current rates before this
// feeds a real pay run, and every rate here is meant to be edited per
// org (compensation_rate_configs table), not treated as fixed policy.

export interface PayeBracket {
  // Upper bound of this bracket's taxable income, in the org's
  // currency units; null means "this bracket and above".
  upTo: number | null;
  rate: number; // marginal rate applied to income within this bracket
}

export interface RateConfig {
  nssfEmployeeRate: number; // employee's NSSF contribution, e.g. 0.10
  // WCF is conventionally an employer-paid contribution in Tanzania,
  // not deducted from staff pay — defaults to 0 (off) so it only shows
  // up as a deduction line if an org's config deliberately sets it.
  wcfRate: number;
  payeBrackets: PayeBracket[];
}

export const DEFAULT_RATE_CONFIG: RateConfig = {
  nssfEmployeeRate: 0.1,
  wcfRate: 0,
  payeBrackets: [
    { upTo: 270000, rate: 0 },
    { upTo: 520000, rate: 0.08 },
    { upTo: 760000, rate: 0.2 },
    { upTo: 1000000, rate: 0.25 },
    { upTo: null, rate: 0.3 },
  ],
};

export interface AllowanceLine {
  name: string;
  amount: number;
}

export interface DeductionLine {
  name: string;
  amount: number;
}

export interface CompensationResult {
  grossPay: number;
  deductions: DeductionLine[];
  netPay: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Progressive tax across brackets — each bracket's rate applies only to
// the slice of taxable income that falls within it, not the whole
// amount (the standard "marginal rate" calculation).
export function computePaye(taxableIncome: number, brackets: PayeBracket[]): number {
  let tax = 0;
  let lowerBound = 0;
  for (const bracket of brackets) {
    const upperBound = bracket.upTo === null ? Infinity : bracket.upTo;
    if (taxableIncome > lowerBound) {
      const amountInBracket = Math.min(taxableIncome, upperBound) - lowerBound;
      tax += amountInBracket * bracket.rate;
    }
    lowerBound = upperBound;
    if (taxableIncome <= upperBound) break;
  }
  return round2(tax);
}

// Basic Pay + Allowances − Deductions = Net Pay, per the alignment
// doc's CompensationEntry structure (Section 7). NSSF is deducted
// before computing PAYE (taxable income = gross − NSSF), matching how
// Tanzania's PAYE is conventionally applied.
export function computeCompensation(
  basicPay: number,
  allowances: AllowanceLine[],
  rates: RateConfig
): CompensationResult {
  const grossPay = round2(basicPay + allowances.reduce((sum, a) => sum + a.amount, 0));
  const nssf = round2(grossPay * rates.nssfEmployeeRate);
  const wcf = round2(grossPay * rates.wcfRate);
  const taxableIncome = Math.max(0, grossPay - nssf);
  const paye = computePaye(taxableIncome, rates.payeBrackets);

  const deductions: DeductionLine[] = [{ name: "NSSF (employee)", amount: nssf }];
  if (wcf > 0) deductions.push({ name: "WCF", amount: wcf });
  deductions.push({ name: "PAYE", amount: paye });

  const netPay = round2(grossPay - deductions.reduce((sum, d) => sum + d.amount, 0));
  return { grossPay, deductions, netPay };
}
