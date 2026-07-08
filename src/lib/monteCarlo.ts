import { FundingPlan } from '../types';

// Deterministic PRNG so results are stable between renders and the
// required-savings binary search stays monotone.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard normal draws via Box-Muller.
function normals(seed: number, count: number): Float64Array {
  const rand = mulberry32(seed);
  const out = new Float64Array(count);
  for (let i = 0; i < count; i += 2) {
    const u1 = Math.max(rand(), 1e-12);
    const u2 = rand();
    const r = Math.sqrt(-2 * Math.log(u1));
    out[i] = r * Math.cos(2 * Math.PI * u2);
    if (i + 1 < count) out[i + 1] = r * Math.sin(2 * Math.PI * u2);
  }
  return out;
}

export interface SimConfig {
  plan: FundingPlan;
  household: number;
  startYear: number;          // simulation begins here with plan.currentSavings
  annualSpendBase: number;    // lifestyle cost per year, today's display $
  spendCpiPct: number;        // region CPI applied to spending
  indexCpiPct: number;        // indexing for pensions & the legacy target
  market: { mu: number; sigma: number };
  govPension: (year: number, balanceDisplay: number) => number;
  // Net property-sale proceeds (display currency, already grown to the sale
  // year and netted to 80%) landing in the portfolio in a given year.
  propertySale?: { year: number; proceeds: number } | null;
  paths?: number;             // default 1000
  seed?: number;
}

export interface SimOutput {
  successProb: number;        // 0..1
  years: number[];
  p10: number[]; p50: number[]; p90: number[];
  medianEnd: number;
  medianDepletionYear: number | null;      // year the median path hits zero (null = lasts)
  detDepletionYear: number | null;         // at steady geometric-mean returns
  detEnd: number;
  balanceAtRetirementP50: number;
  initialWithdrawalRate: number | null;    // net first-year withdrawal / median balance at retirement
  horizonYear: number;
}

// One path. Returns final balance and depletion year (null if it lasts).
function runPath(
  cfg: SimConfig, returns: (yi: number) => number,
  record?: (yi: number, balance: number) => void
): { end: number; depletion: number | null; atRetirement: number } {
  const { plan } = cfg;
  const youngest = cfg.household === 2 ? Math.max(plan.birthYear1, plan.birthYear2) : plan.birthYear1;
  const horizonYear = youngest + plan.horizonAge;
  let balance = plan.currentSavings;
  let depletion: number | null = null;
  let atRetirement = plan.retirementYear <= cfg.startYear ? balance : 0;
  for (let year = cfg.startYear, yi = 0; year <= horizonYear; year++, yi++) {
    balance *= 1 + returns(yi);
    if (year < plan.retirementYear) {
      balance += plan.monthlyContribution * 12;
    } else {
      const n = year - cfg.startYear;
      const spend = cfg.annualSpendBase * Math.pow(1 + cfg.spendCpiPct / 100, n);
      const otherPension =
        plan.otherPensionAnnual * Math.pow(1 + cfg.indexCpiPct / 100, n);
      const gov = cfg.govPension(year, Math.max(0, balance));
      balance -= Math.max(0, spend - gov - otherPension);
    }
    if (cfg.propertySale && year === cfg.propertySale.year) balance += cfg.propertySale.proceeds;
    if (year === plan.retirementYear) atRetirement = balance;
    // While a property sale is still ahead, a negative balance is bridged
    // (borrowing against the home) rather than counted as ruin.
    const salePending = cfg.propertySale != null && year < cfg.propertySale.year;
    if (balance <= 0 && !salePending) {
      balance = 0;
      if (depletion === null) depletion = year;
    }
    record?.(yi, balance);
  }
  return { end: balance, depletion, atRetirement };
}

