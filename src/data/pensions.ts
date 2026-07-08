import { CurrencyCode, DisplayCurrency, FundingPlan, HomeCountry } from '../types';
import { convert } from './currencies';

// ---------- Capital-market assumptions (annual, nominal) ----------
// Long-run figures in the spirit of published capital-market assumptions
// (Morningstar/Vanguard-style): equities ~7% nominal with ~15-16% vol,
// investment-grade bonds ~4.3%, cash ~3%.
export const MARKET = {
  stocks: { mu: 0.072, sigma: 0.155 },
  bonds: { mu: 0.043, sigma: 0.065 },
  cash: { mu: 0.03, sigma: 0.012 },
  corrStocksBonds: 0.15,
};

export interface AllocationPreset {
  id: string;
  label: string;
  stocks: number; bonds: number; cash: number; // %
  blurb: string;
}

export const ALLOCATIONS: AllocationPreset[] = [
  { id: 'conservative', label: 'Conservative', stocks: 30, bonds: 60, cash: 10, blurb: '30% shares · 60% bonds · 10% cash' },
  { id: 'balanced', label: 'Balanced', stocks: 50, bonds: 45, cash: 5, blurb: '50% shares · 45% bonds · 5% cash' },
  { id: 'growth', label: 'Growth', stocks: 70, bonds: 28, cash: 2, blurb: '70% shares · 28% bonds · 2% cash' },
  { id: 'aggressive', label: 'Aggressive', stocks: 90, bonds: 10, cash: 0, blurb: '90% shares · 10% bonds' },
];

// Combine asset classes into a single portfolio return model.
export function portfolioModel(stocksPct: number, bondsPct: number, cashPct: number): { mu: number; sigma: number } {
  const total = Math.max(1, stocksPct + bondsPct + cashPct);
  const ws = stocksPct / total, wb = bondsPct / total, wc = cashPct / total;
  const mu = ws * MARKET.stocks.mu + wb * MARKET.bonds.mu + wc * MARKET.cash.mu;
  const variance =
    ws * ws * MARKET.stocks.sigma ** 2 +
    wb * wb * MARKET.bonds.sigma ** 2 +
    wc * wc * MARKET.cash.sigma ** 2 +
    2 * ws * wb * MARKET.corrStocksBonds * MARKET.stocks.sigma * MARKET.bonds.sigma;
  return { mu, sigma: Math.sqrt(variance) };
}

export function planAllocation(plan: FundingPlan): { stocks: number; bonds: number; cash: number } {
  if (plan.allocationId === 'custom') return plan.customAlloc;
  const p = ALLOCATIONS.find((a) => a.id === plan.allocationId) ?? ALLOCATIONS[1];
  return { stocks: p.stocks, bonds: p.bonds, cash: p.cash };
}

// ---------- Government pension rules (2026 figures, indexed in the sim) ----------
interface PensionRuleAU {
  kind: 'means-tested-au';
  eligibleAge: number;
  fullSingle: number; fullCouple: number;   // AUD per year incl. supplements
  thresholdSingle: number; thresholdCouple: number; // NON-homeowner assets-test free areas, AUD
  thresholdSingleHomeowner: number; thresholdCoupleHomeowner: number; // while still owning the home
  taperPerDollar: number;                   // annual pension lost per $1 of assets over the threshold
  currency: CurrencyCode;
}
interface PensionRuleFlat {
  kind: 'flat';
  eligibleAge: number;
  perPersonAnnual: number;
  currency: CurrencyCode;
}
export type PensionRule = (PensionRuleAU | PensionRuleFlat) & { label: string; note: string };

