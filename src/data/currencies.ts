import { Assumptions, CurrencyCode, DisplayCurrency } from '../types';

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  USD: 'US$',
  CAD: 'CA$',
  AUD: 'A$',
  THB: '฿',
};

export const DISPLAY_CURRENCIES: DisplayCurrency[] = ['USD', 'CAD', 'AUD'];

// Mid-2026 market rates (editable in Settings)
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  baseYear: 2026,
  usdPerUnit: {
    USD: 1.0,
    CAD: 0.73,
    AUD: 0.66,
    THB: 0.0305,
  },
  // Long-run CPI assumptions per region (annual %). RBA target midpoint for
  // AU, BoC target for CA, Thailand's structurally low inflation for TH.
  cpiPct: {
    seq: 2.7,
    ontario: 2.1,
    thailand: 1.4,
  },
  geminiModel: 'gemini-2.5-flash',
};

export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  usdPerUnit: Record<CurrencyCode, number>
): number {
  return (amount * usdPerUnit[from]) / usdPerUnit[to];
}

export function inflate(amount: number, cpiPct: number, years: number): number {
  return amount * Math.pow(1 + cpiPct / 100, Math.max(0, years));
}
