import { RentalRequirements, RentalZone, RentEstimate } from '../types';

type Pt = [number, number]; // [lat, lng]

export interface BBox { south: number; west: number; north: number; east: number }

// Sutherland–Hodgman clipping of a polygon against a lat/lng bounding box.
export function clipToBBox(poly: Pt[], b: BBox): Pt[] {
  const clipEdge = (pts: Pt[], inside: (p: Pt) => boolean, intersect: (a: Pt, c: Pt) => Pt): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const prev = pts[(i + pts.length - 1) % pts.length];
      const curIn = inside(cur);
      const prevIn = inside(prev);
      if (curIn) {
        if (!prevIn) out.push(intersect(prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(intersect(prev, cur));
      }
    }
    return out;
  };
  const lerp = (a: Pt, c: Pt, t: number): Pt => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
  let pts = poly;
  pts = clipEdge(pts, (p) => p[0] >= b.south, (a, c) => lerp(a, c, (b.south - a[0]) / (c[0] - a[0])));
  if (!pts.length) return pts;
  pts = clipEdge(pts, (p) => p[0] <= b.north, (a, c) => lerp(a, c, (b.north - a[0]) / (c[0] - a[0])));
  if (!pts.length) return pts;
  pts = clipEdge(pts, (p) => p[1] >= b.west, (a, c) => lerp(a, c, (b.west - a[1]) / (c[1] - a[1])));
  if (!pts.length) return pts;
  pts = clipEdge(pts, (p) => p[1] <= b.east, (a, c) => lerp(a, c, (b.east - a[1]) / (c[1] - a[1])));
  return pts;
}

// Approximate area in km² (planar shoelace with latitude correction —
// plenty accurate at city scale).
export function ringAreaKm2(poly: Pt[]): number {
  if (poly.length < 3) return 0;
  const midLat = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const kmPerLat = 111.32;
  const kmPerLng = 111.32 * Math.cos((midLat * Math.PI) / 180);
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const [lat1, lng1] = poly[i];
    const [lat2, lng2] = poly[(i + 1) % poly.length];
    area += lng1 * kmPerLng * (lat2 * kmPerLat) - lng2 * kmPerLng * (lat1 * kmPerLat);
  }
  return Math.abs(area / 2);
}

export function zoneBaseRent(
  zone: RentalZone,
  req: RentalRequirements
): { monthly: number; low: number; high: number } | null {
  const arr = zone.rent[req.propertyType];
  if (!arr) return null;
  const idx = Math.min(Math.max(req.bedrooms, 1), 4) - 1;
  let base = arr[idx] ?? null;
  if (base == null) return null;
  if (req.furnished) base *= 1 + zone.furnishedPremiumPct / 100;
  const s = zone.spreadPct / 100;
  return { monthly: base, low: base * (1 - s), high: base * (1 + s) };
}

// Weighted average rent across the zones visible in the current viewport.
// Weights are the visible (clipped) polygon areas — deliberately NOT circular
// radii, so a thin beachfront strip only dominates when you're zoomed onto it.
export function estimateRent(
  zones: RentalZone[],
  req: RentalRequirements,
  bounds: BBox | null,
  lockedZoneId: string | null
): RentEstimate {
  const empty = (note: string): RentEstimate => ({
    monthlyLocal: null, lowLocal: null, highLocal: null, zoneBreakdown: [], note,
  });

  if (lockedZoneId) {
    const zone = zones.find((z) => z.id === lockedZoneId);
    if (!zone) return empty('Locked zone not found.');
    const r = zoneBaseRent(zone, req);
    if (!r) return empty(`No ${req.bedrooms}-bed ${req.propertyType} stock is typical in ${zone.name}. Try another property type or unlock the zone.`);
    return {
      monthlyLocal: r.monthly, lowLocal: r.low, highLocal: r.high,
      zoneBreakdown: [{ zoneId: zone.id, name: zone.name, weight: 1, monthly: r.monthly }],
      note: `Locked to ${zone.name}.`,
    };
  }

  if (!bounds) return empty('Move the map to estimate rent.');

  const contributions: { zoneId: string; name: string; area: number; r: { monthly: number; low: number; high: number } }[] = [];
  let visibleButNoStock = 0;
  for (const zone of zones) {
    const clipped = clipToBBox(zone.polygon, bounds);
    if (clipped.length < 3) continue;
    const area = ringAreaKm2(clipped);
    if (area <= 0) continue;
    const r = zoneBaseRent(zone, req);
    if (!r) { visibleButNoStock++; continue; }
    contributions.push({ zoneId: zone.id, name: zone.name, area, r });
  }

  if (!contributions.length) {
    return empty(
      visibleButNoStock > 0
        ? `The zones in view don't typically offer a ${req.bedrooms}-bed ${req.propertyType}. Try a different property type or size.`
        : 'No priced zones in view — pan or zoom the map to a shaded area.'
    );
  }

  const totalArea = contributions.reduce((s, c) => s + c.area, 0);
  let monthly = 0, low = 0, high = 0;
  const zoneBreakdown = contributions
    .map((c) => {
      const w = c.area / totalArea;
      monthly += c.r.monthly * w;
      low += c.r.low * w;
      high += c.r.high * w;
      return { zoneId: c.zoneId, name: c.name, weight: w, monthly: c.r.monthly };
    })
    .sort((a, b) => b.weight - a.weight);

  const note =
    contributions.length === 1
      ? `Based on ${zoneBreakdown[0].name}.`
      : `Area-weighted across ${contributions.length} zones in view — zoom in for a tighter estimate.`;
  return { monthlyLocal: monthly, lowLocal: low, highLocal: high, zoneBreakdown, note };
}
