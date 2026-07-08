import { useState } from 'react';
import { Assumptions, CustomItem, RegionData } from '../types';
import { CURRENCY_SYMBOL } from '../data/currencies';
import { CATALOG } from '../data/catalog';
import { getApiKey, hasApiKey, researchRegion, refreshRegionPrices, suggestNewInputs, SuggestedItem } from '../lib/gemini';
import { exportAll, importAll, loadGeminiKey, saveGeminiKey } from '../lib/storage';

interface Props {
  assumptions: Assumptions;
  onAssumptions: (a: Assumptions) => void;
  regions: RegionData[];
  customRegions: RegionData[];
  onCustomRegions: (r: RegionData[]) => void;
  customItems: CustomItem[];
  onCustomItems: (i: CustomItem[]) => void;
}

export default function SettingsPage({
  assumptions, onAssumptions, regions, customRegions, onCustomRegions, customItems, onCustomItems,
}: Props) {
  const [keyInput, setKeyInput] = useState(loadGeminiKey());
  const [newRegionName, setNewRegionName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedItem[]>([]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(null); setInfo(null);
    try { await fn(); } catch (e: any) { setError(e?.message ?? String(e)); }
    setBusy(null);
  };

  const addRegion = () =>
    run('research', async () => {
      const name = newRegionName.trim();
      if (!name) throw new Error('Type a region first, e.g. "Algarve, Portugal" or "Penang, Malaysia".');
      const region = await researchRegion(name, assumptions.geminiModel);
      if (regions.some((r) => r.id === region.id)) region.id = `${region.id}-2`;
      onCustomRegions([...customRegions, region]);
      if (assumptions.cpiPct[region.id] == null) {
        onAssumptions({ ...assumptions, cpiPct: { ...assumptions.cpiPct, [region.id]: 2.5 } });
      }
      setNewRegionName('');
      setInfo(`Added ${region.name} with ${region.zones.length} rental zones. It's now in the region tabs — review the numbers before trusting them.`);
    });

  const refreshRegion = (region: RegionData) =>
    run(`refresh-${region.id}`, async () => {
      const patch = await refreshRegionPrices(region, assumptions.geminiModel);
      const apply = (r: RegionData): RegionData => ({
        ...r,
        prices: { ...r.prices, ...(patch.prices ?? {}) },
        zones: r.zones.map((z) => {
          const upd = (patch.zones ?? []).find((p: any) => p.id === z.id);
          return upd?.rent ? { ...z, rent: upd.rent } : z;
        }),
        pricesAsOf: patch.pricesAsOf ?? r.pricesAsOf,
        sources: patch.sources?.length ? patch.sources : r.sources,
      });
      if (region.custom) {
        onCustomRegions(customRegions.map((r) => (r.id === region.id ? apply(r) : r)));
        setInfo(`${region.name} refreshed.`);
      } else {
        // Built-in regions: a refreshed copy is stored as a custom override.
        const copy = apply({ ...region, id: `${region.id}-updated`, name: `${region.name} (updated)`, custom: true });
        onCustomRegions([...customRegions, copy]);
        setInfo(`Built-in data is read-only, so the refreshed version was added as "${copy.name}" in the region tabs.`);
      }
    });

  const discover = () =>
    run('discover', async () => {
      const items = await suggestNewInputs(regions, assumptions.geminiModel);
      if (!items.length) throw new Error('No suggestions returned — try again.');
      setSuggestions(items);
    });

  const acceptSuggestion = (s: SuggestedItem) => {
    if (customItems.some((c) => c.id === s.id)) return;
    const item: CustomItem = {
      id: s.id, label: s.label, description: s.description,
      categoryId: CATALOG.some((c) => c.id === s.categoryId) ? s.categoryId : 'lifestyle',
      mode: 'choice', options: s.options, prices: s.prices,
    };
    onCustomItems([...customItems, item]);
    setSuggestions(suggestions.filter((x) => x.id !== s.id));
  };

  const doExport = () => {
    const blob = new Blob([exportAll()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'retirement-planner-data.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = (file: File) =>
    run('import', async () => {
      importAll(await file.text());
      setInfo('Imported. Reload the page to apply everything.');
    });

  return (
    <div className="settings">
      {error && <div className="banner error">⚠️ {error}</div>}
      {info && <div className="banner info">✅ {info}</div>}

      <div className="card">
        <h3>🤖 Gemini research engine</h3>
        <p className="muted">
          Powers "add a region", price refreshes and new-input discovery. All the shipped data for the three built-in
          regions works without it. Status: {hasApiKey() ? <strong>connected ({getApiKey().slice(0, 6)}…)</strong> : <strong>no key configured</strong>}
        </p>
        <div className="settings-grid">
          <label>
            API key (stored only in this browser; on Cloud Run set GEMINI_API_KEY or API_KEY instead)
            <input
              type="password" value={keyInput} placeholder="AIza..."
              onChange={(e) => setKeyInput(e.target.value)}
              onBlur={() => saveGeminiKey(keyInput.trim())}
            />
          </label>
          <label>
            Model
            <select
              value={assumptions.geminiModel}
              onChange={(e) => onAssumptions({ ...assumptions, geminiModel: e.target.value })}
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash (fast)</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro (thorough)</option>
              <option value="gemini-flash-latest">gemini-flash-latest</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <h3>🌍 Regions</h3>
        <table className="settings-table">
          <tbody>
            {regions.map((r) => (
              <tr key={r.id}>
                <td>{r.flag} <strong>{r.name}</strong> <span className="muted">({r.zones.length} zones · prices {r.pricesAsOf}{r.custom ? ' · AI-researched' : ' · built-in'})</span></td>
                <td className="row-actions">
                  <button disabled={busy != null} onClick={() => refreshRegion(r)}>
                    {busy === `refresh-${r.id}` ? 'Refreshing…' : 'Refresh prices'}
                  </button>
                  {r.custom && (
                    <button className="danger" onClick={() => onCustomRegions(customRegions.filter((c) => c.id !== r.id))}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="add-region">
          <input
            value={newRegionName}
            placeholder='Add a region, e.g. "Algarve, Portugal" or "Chiang Mai, Thailand"'
            onChange={(e) => setNewRegionName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRegion()}
          />
          <button disabled={busy != null} onClick={addRegion}>
            {busy === 'research' ? 'Researching… (30–90s)' : 'Research & add'}
          </button>
        </div>
        <p className="fine-print">
          Research uses Gemini with Google Search grounding to build rental zones, polygons and a full price map.
          Always sanity-check AI-researched numbers before relying on them.
        </p>
      </div>

      <div className="card">
        <h3>🧩 Discover new cost inputs</h3>
        <p className="muted">Ask Gemini to suggest expenses this planner doesn't cover yet, priced for every region.</p>
        <button disabled={busy != null} onClick={discover}>
          {busy === 'discover' ? 'Searching…' : 'Search for new inputs'}
        </button>
        {suggestions.map((s) => (
          <div key={s.id} className="suggestion">
            <div>
              <strong>{s.label}</strong> <span className="muted">→ {s.categoryId}</span>
              <div className="muted">{s.description}</div>
            </div>
            <button onClick={() => acceptSuggestion(s)}>Add</button>
          </div>
        ))}
        {customItems.length > 0 && (
          <div className="custom-items">
            <h4>Added inputs</h4>
            {customItems.map((c) => (
              <div key={c.id} className="suggestion">
                <span>{c.label} <span className="muted">({c.categoryId})</span></span>
                <button className="danger" onClick={() => onCustomItems(customItems.filter((x) => x.id !== c.id))}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>📐 Assumptions</h3>
        <div className="settings-grid">
          {(['AUD', 'CAD', 'THB'] as const).map((c) => (
            <label key={c}>
              USD per 1 {CURRENCY_SYMBOL[c]} ({c})
              <input
                type="number" step="0.001" value={assumptions.usdPerUnit[c]}
                onChange={(e) => onAssumptions({
                  ...assumptions,
                  usdPerUnit: { ...assumptions.usdPerUnit, [c]: Number(e.target.value) || assumptions.usdPerUnit[c] },
                })}
              />
            </label>
          ))}
          {regions.map((r) => (
            <label key={r.id}>
              {r.name} CPI %/yr
              <input
                type="number" step="0.1" value={assumptions.cpiPct[r.id] ?? 2.5}
                onChange={(e) => onAssumptions({
                  ...assumptions,
                  cpiPct: { ...assumptions.cpiPct, [r.id]: Number(e.target.value) },
                })}
              />
            </label>
          ))}
        </div>
        <p className="fine-print">
          FX is held constant across the projection (currency forecasting is guesswork); the year slider applies each
          region's CPI to local costs, then converts. Base year: {assumptions.baseYear}.
        </p>
      </div>

      <div className="card">
        <h3>💾 Your data</h3>
        <div className="row-actions">
          <button onClick={doExport}>Export everything (JSON)</button>
          <label className="file-btn">
            Import JSON
            <input type="file" accept="application/json" hidden
              onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          </label>
        </div>
        <p className="fine-print">Selections, assumptions, AI-researched regions and custom inputs live in this browser's storage — export to move or back up.</p>
      </div>
    </div>
  );
}
