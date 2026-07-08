import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RegionData, RentalRequirements } from '../types';
import { BBox, zoneBaseRent } from '../lib/geo';
import { fmtMoney } from '../lib/format';

interface Props {
  region: RegionData;
  req: RentalRequirements;
  lockedZoneId: string | null;
  onLockZone: (zoneId: string | null) => void;
  onBoundsChange: (b: BBox) => void;
}

function priceColor(t: number): string {
  // 0 = cheapest (teal-green) → 1 = priciest (warm red)
  const hue = 165 - t * 155;
  return `hsl(${hue}, 72%, 45%)`;
}

export default function MapPanel({ region, req, lockedZoneId, onLockZone, onBoundsChange }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Polygon[]>([]);
  const cbRef = useRef({ onLockZone, onBoundsChange, lockedZoneId });
  cbRef.current = { onLockZone, onBoundsChange, lockedZoneId };

  // Create the map once.
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomSnap: 0.5 }).setView(region.center, region.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const emit = () => {
      const b = map.getBounds();
      cbRef.current.onBoundsChange({
        south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast(),
      });
    };
    map.on('moveend zoomend', emit);
    mapRef.current = map;
    setTimeout(emit, 0);
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when the region changes.
  useEffect(() => {
    mapRef.current?.setView(region.center, region.zoom);
  }, [region.id]);

  // (Re)draw zone polygons when region / requirements / lock change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layersRef.current.forEach((l) => l.remove());
    layersRef.current = [];

    const rents = region.zones.map((z) => zoneBaseRent(z, req)?.monthly ?? null);
    const priced = rents.filter((r): r is number => r != null);
    const min = Math.min(...priced), max = Math.max(...priced);

    region.zones.forEach((zone, i) => {
      const rent = rents[i];
      const locked = lockedZoneId === zone.id;
      const hasStock = rent != null;
      const t = hasStock && max > min ? (rent - min) / (max - min) : 0.5;
      const poly = L.polygon(zone.polygon as [number, number][], {
        color: locked ? '#1d4ed8' : hasStock ? priceColor(t) : '#94a3b8',
        weight: locked ? 3.5 : 1.5,
        fillColor: hasStock ? priceColor(t) : '#94a3b8',
        fillOpacity: locked ? 0.55 : hasStock ? 0.35 : 0.12,
        dashArray: hasStock ? undefined : '5 6',
      }).addTo(map);
      const rentTxt = hasStock
        ? `${fmtMoney(rent, region.localCurrency)}/mo · ${req.bedrooms}-bed ${req.propertyType}`
        : `No typical ${req.bedrooms}-bed ${req.propertyType} stock`;
      poly.bindTooltip(
        `<strong>${zone.name}</strong><br/>${rentTxt}<br/><em>${zone.description}</em><br/>${locked ? 'Click to unlock' : 'Click to lock estimate to this zone'}`,
        { sticky: true }
      );
      poly.on('click', () => {
        cbRef.current.onLockZone(cbRef.current.lockedZoneId === zone.id ? null : zone.id);
      });
      layersRef.current.push(poly);
    });
  }, [region, req.propertyType, req.bedrooms, req.furnished, lockedZoneId]);

  return (
    <div className="map-wrap">
      <div ref={mapEl} className="map" />
      <div className="map-legend">
        <span className="legend-chip" style={{ background: priceColor(0) }} /> cheaper
        <span className="legend-bar" />
        <span className="legend-chip" style={{ background: priceColor(1) }} /> pricier
        <span className="legend-note">shading = rent for your current requirements · click a zone to lock</span>
      </div>
    </div>
  );
}
