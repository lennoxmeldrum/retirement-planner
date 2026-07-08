// Australian residential property growth assumptions by postcode area.
// Long-run NOMINAL annual growth: a blend of ~20-year capital-city averages
// with mid-2026 market momentum (Perth/Brisbane/Adelaide out-performing,
// Sydney mid-pack, Melbourne/Hobart lagging — KPMG/Domain/CoreLogic 2026).
// Deliberately more conservative than any single hot year.

export interface PostcodeArea {
  min: number;
  max: number;
  label: string;
  growthPct: number;
}

export const POSTCODE_AREAS: PostcodeArea[] = [
  // NT
  { min: 800, max: 899, label: 'Darwin', growthPct: 3.8 },
  { min: 900, max: 999, label: 'Regional NT', growthPct: 3.4 },
  // NSW
  { min: 2000, max: 2249, label: 'Sydney metro', growthPct: 5.4 },
  { min: 2250, max: 2263, label: 'Central Coast NSW', growthPct: 5.0 },
  { min: 2264, max: 2339, label: 'Newcastle & Hunter', growthPct: 5.0 },
  { min: 2340, max: 2411, label: 'Regional NSW (north & west)', growthPct: 3.9 },
  { min: 2412, max: 2499, label: 'NSW North Coast (Coffs–Byron)', growthPct: 4.7 },
  { min: 2500, max: 2554, label: 'Wollongong & Illawarra', growthPct: 5.0 },
  { min: 2555, max: 2574, label: 'Sydney south-west fringe', growthPct: 5.3 },
  { min: 2575, max: 2599, label: 'Southern Highlands', growthPct: 4.5 },
  { min: 2600, max: 2639, label: 'Canberra & ACT', growthPct: 4.3 },
  { min: 2640, max: 2739, label: 'Regional NSW (Riverina)', growthPct: 3.8 },
  { min: 2740, max: 2786, label: 'Western Sydney & Blue Mountains', growthPct: 5.2 },
  { min: 2787, max: 2898, label: 'Regional NSW', growthPct: 3.8 },
  { min: 2900, max: 2920, label: 'Canberra & ACT', growthPct: 4.3 },
  // VIC
  { min: 3000, max: 3211, label: 'Melbourne metro', growthPct: 4.6 },
  { min: 3212, max: 3231, label: 'Geelong & Surf Coast', growthPct: 4.4 },
  { min: 3232, max: 3499, label: 'Regional VIC (west)', growthPct: 3.7 },
  { min: 3500, max: 3699, label: 'Regional VIC (north)', growthPct: 3.6 },
  { min: 3700, max: 3799, label: 'Regional VIC (north-east)', growthPct: 3.7 },
  { min: 3800, max: 3910, label: 'Melbourne south-east', growthPct: 4.6 },
  { min: 3911, max: 3999, label: 'Mornington Peninsula & Gippsland', growthPct: 4.2 },
  // QLD
  { min: 4000, max: 4184, label: 'Brisbane', growthPct: 6.0 },
  { min: 4185, max: 4207, label: 'Bayside & Logan', growthPct: 5.8 },
  { min: 4208, max: 4230, label: 'Gold Coast', growthPct: 6.2 },
  { min: 4270, max: 4299, label: 'Gold Coast hinterland & Scenic Rim', growthPct: 5.5 },
  { min: 4300, max: 4312, label: 'Ipswich & western corridor', growthPct: 6.0 },
  { min: 4313, max: 4349, label: 'Regional QLD (south-west)', growthPct: 4.5 },
  { min: 4350, max: 4364, label: 'Toowoomba', growthPct: 5.2 },
  { min: 4365, max: 4499, label: 'Regional QLD (Darling Downs)', growthPct: 4.5 },
  { min: 4500, max: 4549, label: 'Moreton Bay', growthPct: 5.8 },
  { min: 4550, max: 4579, label: 'Sunshine Coast & Noosa', growthPct: 6.1 },
  { min: 4580, max: 4699, label: 'Wide Bay (Gympie–Bundaberg)', growthPct: 4.8 },
  { min: 4700, max: 4899, label: 'Regional QLD (Rockhampton–Cairns)', growthPct: 5.0 },
  // SA
  { min: 5000, max: 5199, label: 'Adelaide', growthPct: 5.6 },
  { min: 5200, max: 5749, label: 'Regional SA', growthPct: 4.2 },
  // WA
  { min: 6000, max: 6199, label: 'Perth', growthPct: 6.0 },
  { min: 6200, max: 6799, label: 'Regional WA', growthPct: 4.4 },
  // TAS
  { min: 7000, max: 7099, label: 'Hobart', growthPct: 4.0 },
  { min: 7100, max: 7999, label: 'Regional TAS', growthPct: 3.6 },
];

export const DEFAULT_PROPERTY_GROWTH = { label: 'Australia-wide average', growthPct: 4.8 };

// Net sale proceeds added to the portfolio: 80% of gross sale value, covering
// agent fees, legal/transaction costs and CGT where applicable.
export const SALE_NET_FRACTION = 0.8;

export function lookupPostcode(postcode: string): { label: string; growthPct: number; matched: boolean } {
  const pc = parseInt(postcode.trim(), 10);
  if (!Number.isFinite(pc) || postcode.trim().length < 3) {
    return { ...DEFAULT_PROPERTY_GROWTH, matched: false };
  }
  const area = POSTCODE_AREAS.find((a) => pc >= a.min && pc <= a.max);
  return area
    ? { label: area.label, growthPct: area.growthPct, matched: true }
    : { ...DEFAULT_PROPERTY_GROWTH, matched: false };
}
