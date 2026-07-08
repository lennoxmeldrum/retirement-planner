import { useEffect, useMemo, useState } from 'react';
import { BUILT_IN_REGIONS } from './data/regions';
import { CATALOG } from './data/catalog';
import { Assumptions, BandId, CostCategory, CustomItem, FundingPlan, RegionData, Selections } from './types';
import { computeBreakdown, seedFromBand } from './lib/costEngine';
import { BBox, estimateRent } from './lib/geo';
import { convert } from './data/currencies';
import {
  loadAssumptions, saveAssumptions, loadCustomRegions, saveCustomRegions,
  loadCustomItems, saveCustomItems, loadSelectionsMap, saveSelectionsMap,
  loadFundingPlan, saveFundingPlan,
} from './lib/storage';
import FundingPanel, { BandSpend } from './components/FundingPanel';
import MapPanel from './components/MapPanel';
import RentPanel from './components/RentPanel';
import CostBuilder from './components/CostBuilder';
import SummaryBar from './components/SummaryBar';
import SettingsPage from './components/SettingsPage';

function defaultSelections(
  region: RegionData, catalog: CostCategory[], customItems: CustomItem[],
  assumptions: Assumptions, prev?: Selections
): Selections {
  const seeded = seedFromBand(region, catalog, customItems, 'comfortable');
  return {
    regionId: region.id,
    band: 'comfortable',
    choices: seeded.choices,
    quantities: seeded.quantities,
    household: prev?.household ?? 2,
    includeRent: true,
    rentalReq: { propertyType: 'apartment', bedrooms: 2, furnished: false },
    lockedZoneId: null,
    year: prev?.year ?? assumptions.baseYear,
    displayCurrency: prev?.displayCurrency ?? 'USD',
  };
}

