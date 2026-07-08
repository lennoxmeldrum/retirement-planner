import { CostCategory, CostItem, RegionData, Selections, CustomItem } from '../types';

export interface ItemCost {
  item: CostItem;
  categoryId: string;
  optionId: string;
  optionLabel: string;
  qty: number | null;
  monthlyLocal: number; // base-year local currency, household-adjusted
  available: boolean;
}

export interface CostBreakdown {
  items: ItemCost[];
  byCategory: Record<string, number>;
  livingTotalLocal: number;  // everything except rent
  rentLocal: number;         // 0 when excluded/unknown
  totalLocal: number;
}

function priceFor(region: RegionData, customItems: CustomItem[], itemId: string, optionId: string): number | null {
  const custom = customItems.find((c) => c.id === itemId);
  const table = custom ? custom.prices[region.id] : region.prices[itemId];
  if (!table) return null;
  const v = table[optionId];
  return v == null ? null : v;
}

// First option of an item that actually has a price in this region.
export function firstPricedOption(region: RegionData, customItems: CustomItem[], item: CostItem): string | null {
  for (const o of item.options) {
    if (priceFor(region, customItems, item.id, o.id) != null) return o.id;
  }
  return null;
}

export function computeBreakdown(
  region: RegionData,
  catalog: CostCategory[],
  customItems: CustomItem[],
  sel: Selections,
  rentMonthlyLocal: number | null
): CostBreakdown {
  const items: ItemCost[] = [];
  const byCategory: Record<string, number> = {};

  for (const cat of catalog) {
    byCategory[cat.id] = byCategory[cat.id] ?? 0;
    for (const item of cat.items) {
      let optionId = sel.choices[item.id];
      let price = optionId != null ? priceFor(region, customItems, item.id, optionId) : null;
      if (price == null) {
        // Fall back to the first option available in this region.
        const fallback = firstPricedOption(region, customItems, item);
        if (fallback == null) {
          items.push({ item, categoryId: cat.id, optionId: optionId ?? '', optionLabel: 'Not applicable here', qty: null, monthlyLocal: 0, available: false });
          continue;
        }
        optionId = fallback;
        price = priceFor(region, customItems, item.id, optionId)!;
      }
      const option = item.options.find((o) => o.id === optionId);
      const people = item.perPerson ? sel.household : 1;
      let monthly: number;
      let qty: number | null = null;
      if (item.mode === 'quantity') {
        qty = sel.quantities[item.id] ?? 0;
        monthly = (price * qty * people) / 12;
      } else {
        monthly = price * people;
      }
      items.push({
        item, categoryId: cat.id, optionId,
        optionLabel: option?.label ?? optionId,
        qty, monthlyLocal: monthly, available: true,
      });
      byCategory[cat.id] += monthly;
    }
  }

  const livingTotalLocal = items.reduce((s, i) => s + i.monthlyLocal, 0);
  const rentLocal = sel.includeRent && rentMonthlyLocal != null ? rentMonthlyLocal : 0;
  return { items, byCategory, livingTotalLocal, rentLocal, totalLocal: livingTotalLocal + rentLocal };
}

// Seed selections for a region from a preset band, skipping options that
// aren't priced there.
export function seedFromBand(
  region: RegionData,
  catalog: CostCategory[],
  customItems: CustomItem[],
  band: Selections['band']
): { choices: Record<string, string>; quantities: Record<string, number> } {
  const preset = region.bandPresets[band];
  const choices: Record<string, string> = {};
  const quantities: Record<string, number> = { ...(preset?.quantities ?? {}) };
  for (const cat of catalog) {
    for (const item of cat.items) {
      const wanted = preset?.choices?.[item.id];
      const priced =
        wanted != null && priceFor(region, customItems, item.id, wanted) != null
          ? wanted
          : firstPricedOption(region, customItems, item);
      if (priced != null) choices[item.id] = priced;
      if (item.mode === 'quantity' && quantities[item.id] == null) quantities[item.id] = 0;
    }
  }
  return { choices, quantities };
}
