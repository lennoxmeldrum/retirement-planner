import { useMemo, useState } from 'react';
import { Assumptions, BandId, FundingPlan, HomeCountry, RegionData, Selections } from '../types';
import { ALLOCATIONS, PENSION_RULES, buildGovPension, planAllocation, portfolioModel } from '../data/pensions';
import { SALE_NET_FRACTION, lookupPostcode } from '../data/property';
import { convert } from '../data/currencies';
import { simulate, successProbability, solveRequiredSavings, SimConfig } from '../lib/monteCarlo';
import { fmtCompact, fmtMoney } from '../lib/format';
import FanChart from './FanChart';

export interface BandSpend {
  band: BandId;
  label: string;
  annualSpendBase: number; // today's display $, incl. rent as configured
}

interface Props {
  region: RegionData;
  sel: Selections;
  plan: FundingPlan;
  onPlanChange: (p: FundingPlan) => void;
  assumptions: Assumptions;
  annualSpendBase: number;  // current selections, today's display $ per year
  bandSpends: BandSpend[];
}

const INDEX_CPI = 2.5; // pension & legacy-target indexing, %/yr

export default function FundingPanel({
  region, sel, plan, onPlanChange, assumptions, annualSpendBase, bandSpends,
}: Props) {
  const cur = sel.displayCurrency;
  const startYear = assumptions.baseYear;
  const rule = PENSION_RULES[plan.homeCountry];
  const [showAssumptions, setShowAssumptions] = useState(false);

  const area = lookupPostcode(plan.propertyPostcode);
  const propertyGrowthPct = plan.propertyGrowthOverridePct ?? area.growthPct;
  const property = useMemo(() => {
    if (plan.propertyValueAUD <= 0 || plan.propertySaleYear == null) return null;
    const saleYear = Math.max(plan.propertySaleYear, startYear);
    const grossAUD = plan.propertyValueAUD * Math.pow(1 + propertyGrowthPct / 100, saleYear - startYear);
    const proceedsAUD = grossAUD * SALE_NET_FRACTION;
    return {
      saleYear, grossAUD, proceedsAUD,
      proceeds: convert(proceedsAUD, 'AUD', cur, assumptions.usdPerUnit),
    };
  }, [plan.propertyValueAUD, plan.propertySaleYear, propertyGrowthPct, startYear, cur, assumptions.usdPerUnit]);

  const cfg: SimConfig = useMemo(() => {
    const alloc = planAllocation(plan);
    return {
      plan,
      household: sel.household,
      startYear,
      annualSpendBase,
      spendCpiPct: assumptions.cpiPct[region.id] ?? 2.5,
      indexCpiPct: INDEX_CPI,
      market: portfolioModel(alloc.stocks, alloc.bonds, alloc.cash),
      govPension: buildGovPension(plan, sel.household, assumptions.usdPerUnit, cur, INDEX_CPI, startYear),
      propertySale: property ? { year: property.saleYear, proceeds: property.proceeds } : null,
    };
  }, [plan, sel.household, annualSpendBase, assumptions, region.id, cur, startYear, property]);

  const sim = useMemo(() => simulate(cfg), [cfg]);

  const required = useMemo(
    () => solveRequiredSavings(cfg, plan.successTarget),
    [cfg, plan.successTarget]
  );

  const bandFits = useMemo(
    () =>
      bandSpends.map((b) => ({
        ...b,
        successProb: successProbability({ ...cfg, annualSpendBase: b.annualSpendBase, paths: 500 }),
      })),
    [cfg, bandSpends]
  );

  const set = (patch: Partial<FundingPlan>) => onPlanChange({ ...plan, ...patch });
  const num = (v: string, fallback = 0) => (v === '' ? fallback : Number(v));

  const successPct = Math.round(sim.successProb * 100);
  const verdictTone = successPct >= plan.successTarget ? 'good' : successPct >= plan.successTarget - 15 ? 'close' : 'short';
  const govAtStart = cfg.govPension(
    Math.max(plan.retirementYear, rule?.eligibleAge ? plan.birthYear1 + rule.eligibleAge : plan.retirementYear),
    plan.currentSavings
  );
  const gap = required != null ? plan.currentSavings - required : null;

  return (
    <div className="funding-panel">
      <div className="funding-inputs">
        <div className="fgroup">
          <h4>👥 About you</h4>
          <label>Year of birth {sel.household === 2 ? '(person 1)' : ''}
            <input type="number" min={1930} max={2010} value={plan.birthYear1}
              onChange={(e) => set({ birthYear1: num(e.target.value, plan.birthYear1) })} />
          </label>
          {sel.household === 2 && (
            <label>Year of birth (person 2)
              <input type="number" min={1930} max={2010} value={plan.birthYear2}
                onChange={(e) => set({ birthYear2: num(e.target.value, plan.birthYear2) })} />
            </label>
          )}
          <label>Retirement starts
            <input type="number" min={startYear} max={startYear + 30} value={plan.retirementYear}
              onChange={(e) => set({ retirementYear: num(e.target.value, plan.retirementYear) })} />
          </label>
          <label>Plan to age
            <input type="number" min={75} max={110} value={plan.horizonAge}
              onChange={(e) => set({ horizonAge: num(e.target.value, plan.horizonAge) })} />
          </label>
        </div>

        <div className="fgroup">
          <h4>📈 Portfolio</h4>
          <label>Savings today ({cur})
            <input type="number" min={0} step={10000} value={plan.currentSavings}
              onChange={(e) => set({ currentSavings: num(e.target.value) })} />
          </label>
          <label>Saving per month until retirement
            <input type="number" min={0} step={100} value={plan.monthlyContribution}
              onChange={(e) => set({ monthlyContribution: num(e.target.value) })} />
          </label>
          <label>Investment mix
            <select value={plan.allocationId} onChange={(e) => set({ allocationId: e.target.value as FundingPlan['allocationId'] })}>
              {ALLOCATIONS.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.blurb}</option>)}
              <option value="custom">Custom…</option>
            </select>
          </label>
          {plan.allocationId === 'custom' && (
            <div className="alloc-custom">
              {(['stocks', 'bonds', 'cash'] as const).map((k) => (
                <label key={k}>{k} %
                  <input type="number" min={0} max={100} value={plan.customAlloc[k]}
                    onChange={(e) => set({ customAlloc: { ...plan.customAlloc, [k]: num(e.target.value) } })} />
                </label>
              ))}
            </div>
          )}
          <div className="fine-print">
            Modelled at {(cfg.market.mu * 100).toFixed(1)}% expected nominal return,
            {' '}{(cfg.market.sigma * 100).toFixed(1)}% volatility. Shares ≈ broad index ETFs.
          </div>

          <div className="prop-block">
            <h5>🏡 Australian property (mortgage-free)</h5>
            <label>Value today (A$, 0 = none)
              <input type="number" min={0} step={25000} value={plan.propertyValueAUD}
                onChange={(e) => set({ propertyValueAUD: num(e.target.value) })} />
            </label>
            {plan.propertyValueAUD > 0 && (
              <>
                <div className="prop-row">
                  <label>Postcode
                    <input type="text" inputMode="numeric" maxLength={4} placeholder="e.g. 4217"
                      value={plan.propertyPostcode}
                      onChange={(e) => set({ propertyPostcode: e.target.value.replace(/\D/g, ''), propertyGrowthOverridePct: null })} />
                  </label>
                  <label>Growth %/yr
                    <input type="number" step={0.1} min={-5} max={15} value={propertyGrowthPct}
                      onChange={(e) => set({ propertyGrowthOverridePct: num(e.target.value, propertyGrowthPct) })} />
                  </label>
                  <label>Sell in
                    <input type="number" min={startYear} max={startYear + 40} disabled={plan.propertySaleYear == null}
                      value={plan.propertySaleYear ?? startYear}
                      onChange={(e) => set({ propertySaleYear: num(e.target.value, startYear) })} />
                  </label>
                </div>
                <label className="toggle inline">
                  <input type="checkbox" checked={plan.propertySaleYear != null}
                    onChange={(e) => set({ propertySaleYear: e.target.checked ? Math.max(startYear + 4, plan.retirementYear) : null })} />
                  <span>sell it and add the proceeds to the portfolio</span>
                </label>
                <div className="fine-print">
                  {plan.propertyPostcode.length >= 3
                    ? `${plan.propertyPostcode} → ${area.label}: ${area.growthPct}%/yr assumed`
                    : 'Enter a postcode to pick up the local growth assumption'}
                  {plan.propertyGrowthOverridePct != null && ' (overridden)'}
                  {property && (
                    <>
                      {' '}· Sale in {property.saleYear}: ≈ A${Math.round(property.grossAUD / 1000)}k gross →{' '}
                      {fmtCompact(property.proceeds, cur)} added to the portfolio
                      ({Math.round(SALE_NET_FRACTION * 100)}% after agent fees, taxes and costs)
                    </>
                  )}
                  {plan.propertySaleYear == null &&
                    ' · Kept indefinitely: its value stays outside the portfolio, but the Age Pension homeowner test still applies.'}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="fgroup">
          <h4>🏛️ Pensions & other income</h4>
          <label>Home country (government pension rules)
            <select value={plan.homeCountry} onChange={(e) => set({ homeCountry: e.target.value as HomeCountry, govPensionOverride: null })}>
              <option value="AU">Australia — Age Pension</option>
              <option value="CA">Canada — CPP + OAS</option>
              <option value="US">USA — Social Security</option>
              <option value="other">Other / none</option>
            </select>
          </label>
          <label>Government pension ({cur}/yr, household{rule ? `, from age ${rule.eligibleAge}` : ''})
            <input type="number" min={0} step={1000}
              value={plan.govPensionOverride ?? Math.round(govAtStart)}
              onChange={(e) => set({ govPensionOverride: num(e.target.value) })} />
          </label>
          {plan.govPensionOverride != null && (
            <button className="link-btn" onClick={() => set({ govPensionOverride: null })}>
              ← back to automatic {rule ? rule.label : ''} rules
            </button>
          )}
          {rule && plan.govPensionOverride == null && <div className="fine-print">{rule.note}</div>}
          <label>Other pensions / annuities / super income streams ({cur}/yr)
            <input type="number" min={0} step={1000} value={plan.otherPensionAnnual}
              onChange={(e) => set({ otherPensionAnnual: num(e.target.value) })} />
          </label>
        </div>

        <div className="fgroup">
          <h4>🎯 Goal</h4>
          <label>Leave behind at age {plan.horizonAge} ({cur}, today's money — 0 = spend to zero)
            <input type="number" min={0} step={50000} value={plan.legacyTarget}
              onChange={(e) => set({ legacyTarget: num(e.target.value) })} />
          </label>
          <label>Required confidence: <strong>{plan.successTarget}%</strong>
            <input type="range" min={50} max={95} step={5} value={plan.successTarget}
              onChange={(e) => set({ successTarget: num(e.target.value, 85) })} />
          </label>
        </div>
      </div>

      <div className="funding-results">
        <div className={`verdict verdict-${verdictTone}`}>
          <div className="verdict-big">{successPct}%</div>
          <div className="verdict-text">
            of 1,000 simulated markets fund <strong>{region.name}</strong> at your current
            selections ({fmtMoney(annualSpendBase / 12, cur)}/mo today) through age {plan.horizonAge}
            {plan.legacyTarget > 0 ? <> with {fmtCompact(plan.legacyTarget, cur)} left over</> : null}.
            {' '}Target: {plan.successTarget}%.
          </div>
        </div>

        <div className="fstats">
          <div className="fstat">
            <span className="fstat-label">Needed today for {plan.successTarget}%</span>
            <span className="fstat-value">{required != null ? fmtCompact(required, cur) : 'out of reach'}</span>
            {gap != null && (
              <span className={`fstat-sub ${gap >= 0 ? 'ok' : 'warn'}`}>
                {gap >= 0 ? `${fmtCompact(gap, cur)} buffer` : `${fmtCompact(-gap, cur)} short`}
              </span>
            )}
          </div>
          <div className="fstat">
            <span className="fstat-label">Median at retirement ({plan.retirementYear})</span>
            <span className="fstat-value">{fmtCompact(sim.balanceAtRetirementP50, cur)}</span>
            {sim.initialWithdrawalRate != null && (
              <span className="fstat-sub">
                {(sim.initialWithdrawalRate * 100).toFixed(1)}% initial withdrawal
                (net of pensions) · benchmark ~3.9%
              </span>
            )}
          </div>
          <div className="fstat">
            <span className="fstat-label">Money runs out</span>
            <span className="fstat-value">
              {sim.medianDepletionYear
                ? `${sim.medianDepletionYear} (median)`
                : `lasts past ${sim.horizonYear}`}
            </span>
            <span className="fstat-sub">
              {sim.detDepletionYear
                ? `steady-return path: ${sim.detDepletionYear}`
                : `median left at ${plan.horizonAge}: ${fmtCompact(sim.medianEnd, cur)}`}
            </span>
          </div>
        </div>

        <FanChart sim={sim} currency={cur} retirementYear={plan.retirementYear} saleYear={property?.saleYear} />

        <div className="bandfit">
          <h4>Which lifestyle can your money sustain here?</h4>
          <table className="bandfit-table">
            <thead>
              <tr><th>Lifestyle</th><th>Cost today</th><th>Success to {plan.horizonAge}</th><th></th></tr>
            </thead>
            <tbody>
              {bandFits.map((b) => {
                const pct = Math.round(b.successProb * 100);
                return (
                  <tr key={b.band}>
                    <td>{b.label}</td>
                    <td>{fmtMoney(b.annualSpendBase / 12, cur)}/mo</td>
                    <td>
                      <span className="fit-bar"><span className="fit-fill" style={{ width: `${pct}%` }} /></span>
                      <span className="fit-pct">{pct}%</span>
                    </td>
                    <td className="fit-flag">{pct >= plan.successTarget ? '✓ affordable' : pct >= plan.successTarget - 15 ? '~ marginal' : '✗ stretch'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="fine-print">
            Presets use this region's band prices with your current rent requirements. ✓ means the band meets
            your {plan.successTarget}% confidence target.
          </div>
        </div>

        <button className="link-btn" onClick={() => setShowAssumptions(!showAssumptions)}>
          {showAssumptions ? 'hide' : 'show'} model assumptions
        </button>
        {showAssumptions && (
          <div className="fine-print">
            Nominal Monte Carlo, 1,000 paths, yearly steps, normally-distributed portfolio returns
            (shares 7.2%±15.5%, bonds 4.3%±6.5%, cash 3.0%, shares/bonds correlation 0.15). Spending grows at the
            region's CPI ({cfg.spendCpiPct}%/yr); pensions and the legacy target index at {INDEX_CPI}%/yr; FX held
            constant. Australian Age Pension is re-means-tested against the portfolio every simulated year
            (homeowner free areas while you still own the Australian home — its value is exempt — switching to
            non-homeowner free areas once sold). Property grows deterministically at the postcode-area assumption;
            the sale adds 80% of gross value (agent fees, CGT and costs) in the sale year, and a pending sale can
            bridge a temporarily negative portfolio. Contributions stop and drawdown starts at retirement. "Success" = never
            running dry and finishing above the legacy target. Benchmark 3.9% is Morningstar's 2026 safe starting
            withdrawal rate (90% success, 30 years). Educational model — not financial advice.
          </div>
        )}
      </div>
    </div>
  );
}
