import { Assumptions, DisplayCurrency, RegionData, RentEstimate, Selections } from '../types';
import { CostBreakdown } from '../lib/costEngine';
import { convert, inflate, DISPLAY_CURRENCIES } from '../data/currencies';
import { fmtMoney } from '../lib/format';

interface Props {
  region: RegionData;
  sel: Selections;
  onSelChange: (s: Selections) => void;
  breakdown: CostBreakdown;
  estimate: RentEstimate;
  assumptions: Assumptions;
  fundingOpen: boolean;
  onToggleFunding: () => void;
}

export default function SummaryBar({ region, sel, onSelChange, breakdown, estimate, assumptions, fundingOpen, onToggleFunding }: Props) {
  const cur = region.localCurrency;
  const cpi = assumptions.cpiPct[region.id] ?? 2.5;
  const years = sel.year - assumptions.baseYear;
  const project = (v: number) =>
    convert(inflate(v, cpi, years), cur, sel.displayCurrency, assumptions.usdPerUnit);

  const living = breakdown.livingTotalLocal;
  const rent = breakdown.rentLocal;
  const total = project(living + rent);
  // Range: rent zone spread + a modest ±6% band on living costs
  const rentLow = sel.includeRent && estimate.lowLocal != null ? estimate.lowLocal : rent;
  const rentHigh = sel.includeRent && estimate.highLocal != null ? estimate.highLocal : rent;
  const low = project(living * 0.94 + rentLow);
  const high = project(living * 1.06 + rentHigh);

  return (
    <div className="summary-bar">
      <div className="summary-main">
        <div className="summary-total">
          <span className="total-label">{region.flag} {region.name} · {sel.year}</span>
          <span className="total-value">{fmtMoney(total, sel.displayCurrency)}<span className="unit">/month</span></span>
          <span className="total-range">
            {fmtMoney(low, sel.displayCurrency)} – {fmtMoney(high, sel.displayCurrency)} ·{' '}
            {fmtMoney(total * 12, sel.displayCurrency)}/year
          </span>
        </div>
        <div className="summary-split muted">
          rent {fmtMoney(project(rent), sel.displayCurrency)} · living {fmtMoney(project(living), sel.displayCurrency)}
          {years > 0 && <> · in {sel.year} dollars at {cpi}% CPI</>}
        </div>
      </div>
      <div className="summary-controls">
        <button className={`funding-toggle ${fundingOpen ? 'open' : ''}`} onClick={onToggleFunding}>
          💰 Can I afford this? {fundingOpen ? '▾' : '▴'}
        </button>
        <label className="year-slider">
          <span>Year: <strong>{sel.year}</strong>{years > 0 ? ` (+${years})` : ''}</span>
          <input
            type="range" min={assumptions.baseYear} max={assumptions.baseYear + 25} step={1}
            value={sel.year}
            onChange={(e) => onSelChange({ ...sel, year: Number(e.target.value) })}
          />
        </label>
        <label>
          Currency
          <select
            value={sel.displayCurrency}
            onChange={(e) => onSelChange({ ...sel, displayCurrency: e.target.value as DisplayCurrency })}
          >
            {DISPLAY_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Household
          <select value={sel.household} onChange={(e) => onSelChange({ ...sel, household: Number(e.target.value) })}>
            <option value={1}>1 person</option>
            <option value={2}>couple</option>
          </select>
        </label>
      </div>
    </div>
  );
}
