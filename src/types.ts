// ---------- Currencies & projections ----------
export type CurrencyCode = 'USD' | 'CAD' | 'AUD' | 'THB';
export type DisplayCurrency = 'USD' | 'CAD' | 'AUD';

export interface Assumptions {
  baseYear: number;
  // FX: units of USD per 1 unit of currency (USD -> 1)
  usdPerUnit: Record<CurrencyCode, number>;
  // Annual CPI (%) applied to a region's local-currency costs
  cpiPct: Record<string, number>; // key: region id
  geminiModel: string;
}

// ---------- Rentals & map ----------
export type PropertyType = 'apartment' | 'townhouse' | 'house' | 'villa';

export interface RentalRequirements {
  propertyType: PropertyType;
  bedrooms: number; // 1..4 (4 = 4+)
  furnished: boolean;
}

export interface RentalZone {
  id: string;
  name: string;
  description: string;
  // Polygon ring of [lat, lng]. Non-circular on purpose: coastal strips,
  // corridors etc. so beach premiums are modelled properly.
  polygon: [number, number][];
  // Baseline MONTHLY rent in local currency by property type, indexed by
  // bedrooms (index 0 = 1br ... index 3 = 4+br). null / missing type =>
  // that stock is rare in the zone and excluded from averages.
  rent: Partial<Record<PropertyType, (number | null)[]>>;
  spreadPct: number;            // +/- % band around the baseline
  furnishedPremiumPct: number;  // extra when furnished is required
}

// ---------- Cost-of-living catalog ----------
export type ItemMode = 'choice' | 'quantity';

export interface CostOption {
  id: string;
  label: string;
  note?: string;
}

export interface CostItem {
  id: string;
  label: string;
  description?: string;
  mode: ItemMode;        // 'choice' = monthly cost; 'quantity' = per-unit cost x qty/year
  options: CostOption[]; // first option is usually the "none/lowest" one
  qtyLabel?: string;     // for quantity items, e.g. "trips per year"
  maxQty?: number;
  perPerson?: boolean;   // multiplied by household size
}

export interface CostCategory {
  id: string;
  label: string;
  icon: string;
  description: string;
  items: CostItem[];
}

export type BandId = 'essential' | 'comfortable' | 'premium' | 'luxury';

export interface BandPreset {
  choices: Record<string, string>;    // itemId -> optionId
  quantities: Record<string, number>; // itemId -> qty per year (quantity items)
}

// ---------- Region dataset ----------
export interface RegionData {
  id: string;
  name: string;
  country: string;
  flag: string;
  localCurrency: CurrencyCode;
  center: [number, number];
  zoom: number;
  rentNote: string;
  zones: RentalZone[];
  // prices[itemId][optionId] = cost in LOCAL currency.
  //  - choice items: monthly cost
  //  - quantity items: cost per unit (per trip / per flight / per event)
  //  - null => option not applicable in this region (hidden in UI)
  prices: Record<string, Record<string, number | null>>;
  // Region-specific flavour text per option (brand names etc.)
  itemNotes?: Record<string, Record<string, string>>;
  bandPresets: Record<BandId, BandPreset>;
  visaNote: string;
  taxNote: string;
  pricesAsOf: string;
  sources: string[];
  custom?: boolean; // true when user-added (stored in localStorage)
}

// ---------- User selections ----------
export interface Selections {
  regionId: string;
  band: BandId;
  choices: Record<string, string>;
  quantities: Record<string, number>;
  household: number; // 1 or 2
  includeRent: boolean;
  rentalReq: RentalRequirements;
  lockedZoneId: string | null; // when a zone is clicked/locked on the map
  year: number;
  displayCurrency: DisplayCurrency;
}

export interface CustomItem extends CostItem {
  categoryId: string;
  // local-currency prices per region per option
  prices: Record<string, Record<string, number | null>>;
}

export interface RentEstimate {
  monthlyLocal: number | null; // weighted average, base year, local currency
  lowLocal: number | null;
  highLocal: number | null;
  zoneBreakdown: { zoneId: string; name: string; weight: number; monthly: number }[];
  note: string;
}

// ---------- Retirement funding ----------
export type AllocationId = 'conservative' | 'balanced' | 'growth' | 'aggressive' | 'custom';
export type HomeCountry = 'AU' | 'CA' | 'US' | 'other';

export interface FundingPlan {
  birthYear1: number;
  birthYear2: number;              // used when household = 2
  retirementYear: number;          // when drawdown starts / contributions stop
  horizonAge: number;              // plan until the younger person reaches this age
  currentSavings: number;          // investable portfolio today, display currency
  monthlyContribution: number;     // saved per month until retirement
  allocationId: AllocationId;
  customAlloc: { stocks: number; bonds: number; cash: number }; // % — used when allocationId = 'custom'
  homeCountry: HomeCountry;        // determines the government pension rules
  govPensionOverride: number | null; // annual household amount in today's display $; null = auto rules
  otherPensionAnnual: number;      // defined-benefit/annuity/super income streams, today's $ per year
  legacyTarget: number;            // today's display $ to have left at the horizon (0 = spend to zero)
  successTarget: number;           // desired Monte Carlo success %, e.g. 85
}