export default function App() {
  const [assumptions, setAssumptions] = useState<Assumptions>(loadAssumptions);
  const [customRegions, setCustomRegions] = useState<RegionData[]>(loadCustomRegions);
  const [customItems, setCustomItems] = useState<CustomItem[]>(loadCustomItems);
  const [selectionsMap, setSelectionsMap] = useState<Record<string, Selections>>(loadSelectionsMap);
  const [activeRegionId, setActiveRegionId] = useState<string>(BUILT_IN_REGIONS[0].id);
  const [view, setView] = useState<'planner' | 'settings'>('planner');
  const [bounds, setBounds] = useState<BBox | null>(null);
  const [fundingPlan, setFundingPlan] = useState<FundingPlan>(loadFundingPlan);
  const [fundingOpen, setFundingOpen] = useState(false);

  useEffect(() => saveAssumptions(assumptions), [assumptions]);
  useEffect(() => saveCustomRegions(customRegions), [customRegions]);
  useEffect(() => saveCustomItems(customItems), [customItems]);
  useEffect(() => saveSelectionsMap(selectionsMap), [selectionsMap]);
  useEffect(() => saveFundingPlan(fundingPlan), [fundingPlan]);

  const regions = useMemo(() => [...BUILT_IN_REGIONS, ...customRegions], [customRegions]);
  const region = regions.find((r) => r.id === activeRegionId) ?? regions[0];

  const catalog = useMemo<CostCategory[]>(
    () =>
      CATALOG.map((cat) => ({
        ...cat,
        items: [...cat.items, ...customItems.filter((ci) => ci.categoryId === cat.id)],
      })),
    [customItems]
  );

  const sel: Selections =
    selectionsMap[region.id] ?? defaultSelections(region, catalog, customItems, assumptions);

  const setSel = (s: Selections) => setSelectionsMap({ ...selectionsMap, [region.id]: s });

  const switchRegion = (id: string) => {
    const next = regions.find((r) => r.id === id);
    if (!next) return;
    setBounds(null);
    if (!selectionsMap[id]) {
      setSelectionsMap({
        ...selectionsMap,
        [id]: defaultSelections(next, catalog, customItems, assumptions, sel),
      });
    }
    setActiveRegionId(id);
    setView('planner');
  };

  const estimate = useMemo(
    () => estimateRent(region.zones, sel.rentalReq, bounds, sel.lockedZoneId),
    [region, sel.rentalReq, bounds, sel.lockedZoneId]
  );

  const breakdown = useMemo(
    () => computeBreakdown(region, catalog, customItems, sel, estimate.monthlyLocal),
    [region, catalog, customItems, sel, estimate.monthlyLocal]
  );

  const toDisplay = (local: number) =>
    convert(local, region.localCurrency, sel.displayCurrency, assumptions.usdPerUnit);
  const annualSpendBase = toDisplay(breakdown.totalLocal) * 12;

  const BAND_LABELS: Record<BandId, string> = {
    essential: 'Essential', comfortable: 'Comfortable', premium: 'Premium', luxury: 'Luxury',
  };
  const bandSpends: BandSpend[] = useMemo(
    () =>
      (Object.keys(BAND_LABELS) as BandId[]).map((band) => {
        const seeded = seedFromBand(region, catalog, customItems, band);
        const bd = computeBreakdown(
          region, catalog, customItems,
          { ...sel, band, choices: seeded.choices, quantities: seeded.quantities },
          estimate.monthlyLocal
        );
        return {
          band, label: BAND_LABELS[band],
          annualSpendBase:
            convert(bd.totalLocal, region.localCurrency, sel.displayCurrency, assumptions.usdPerUnit) * 12,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [region, catalog, customItems, sel.household, sel.includeRent, sel.displayCurrency, estimate.monthlyLocal, assumptions]
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🌏 Retirement Cost Planner</div>
        <nav className="region-tabs">
          {regions.map((r) => (
            <button
              key={r.id}
              className={`tab ${view === 'planner' && r.id === region.id ? 'active' : ''}`}
              onClick={() => switchRegion(r.id)}
            >
              {r.flag} {r.name}
            </button>
          ))}
          <button className={`tab settings-tab ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
            ⚙️ Settings
          </button>
        </nav>
      </header>

      {view === 'planner' ? (
        <>
          <main className="planner">
            <section className="map-col">
              <MapPanel
                region={region}
                req={sel.rentalReq}
                lockedZoneId={sel.lockedZoneId}
                onLockZone={(zoneId) => setSel({ ...sel, lockedZoneId: zoneId })}
                onBoundsChange={setBounds}
              />
              <RentPanel
                region={region}
                req={sel.rentalReq}
                onReqChange={(r) => setSel({ ...sel, rentalReq: r })}
                estimate={estimate}
                includeRent={sel.includeRent}
                onIncludeRentChange={(v) => setSel({ ...sel, includeRent: v })}
                lockedZoneId={sel.lockedZoneId}
                onUnlock={() => setSel({ ...sel, lockedZoneId: null })}
                displayCurrency={sel.displayCurrency}
                assumptions={assumptions}
              />
            </section>
            <section className="cost-col">
              <CostBuilder
                region={region}
                catalog={catalog}
                customItems={customItems}
                sel={sel}
                onSelChange={setSel}
                breakdown={breakdown}
                assumptions={assumptions}
                displayCurrency={sel.displayCurrency}
              />
            </section>
          </main>
          <footer className="dock">
            {fundingOpen && (
              <FundingPanel
                region={region}
                sel={sel}
                plan={fundingPlan}
                onPlanChange={setFundingPlan}
                assumptions={assumptions}
                annualSpendBase={annualSpendBase}
                bandSpends={bandSpends}
              />
            )}
            <SummaryBar
              region={region}
              sel={sel}
              onSelChange={setSel}
              breakdown={breakdown}
              estimate={estimate}
              assumptions={assumptions}
              fundingOpen={fundingOpen}
              onToggleFunding={() => setFundingOpen(!fundingOpen)}
            />
          </footer>
        </>
      ) : (
        <main className="settings-main">
          <SettingsPage
            assumptions={assumptions}
            onAssumptions={setAssumptions}
            regions={regions}
            customRegions={customRegions}
            onCustomRegions={setCustomRegions}
            customItems={customItems}
            onCustomItems={setCustomItems}
          />
        </main>
      )}
    </div>
  );
}