export function simulate(cfg: SimConfig): SimOutput {
  const paths = cfg.paths ?? 1000;
  const seed = cfg.seed ?? 42;
  const { plan } = cfg;
  const youngest = cfg.household === 2 ? Math.max(plan.birthYear1, plan.birthYear2) : plan.birthYear1;
  const horizonYear = youngest + plan.horizonAge;
  const nYears = horizonYear - cfg.startYear + 1;
  const years = Array.from({ length: nYears }, (_, i) => cfg.startYear + i);
  const z = normals(seed, paths * nYears);

  const matrix: Float64Array[] = years.map(() => new Float64Array(paths));
  const ends = new Float64Array(paths);
  const atRet = new Float64Array(paths);
  const depletions: (number | null)[] = new Array(paths);

  for (let p = 0; p < paths; p++) {
    const res = runPath(
      cfg,
      (yi) => cfg.market.mu + cfg.market.sigma * z[p * nYears + yi],
      (yi, b) => { matrix[yi][p] = b; }
    );
    ends[p] = res.end;
    atRet[p] = res.atRetirement;
    depletions[p] = res.depletion;
  }

  const targetAtHorizon =
    plan.legacyTarget * Math.pow(1 + cfg.indexCpiPct / 100, horizonYear - cfg.startYear);
  let successes = 0;
  for (let p = 0; p < paths; p++) {
    if (depletions[p] === null && ends[p] >= targetAtHorizon) successes++;
  }

  const pct = (arr: Float64Array, q: number) => {
    const sorted = Float64Array.from(arr).sort();
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  };
  const p10 = matrix.map((row) => pct(row, 0.1));
  const p50 = matrix.map((row) => pct(row, 0.5));
  const p90 = matrix.map((row) => pct(row, 0.9));

  // Median depletion: year where the median path first hits zero.
  let medianDepletionYear: number | null = null;
  for (let yi = 0; yi < nYears; yi++) {
    if (p50[yi] <= 0) { medianDepletionYear = years[yi]; break; }
  }

  // Deterministic path at the geometric mean return (mu - sigma^2/2).
  const geo = cfg.market.mu - (cfg.market.sigma ** 2) / 2;
  let detDepletionYear: number | null = null;
  const det = runPath(cfg, () => geo, (yi, b) => {
    if (b <= 0 && detDepletionYear === null) detDepletionYear = years[yi];
  });

  const balanceAtRetirementP50 = pct(atRet, 0.5);
  const retN = Math.max(0, plan.retirementYear - cfg.startYear);
  const spendAtRet = cfg.annualSpendBase * Math.pow(1 + cfg.spendCpiPct / 100, retN);
  const govAtRet = cfg.govPension(Math.max(plan.retirementYear, cfg.startYear), balanceAtRetirementP50);
  const otherAtRet = plan.otherPensionAnnual * Math.pow(1 + cfg.indexCpiPct / 100, retN);
  const netWithdrawal = Math.max(0, spendAtRet - govAtRet - otherAtRet);
  const initialWithdrawalRate =
    balanceAtRetirementP50 > 0 ? netWithdrawal / balanceAtRetirementP50 : null;

  return {
    successProb: successes / paths,
    years, p10, p50, p90,
    medianEnd: pct(ends, 0.5),
    medianDepletionYear,
    detDepletionYear,
    detEnd: det.end,
    balanceAtRetirementP50,
    initialWithdrawalRate,
    horizonYear,
  };
}

// Success probability only — cheaper inner loop for solvers and band fits.
export function successProbability(cfg: SimConfig): number {
  const paths = cfg.paths ?? 1000;
  const seed = cfg.seed ?? 42;
  const { plan } = cfg;
  const youngest = cfg.household === 2 ? Math.max(plan.birthYear1, plan.birthYear2) : plan.birthYear1;
  const horizonYear = youngest + plan.horizonAge;
  const nYears = horizonYear - cfg.startYear + 1;
  const z = normals(seed, paths * nYears);
  const targetAtHorizon =
    plan.legacyTarget * Math.pow(1 + cfg.indexCpiPct / 100, horizonYear - cfg.startYear);
  let successes = 0;
  for (let p = 0; p < paths; p++) {
    const res = runPath(cfg, (yi) => cfg.market.mu + cfg.market.sigma * z[p * nYears + yi]);
    if (res.depletion === null && res.end >= targetAtHorizon) successes++;
  }
  return successes / paths;
}

// Smallest savings-today that reaches the target success probability.
export function solveRequiredSavings(cfg: SimConfig, targetPct: number): number | null {
  const target = targetPct / 100;
  const probe = (savings: number) =>
    successProbability({ ...cfg, plan: { ...cfg.plan, currentSavings: savings }, paths: 600 });
  let hi = Math.max(cfg.annualSpendBase * 10, cfg.plan.currentSavings, 100000);
  let tries = 0;
  while (probe(hi) < target && tries < 12) { hi *= 1.8; tries++; }
  if (probe(hi) < target) return null; // unreachable even with a huge portfolio
  let lo = 0;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (probe(mid) >= target) hi = mid; else lo = mid;
  }
  return hi;
}
