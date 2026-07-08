import { CATALOG } from '../data/catalog';
import { CustomItem, RegionData } from '../types';
import { loadGeminiKey } from './storage';

declare global {
  interface Window {
    RUNTIME_CONFIG?: Record<string, string>;
  }
}

export function getApiKey(): string {
  const rc = typeof window !== 'undefined' ? window.RUNTIME_CONFIG : undefined;
  return (
    rc?.GEMINI_API_KEY ||
    rc?.API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    loadGeminiKey() ||
    ''
  );
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

async function client() {
  const key = getApiKey();
  if (!key) throw new Error('No Gemini API key configured. Add one in Settings, or set GEMINI_API_KEY / API_KEY on the Cloud Run service.');
  // Loaded on demand so the planner itself never pays for the SDK.
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey: key });
}

// Pull the first balanced JSON object out of a model response.
export function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  if (start === -1) throw new Error('No JSON found in model response.');
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return JSON.parse(candidate.slice(start, i + 1));
    }
  }
  throw new Error('Unbalanced JSON in model response.');
}

function catalogSpec(): string {
  return CATALOG.map((cat) =>
    cat.items
      .map((item) => {
        const opts = item.options.map((o) => o.id).join(' | ');
        const mode = item.mode === 'quantity' ? 'PER-UNIT price (per trip/event/flight)' : 'MONTHLY price';
        return `"${item.id}" (${mode}): options ${opts}`;
      })
      .join('\n')
  ).join('\n');
}

const REGION_SCHEMA_HINT = `{
  "id": "kebab-case-id", "name": "...", "country": "...", "flag": "emoji",
  "localCurrency": "USD|CAD|AUD|THB (nearest of these; convert prices into it)",
  "center": [lat, lng], "zoom": 8,
  "rentNote": "...",
  "zones": [{
    "id": "...", "name": "...", "description": "...",
    "polygon": [[lat,lng] x 5-10 tracing the real shape - coastal strips must hug the coast, not circles],
    "rent": { "apartment": [1br,2br,3br,4br monthly or null], "townhouse": [...], "house": [...], "villa": [...] },
    "spreadPct": 15, "furnishedPremiumPct": 8
  } x 5-9 zones covering cheap AND expensive districts],
  "prices": { "<itemId>": { "<optionId>": number-or-null } for EVERY item below },
  "itemNotes": { "<itemId>": { "<optionId>": "local brand names / context" } },
  "bandPresets": { "essential": {"choices": {itemId: optionId}, "quantities": {itemId: perYear}},
                   "comfortable": {...}, "premium": {...}, "luxury": {...} },
  "visaNote": "...", "taxNote": "...", "pricesAsOf": "YYYY-MM", "sources": ["url", ...]
}`;

export async function researchRegion(regionName: string, model: string): Promise<RegionData> {
  const ai = await client();
  const prompt = `You are a cost-of-living research engine for a retirement planning app.
Research CURRENT (${new Date().getFullYear()}) rental prices and living costs for: "${regionName}".
Use web search to ground every number in real, current data (national rent reports, real-estate portals, utility regulators, insurer pricing).

Return ONE JSON object exactly matching this schema (no prose before or after):
${REGION_SCHEMA_HINT}

Price every one of these catalog items (local currency; null ONLY where genuinely not applicable, e.g. "citizen" visa in a country where the retiree would be a foreigner):
${catalogSpec()}

Rules:
- Rents are MONTHLY in local currency; use realistic median asking rents per zone.
- Zones must be real districts with non-circular polygons reflecting geography (beach/river/transit premiums).
- bandPresets must only reference option ids that have non-null prices.
- "quantity"-mode items get PER-UNIT prices (per ticket / per trip / per cruise for two / per flight per person).
- Include at least 3 source URLs.`;

  const res = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
  });
  const region = normalizeRegion(extractJson(res.text ?? ''));
  region.custom = true;
  return region;
}

