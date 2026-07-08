import { CurrencyCode } from '../types';
import { CURRENCY_SYMBOL } from '../data/currencies';

export function fmtMoney(amount: number, currency: CurrencyCode, digits = 0): string {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const n = amount.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${sym}${n}`;
}

export function fmtRange(low: number, high: number, currency: CurrencyCode): string {
  return `${fmtMoney(low, currency)} – ${fmtMoney(high, currency)}`;
}

export function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

export function fmtCompact(amount: number, currency: CurrencyCode): string {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const abs = Math.abs(amount);
  if (abs >= 1e6) return `${sym}${(amount / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sym}${Math.round(amount / 1e3)}k`;
  return `${sym}${Math.round(amount)}`;
}
