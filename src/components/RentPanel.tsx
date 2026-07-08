import { PropertyType, RegionData, RentEstimate, RentalRequirements, DisplayCurrency, Assumptions } from '../types';
import { convert } from '../data/currencies';
import { fmtMoney, fmtRange } from '../lib/format';

interface Props {
  region: RegionData;
  req: RentalRequirements;
  onReqChange: (r: RentalRequirements) => void;
  estimate: RentEstimate;
  includeRent: boolean;
  onIncludeRentChange: (v: boolean) => void;
  lockedZoneId: string | null;
  onUnlock: () => void;
  displayCurrency: DisplayCurrency;
  assumptions: Assumptions;
}

const PROPERTY_TYPES: { id: PropertyType; label: string }[] = [
  { id: 'apartment', label: 'Apartment / condo' },
  { id: 'townhouse', label: 'Townhouse' },
  { id: 'house', label: 'House' },
  { id: 'villa', label: 'Villa / luxury' },
];

export default function RentPanel({
  region, req, onReqChange, estimate, includeRent, onIncludeRentChange,
  lockedZoneId, onUnlock, displayCurrency, assumptions,
}: Props) {
  const cur = region.localCurrency;
  const toDisplay = (v: number) => convert(v, cur, displayCurrency, assumptions.usdPerUnit);
  const lockedZone = lockedZoneId ? region.zones.find((z) => z.id === lockedZoneId) : null;

  return (
    <div className="card rent-panel">
      <div className="card-title-row">
        <h3>🔑 Rental requirements</h3>
        <label className="toggle">
          <input type="checkbox" checked={includeRent} onChange={(e) => onIncludeRentChange(e.target.checked)} />
          <span>include rent in total</span>
        </label>
      </div>
      <div className="rent-controls">
        <label>
          Property type
          <select value={req.propertyType} onChange={(e) => onReqChange({ ...req, propertyType: e.target.value as PropertyType })}>
            {PROPERTY_TYPES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label>
          Bedrooms
          <select value={req.bedrooms} onChange={(e) => onReqChange({ ...req, bedrooms: Number(e.target.value) })}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 4 ? '4+' : n}</option>)}
          </select>
        </label>
        <label className="toggle inline">
          <input type="checkbox" checked={req.furnished} onChange={(e) => onReqChange({ ...req, furnished: e.target.checked })} />
          <span>furnished</span>
        </label>
      </div>

      {lockedZone && (
        <div className="locked-banner">
          📍 Locked to <strong>{lockedZone.name}</strong>
          <button className="link-btn" onClick={onUnlock}>unlock</button>
        </div>
      )}

      {estimate.monthlyLocal != null ? (
        <div className="rent-result">
          <div className="rent-big">
            {fmtMoney(estimate.monthlyLocal, cur)}<span className="unit">/month</span>
          </div>
          <div className="rent-range">
            range {fmtRange(estimate.lowLocal!, estimate.highLocal!, cur)} · ≈ {fmtMoney(toDisplay(estimate.monthlyLocal), displayCurrency)}/mo
          </div>
          <div className="rent-note">{estimate.note}</div>
          {estimate.zoneBreakdown.length > 1 && (
            <div className="zone-breakdown">
              {estimate.zoneBreakdown.slice(0, 4).map((z) => (
                <div key={z.zoneId} className="zone-row">
                  <span>{z.name}</span>
                  <span>{Math.round(z.weight * 100)}% · {fmtMoney(z.monthly, cur)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rent-empty">{estimate.note}</div>
      )}
      <div className="fine-print">{region.rentNote}</div>
    </div>
  );
}