export async function refreshRegionPrices(region: RegionData, model: string): Promise<Partial<RegionData>> {
  const ai = await client();
  const prompt = `Using web search, refresh this retirement cost dataset for "${region.name}" (${region.country}) to CURRENT prices in ${region.localCurrency}.
Return ONE JSON object: { "prices": {...same item/option ids...}, "zones": [{"id": existing zone id, "rent": {...}} ...], "pricesAsOf": "YYYY-MM", "sources": [...] }.
Only change numbers that are out of date. Current dataset:
${JSON.stringify({ zones: region.zones.map((z) => ({ id: z.id, name: z.name, rent: z.rent })), prices: region.prices, pricesAsOf: region.pricesAsOf })}`;
  const res = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }], temperature: 0.1 },
  });
  return extractJson(res.text ?? '');
}

export interface SuggestedItem {
  id: string;
  label: string;
  categoryId: string;
  description: string;
  options: { id: string; label: string }[];
  prices: Record<string, Record<string, number | null>>;
}

export async function suggestNewInputs(regions: RegionData[], model: string): Promise<SuggestedItem[]> {
  const ai = await client();
  const existing = CATALOG.flatMap((c) => c.items.map((i) => i.id)).join(', ');
  const regionList = regions.map((r) => `"${r.id}" (${r.name}, prices in ${r.localCurrency})`).join(', ');
  const categories = CATALOG.map((c) => c.id).join(' | ');
  const prompt = `A retirement cost-of-living app already covers these inputs: ${existing}.
Suggest 3-5 NEW cost inputs retirees often forget (use web search for realistic current prices). For each, price it for these regions: ${regionList}.
Return ONE JSON object: { "items": [{ "id": "kebab-id", "label": "...", "categoryId": one of ${categories}, "description": "...",
"options": [{"id":"low","label":"..."},{"id":"typical","label":"..."},{"id":"high","label":"..."}],
"prices": { "<regionId>": { "low": monthlyNumber, "typical": n, "high": n } } }] }`;
  const res = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }], temperature: 0.4 },
  });
  const parsed = extractJson(res.text ?? '');
  return (parsed.items ?? []) as SuggestedItem[];
}

// Coerce a model-produced region into a safe RegionData.
export function normalizeRegion(raw: any): RegionData {
  if (!raw || typeof raw !== 'object') throw new Error('Region research returned no usable object.');
  const req = ['id', 'name', 'country', 'localCurrency', 'center', 'zones', 'prices', 'bandPresets'];
  for (const k of req) if (raw[k] == null) throw new Error(`Region research is missing "${k}".`);
  if (!Array.isArray(raw.zones) || raw.zones.length === 0) throw new Error('Region research produced no zones.');
  const zones = raw.zones
    .filter((z: any) => Array.isArray(z.polygon) && z.polygon.length >= 3 && z.rent)
    .map((z: any, i: number) => ({
      id: String(z.id ?? `zone-${i}`),
      name: String(z.name ?? `Zone ${i + 1}`),
      description: String(z.description ?? ''),
      polygon: z.polygon.map((p: any) => [Number(p[0]), Number(p[1])] as [number, number]),
      rent: z.rent,
      spreadPct: Number(z.spreadPct ?? 15),
      furnishedPremiumPct: Number(z.furnishedPremiumPct ?? 8),
    }));
  if (!zones.length) throw new Error('No valid zones with polygons and rents.');
  const bands: any = {};
  for (const b of ['essential', 'comfortable', 'premium', 'luxury']) {
    const p = raw.bandPresets?.[b] ?? {};
    bands[b] = { choices: p.choices ?? {}, quantities: p.quantities ?? {} };
  }
  return {
    id: String(raw.id).toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name: String(raw.name),
    country: String(raw.country),
    flag: String(raw.flag ?? '🌍'),
    localCurrency: ['USD', 'CAD', 'AUD', 'THB'].includes(raw.localCurrency) ? raw.localCurrency : 'USD',
    center: [Number(raw.center[0]), Number(raw.center[1])],
    zoom: Number(raw.zoom ?? 8),
    rentNote: String(raw.rentNote ?? ''),
    zones,
    prices: raw.prices ?? {},
    itemNotes: raw.itemNotes ?? {},
    bandPresets: bands,
    visaNote: String(raw.visaNote ?? ''),
    taxNote: String(raw.taxNote ?? ''),
    pricesAsOf: String(raw.pricesAsOf ?? new Date().toISOString().slice(0, 7)),
    sources: Array.isArray(raw.sources) ? raw.sources.map(String) : [],
    custom: true,
  };
}
