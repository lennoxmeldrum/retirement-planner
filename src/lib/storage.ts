import { Assumptions, CustomItem, FundingPlan, RegionData, Selections } from '../types';
import { DEFAULT_ASSUMPTIONS } from '../data/currencies';

export const DEFAULT_FUNDING_PLAN: FundingPlan = {
  birthYear1: 1961,
  birthYear2: 1963,
  retirementYear: 2026,
  horizonAge: 95,
  currentSavings: 1200000,
  monthlyContribution: 0,
  allocationId: 'balanced',
  customAlloc: { stocks: 50, bonds: 45, cash: 5 },
  homeCountry: 'AU',
  govPensionOverride: null,
  otherPensionAnnual: 0,
  legacyTarget: 0,
  successTarget: 85,
};

const KEYS = {
  assumptions: 'rp.assumptions.v1',
  customRegions: 'rp.customRegions.v1',
  customItems: 'rp.customItems.v1',
  selections: 'rp.selections.v1',
  geminiKey: 'rp.geminiKey.v1',
  fundingPlan: 'rp.fundingPlan.v1',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / private mode — non-fatal
  }
}

export const loadAssumptions = (): Assumptions => {
  const a = load<Assumptions>(KEYS.assumptions, DEFAULT_ASSUMPTIONS);
  // merge so new defaults appear for existing users
  return {
    ...DEFAULT_ASSUMPTIONS, ...a,
    usdPerUnit: { ...DEFAULT_ASSUMPTIONS.usdPerUnit, ...a.usdPerUnit },
    cpiPct: { ...DEFAULT_ASSUMPTIONS.cpiPct, ...a.cpiPct },
  };
};
export const saveAssumptions = (a: Assumptions) => save(KEYS.assumptions, a);

export const loadCustomRegions = (): RegionData[] => load(KEYS.customRegions, [] as RegionData[]);
export const saveCustomRegions = (r: RegionData[]) => save(KEYS.customRegions, r);

export const loadCustomItems = (): CustomItem[] => load(KEYS.customItems, [] as CustomItem[]);
export const saveCustomItems = (i: CustomItem[]) => save(KEYS.customItems, i);

export const loadSelectionsMap = (): Record<string, Selections> => load(KEYS.selections, {});
export const saveSelectionsMap = (s: Record<string, Selections>) => save(KEYS.selections, s);

export const loadFundingPlan = (): FundingPlan =>
  ({ ...DEFAULT_FUNDING_PLAN, ...load<Partial<FundingPlan>>(KEYS.fundingPlan, {}) });
export const saveFundingPlan = (p: FundingPlan) => save(KEYS.fundingPlan, p);

export const loadGeminiKey = (): string => load(KEYS.geminiKey, '');
export const saveGeminiKey = (k: string) => save(KEYS.geminiKey, k);

export function exportAll(): string {
  return JSON.stringify(
    {
      assumptions: loadAssumptions(),
      customRegions: loadCustomRegions(),
      customItems: loadCustomItems(),
      selections: loadSelectionsMap(),
      fundingPlan: loadFundingPlan(),
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

export function importAll(json: string): void {
  const data = JSON.parse(json);
  if (data.assumptions) saveAssumptions(data.assumptions);
  if (data.customRegions) saveCustomRegions(data.customRegions);
  if (data.customItems) saveCustomItems(data.customItems);
  if (data.selections) saveSelectionsMap(data.selections);
  if (data.fundingPlan) saveFundingPlan(data.fundingPlan);
}
