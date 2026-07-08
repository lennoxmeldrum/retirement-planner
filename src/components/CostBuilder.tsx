import { Assumptions, BandId, CostCategory, DisplayCurrency, RegionData, Selections, CustomItem } from '../types';
import { CostBreakdown, seedFromBand } from '../lib/costEngine';
import { convert } from '../data/currencies';
import { fmtMoney } from '../lib/format';

interface Props {
  region: RegionData;
  catalog: CostCategory[];
  customItems: CustomItem[];
  sel: Selections;
  onSelChange: (s: Selections) => void;
  breakdown: CostBreakdown;
  assumptions: Assumptions;
  displayCurrency: DisplayCurrency;
}

const BANDS: { id: BandId; label: string; blurb: string }[] = [
  { id: 'essential', label: 'Essential', blurb: 'No frills, public options' },
  { id: 'comfortable', label: 'Comfortable', blurb: 'The sensible middle' },
  { id: 'premium', label: 'Premium', blurb: 'New car, more travel' },
  { id: 'luxury', label: 'Luxury', blurb: 'Business class life' },
];

export default function CostBuilder({
  region, catalog, customItems, sel, onSelChange, breakdown, assumptions, displayCurrency,
}: Props) {
  const cur = region.localCurrency;
  const toDisplay = (v: number) => convert(v, cur, displayCurrency, assumptions.usdPerUnit);

  const applyBand = (band: BandId) => {
    const seeded = seedFromBand(region, catalog, customItems, band);
    onSelChange({ ...sel, band, choices: seeded.choices, quantities: seeded.quantities });
  };

  const itemCost = (itemId: string) => breakdown.items.find((i) => i.item.id === itemId);

  return (
    <div className="cost-builder">
      <div className="card">
        <h3>⚡ Quick start — pick a lifestyle band</h3>
        <p className="muted">Sets every option below to a researched preset for {region.name}. Then fine-tune anything.</p>
        <div className="band-row">
          {BANDS.map((b) => (
            <button
              key={b.id}
              className={`band-btn ${sel.band === b.id ? 'active' : ''}`}
              onClick={() => applyBand(b.id)}
            >
              <span className="band-name">{b.label}</span>
              <span className="band-blurb">{b.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      {catalog.map((cat) => {
        const subtotal = breakdown.byCategory[cat.id] ?? 0;
        return (
          <details key={cat.id} className="card category" open={cat.id === 'housing'}>
            <summary>
              <span className="cat-title">{cat.icon} {cat.label}</span>
              <span className="cat-subtotal">
                {fmtMoney(subtotal, cur)}/mo <span className="muted">≈ {fmtMoney(toDisplay(subtotal), displayCurrency)}</span>
              </span>
            </summary>
            <p className="muted cat-desc">{cat.description}</p>
            {cat.items.map((item) => {
              const cost = itemCost(item.id);
              if (cost && !cost.available) {
                return (
                  <div key={item.id} className="item-row unavailable">
                    <div className="item-head"><span className="item-label">{item.label}</span></div>
                    <div className="muted">Not applicable in {region.name}</div>
                  </div>
                );
              }
              const selectedId = cost?.optionId ?? sel.choices[item.id];
              const regionNote = region.itemNotes?.[item.id]?.[selectedId ?? ''];
              const option = item.options.find((o) => o.id === selectedId);
              const note = regionNote ?? option?.note;
              const priced = item.options.filter((o) => {
                const custom = customItems.find((c) => c.id === item.id);
                const table = custom ? custom.prices[region.id] : region.prices[item.id];
                return table && table[o.id] != null;
              });
              return (
                <div key={item.id} className="item-row">
                  <div className="item-head">
                    <span className="item-label">
                      {item.label}
                      {item.perPerson && <span className="pp-badge" title="Multiplied by household size">×{sel.household}</span>}
                    </span>
                    <span className="item-cost">
                      {fmtMoney(cost?.monthlyLocal ?? 0, cur)}/mo
                      <span className="muted"> ≈ {fmtMoney(toDisplay(cost?.monthlyLocal ?? 0), displayCurrency)}</span>
                    </span>
                  </div>
                  {item.description && <div className="item-desc muted">{item.description}</div>}
                  <div className="item-controls">
                    <select
                      value={selectedId}
                      onChange={(e) => onSelChange({ ...sel, choices: { ...sel.choices, [item.id]: e.target.value } })}
                    >
                      {priced.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    {item.mode === 'quantity' && (
                      <label className="qty-control">
                        <input
                          type="number" min={0} max={item.maxQty ?? 50}
                          value={sel.quantities[item.id] ?? 0}
                          onChange={(e) =>
                            onSelChange({ ...sel, quantities: { ...sel.quantities, [item.id]: Math.max(0, Number(e.target.value)) } })
                          }
                        />
                        <span className="muted">{item.qtyLabel}</span>
                      </label>
                    )}
                  </div>
                  {note && <div className="option-note">{note}</div>}
                </div>
              );
            })}
            {cat.id === 'taxes-visas' && (
              <div className="region-notes">
                <p><strong>Visas:</strong> {region.visaNote}</p>
                <p><strong>Tax:</strong> {region.taxNote}</p>
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