export const PENSION_RULES: Record<HomeCountry, PensionRule | null> = {
  AU: {
    kind: 'means-tested-au',
    label: 'Australian Age Pension',
    eligibleAge: 67,
    // Mar-2026 full rates: single $1,200.90/fn, couple $905.20/fn each
    fullSingle: 31220, fullCouple: 47070,
    // July-2026 assets-test free areas, NON-homeowner (this planner assumes renting)
    thresholdSingle: 600000, thresholdCouple: 766000,
    // ...and the lower homeowner free areas that apply while an Australian home is still owned
    thresholdSingleHomeowner: 333000, thresholdCoupleHomeowner: 499000,
    // $3.00/fortnight per $1,000 of assets over the free area = 7.8%/yr
    taperPerDollar: 0.078,
    currency: 'AUD',
    note: 'Means-tested against your portfolio each year ($3/fortnight per $1,000 taper). While you still own an Australian home its value is exempt but the lower homeowner free areas apply; after selling, the proceeds are assessable under the higher non-homeowner free areas. Payable overseas long-term, re-tested after 26 weeks abroad — supplements drop slightly, not modelled.',
  },
  CA: {
    kind: 'flat',
    label: 'CPP + OAS',
    eligibleAge: 65,
    // Average CPP ($925/mo) + max OAS ($743/mo) per person, 2026
    perPersonAnnual: 20000,
    currency: 'CAD',
    note: 'Default = average CPP + maximum OAS per person (2026). CPP is fully portable abroad; OAS needs 20+ years of Canadian residence to be paid overseas; GIS stops outside Canada. Adjust to your CPP statement.',
  },
  US: {
    kind: 'flat',
    label: 'US Social Security',
    eligibleAge: 67,
    perPersonAnnual: 24000, // average retired-worker benefit ~$2,000/mo (2026)
    currency: 'USD',
    note: 'Default = average retired-worker benefit (2026). Payable in most countries. Adjust to your SSA estimate.',
  },
  other: null,
};

// Build the government-pension income function used inside the simulation.
// Returns annual income in DISPLAY currency for a given year, given the
// current portfolio balance (display currency) for means testing.
export function buildGovPension(
  plan: FundingPlan,
  household: number,
  usdPerUnit: Record<CurrencyCode, number>,
  displayCurrency: DisplayCurrency,
  indexCpiPct: number,
  startYear: number
): (year: number, balanceDisplay: number) => number {
  const rule = PENSION_RULES[plan.homeCountry];
  const idx = (year: number) => Math.pow(1 + indexCpiPct / 100, year - startYear);

  const eligibleCount = (year: number): number => {
    const ages = household === 2 ? [plan.birthYear1, plan.birthYear2] : [plan.birthYear1];
    const eligibleAge = rule?.eligibleAge ?? 0;
    return ages.filter((by) => year - by >= eligibleAge).length;
  };

  if (plan.govPensionOverride != null) {
    const base = plan.govPensionOverride;
    return (year) => {
      const startAge = rule?.eligibleAge;
      const eligible = startAge == null ? year >= plan.retirementYear : eligibleCount(year) > 0;
      return eligible ? base * idx(year) : 0;
    };
  }

  if (!rule) return () => 0;

  if (rule.kind === 'flat') {
    return (year) => {
      const n = eligibleCount(year);
      if (n === 0) return 0;
      const local = rule.perPersonAnnual * n * idx(year);
      return convert(local, rule.currency, displayCurrency, usdPerUnit);
    };
  }

  // Australian assets-tested Age Pension, re-assessed each simulated year.
  return (year, balanceDisplay) => {
    const n = eligibleCount(year);
    if (n === 0) return 0;
    const inflator = idx(year);
    const couple = household === 2;
    const full = (couple ? rule.fullCouple * (n / 2) : rule.fullSingle) * inflator;
    // Homeowner status: still owning the (exempt) Australian home lowers the free area.
    const ownsHome =
      plan.propertyValueAUD > 0 && (plan.propertySaleYear == null || year < plan.propertySaleYear);
    const threshold =
      (couple
        ? ownsHome ? rule.thresholdCoupleHomeowner : rule.thresholdCouple
        : ownsHome ? rule.thresholdSingleHomeowner : rule.thresholdSingle) * inflator;
    const balanceAUD = convert(balanceDisplay, displayCurrency, rule.currency, usdPerUnit);
    const excess = Math.max(0, balanceAUD - threshold);
    const pensionAUD = Math.max(0, full - excess * rule.taperPerDollar);
    return convert(pensionAUD, rule.currency, displayCurrency, usdPerUnit);
  };
}
