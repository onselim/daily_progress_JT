import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { utmToLatLng } from '../lib/utmToLatLng';
import type { AssetListItem } from '../lib/useAssets';
import type { GroundWireConfig } from '../lib/useGroundWireConfig';

const STATUS_COLOR: Record<string, string> = {
  not_started: '#3d4259',
  in_progress: '#00d4aa',
  completed: '#3b82f6',
  on_hold: '#ef4444',
};

// Stringing work-item keys from the default Construction template — used to color/dim
// the conductor/OPGW/EW span lines by whether that phase has actually been strung.
const STRINGING_KEYS = { conductor: 'st_cd', opgw: 'st_op', earthwire: 'st_ew' };
const SPAN_COLOR = { conductor: '#ef4444', earthwire: '#3b82f6', opgw: '#f59e0b' };

interface SpanGeometry {
  nx: number;
  ny: number;
}

/** Perpendicular unit vector to the direction from `a` to `b`, in a small-scale
 * equirectangular approximation (fine at the tower-to-tower distances involved here). */
function spanGeometry(aLat: number, aLng: number, bLat: number, bLng: number): SpanGeometry | null {
  const cosLat = Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const dLon = (bLng - aLng) * cosLat;
  const dLat = bLat - aLat;
  const len = Math.sqrt(dLon * dLon + dLat * dLat);
  if (len < 0.000001) return null;
  return { nx: -dLat / len, ny: dLon / len };
}

/** Offsets a lat/lng point sideways by `sn` (longitude-direction, already /cosLat-corrected)
 * and `sl` (latitude-direction) along the given perpendicular unit vector. */
function offsetLatLng(lat: number, lng: number, geo: SpanGeometry, sn: number, sl: number): [number, number] {
  return [lat + geo.ny * sl, lng + geo.nx * sn];
}

function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const cosLat = Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const dLon = (bLng - aLng) * cosLat;
  const dLat = bLat - aLat;
  return (Math.atan2(dLon, dLat) * 180) / Math.PI;
}

const BASEMAPS: Record<string, { label: string; url: string; options: L.TileLayerOptions }> = {
  satellite: {
    label: 'Google Satellite',
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    options: { subdomains: '0123', maxZoom: 21, attribution: 'Google Satellite' },
  },
  hybrid: {
    label: 'Google Hybrid',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    options: { subdomains: '0123', maxZoom: 21, attribution: 'Google Hybrid' },
  },
  osm: {
    label: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 19, attribution: 'OpenStreetMap' },
  },
  topo: {
    label: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 17, attribution: 'OpenTopoMap' },
  },
  esri: {
    label: 'ESRI ArcGIS',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: 19, attribution: 'ESRI ArcGIS' },
  },
};

function restrictedIconHtml(size: number, code: string): string {
  return `<div style="width:${size}px;height:${size}px;">
    <svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#7f1d1d" stroke="#ef4444" stroke-width="2"/>
      <line x1="6" y1="6" x2="26" y2="26" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
      <line x1="26" y1="6" x2="6" y2="26" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
      <text x="16" y="30" text-anchor="middle" font-size="7" fill="#fca5a5" font-family="monospace">${code}</text>
    </svg>
  </div>`;
}

function activeIconHtml(size: number, color: string, code: string): string {
  return `<div style="position:relative;width:${size}px;height:${size}px;">
    <svg style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);overflow:visible;pointer-events:none;" width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="none" stroke="${color}" stroke-width="2">
        <animate attributeName="r" from="${size / 2}" to="${size}" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.8" to="0" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="none" stroke="${color}" stroke-width="1.5">
        <animate attributeName="r" from="${size / 2}" to="${size * 1.4}" dur="1.5s" begin="0.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" begin="0.4s" repeatCount="indefinite"/>
      </circle>
    </svg>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${size}px;height:${size}px;background:${color};border:2px solid rgba(255,255,255,0.9);border-radius:50%;color:#fff;font-size:${
      size > 26 ? 10 : 8
    }px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px ${color},0 2px 8px rgba(0,0,0,.5);font-family:ui-monospace,monospace;">${code}</div>
  </div>`;
}

function plainIconHtml(size: number, color: string, code: string, selected: boolean): string {
  return `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid ${
    selected ? '#2563eb' : 'rgba(255,255,255,.85)'
  };border-radius:50%;color:#fff;font-size:${
    size > 26 ? 10 : 8
  }px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px ${color},0 2px 6px rgba(0,0,0,.5);font-family:ui-monospace,monospace;">${code}</div>`;
}

interface MapViewProps {
  assets: AssetListItem[];
  coordinateSystem: string | null;
  selectedAssetId: string;
  onSelect: (assetId: string) => void;
  restrictedAssetIds: Set<string>;
  percentByAssetAndKey: Record<string, Record<string, number>>;
  groundWireConfig: GroundWireConfig;
}

export function MapView({
  assets,
  coordinateSystem,
  selectedAssetId,
  onSelect,
  restrictedAssetIds,
  percentByAssetAndKey,
  groundWireConfig,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const spansGroupRef = useRef<L.LayerGroup | null>(null);
  const crossGroupRef = useRef<L.LayerGroup | null>(null);
  const deflectionGroupRef = useRef<L.LayerGroup | null>(null);
  const basemapLayerRef = useRef<L.TileLayer | null>(null);
  const hasFitBounds = useRef(false);
  const [basemap, setBasemap] = useState<keyof typeof BASEMAPS>('satellite');
  const [basemapMenuOpen, setBasemapMenuOpen] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true }).setView([0, 0], 2);
    basemapLayerRef.current = L.tileLayer(BASEMAPS.satellite.url, BASEMAPS.satellite.options).addTo(map);
    spansGroupRef.current = L.layerGroup().addTo(map);
    crossGroupRef.current = L.layerGroup().addTo(map);
    deflectionGroupRef.current = L.layerGroup();
    mapRef.current = map;

    map.on('zoomend', () => {
      const dg = deflectionGroupRef.current;
      if (!dg) return;
      if (map.getZoom() >= 18) {
        if (!map.hasLayer(dg)) dg.addTo(map);
      } else if (map.hasLayer(dg)) {
        map.removeLayer(dg);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (basemapLayerRef.current) map.removeLayer(basemapLayerRef.current);
    const bm = BASEMAPS[basemap];
    basemapLayerRef.current = L.tileLayer(bm.url, bm.options).addTo(map);
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    const points: { id: string; lat: number; lng: number }[] = [];

    for (const asset of assets) {
      let lat = asset.lat;
      let lng = asset.lng;
      if ((lat == null || lng == null) && asset.x != null && asset.y != null && coordinateSystem) {
        try {
          [lat, lng] = utmToLatLng(asset.x, asset.y, coordinateSystem);
        } catch {
          continue;
        }
      }
      if (lat == null || lng == null) continue;

      const restricted = restrictedAssetIds.has(asset.id);
      const isSelected = asset.id === selectedAssetId;
      const isActive = asset.status === 'in_progress';
      const color = STATUS_COLOR[asset.status] ?? STATUS_COLOR.not_started;
      const baseSize = isSelected ? 30 : restricted ? 26 : isActive ? 26 : 20;

      let html: string;
      let iconSize = baseSize;
      if (restricted) {
        html = restrictedIconHtml(baseSize, asset.asset_code);
      } else if (isActive) {
        iconSize = baseSize * 2;
        html = activeIconHtml(baseSize, color, asset.asset_code);
      } else {
        html = plainIconHtml(baseSize, color, asset.asset_code, isSelected);
      }

      const icon = L.divIcon({
        className: '',
        html,
        iconSize: [iconSize, iconSize],
        iconAnchor: [iconSize / 2, iconSize / 2],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);
      marker.on('click', () => onSelect(asset.id));
      marker.on('contextmenu', (e) => {
        L.DomEvent.preventDefault(e.originalEvent);
        onSelect(asset.id);
        map.flyTo([lat as number, lng as number], Math.max(map.getZoom(), 17));
      });
      markersRef.current[asset.id] = marker;
      points.push({ id: asset.id, lat, lng });
    }

    const spansGroup = spansGroupRef.current;
    const crossGroup = crossGroupRef.current;
    const deflectionGroup = deflectionGroupRef.current;
    spansGroup?.clearLayers();
    crossGroup?.clearLayers();
    deflectionGroup?.clearLayers();

    const pctFor = (assetId: string, key: string) => percentByAssetAndKey[assetId]?.[key] ?? 0;

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const geo = spanGeometry(a.lat, a.lng, b.lat, b.lng);
      if (!geo || !spansGroup) continue;

      const cosLat = Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
      const o10l = 0.00009;
      const o10n = 0.00009 / cosLat;
      const o5l = 0.000045;
      const o5n = 0.000045 / cosLat;

      const cdDone = pctFor(a.id, STRINGING_KEYS.conductor) >= 100 && pctFor(b.id, STRINGING_KEYS.conductor) >= 100;
      const ewDone = pctFor(a.id, STRINGING_KEYS.earthwire) >= 100 && pctFor(b.id, STRINGING_KEYS.earthwire) >= 100;
      const opDone = pctFor(a.id, STRINGING_KEYS.opgw) >= 100 && pctFor(b.id, STRINGING_KEYS.opgw) >= 100;

      const drawSpanLine = (sn: number, sl: number, color: string, weight: number, done: boolean) => {
        L.polyline(
          [offsetLatLng(a.lat, a.lng, geo, sn, sl), offsetLatLng(b.lat, b.lng, geo, sn, sl)],
          { color, weight, opacity: done ? 1 : 0.45 },
        ).addTo(spansGroup);
      };

      drawSpanLine(o10n, o10l, SPAN_COLOR.conductor, 3, cdDone);
      drawSpanLine(-o10n, -o10l, SPAN_COLOR.conductor, 3, cdDone);
      if (groundWireConfig.earthwire > 0) drawSpanLine(o5n, o5l, SPAN_COLOR.earthwire, 2.5, ewDone);
      if (groundWireConfig.opgw > 0) {
        const opSn = groundWireConfig.earthwire > 0 ? -o5n : 0;
        const opSl = groundWireConfig.earthwire > 0 ? -o5l : 0;
        drawSpanLine(opSn, opSl, SPAN_COLOR.opgw, 2.5, opDone);
      }
    }

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      const next = points[i + 1];
      const geoIn = spanGeometry(prev.lat, prev.lng, cur.lat, cur.lng);
      const geoOut = spanGeometry(cur.lat, cur.lng, next.lat, next.lng);
      if (!geoIn || !geoOut) continue;

      let nx = geoIn.nx + geoOut.nx;
      let ny = geoIn.ny + geoOut.ny;
      const len = Math.sqrt(nx * nx + ny * ny);
      if (len < 0.000001) {
        nx = geoIn.nx;
        ny = geoIn.ny;
      } else {
        nx /= len;
        ny /= len;
      }
      const bisector: SpanGeometry = { nx, ny };
      const cosLat = Math.cos(cur.lat * (Math.PI / 180));
      const offDeg = 0.000108;

      if (crossGroup) {
        L.polyline(
          [
            offsetLatLng(cur.lat, cur.lng, bisector, -offDeg / cosLat, -offDeg),
            offsetLatLng(cur.lat, cur.lng, bisector, offDeg / cosLat, offDeg),
          ],
          { color: '#ffffff', weight: 2.5, opacity: 0.9 },
        ).addTo(crossGroup);
      }

      const bearingIn = bearingDeg(prev.lat, prev.lng, cur.lat, cur.lng);
      const bearingOut = bearingDeg(cur.lat, cur.lng, next.lat, next.lng);
      let deflection = Math.abs(bearingOut - bearingIn);
      if (deflection > 180) deflection = 360 - deflection;

      if (deflection > 0.5 && deflectionGroup) {
        L.marker([cur.lat, cur.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:rgba(15,17,23,0.88);border:1px solid rgba(251,191,36,0.5);color:#fbbf24;font-family:monospace;font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;white-space:nowrap;pointer-events:none">${deflection.toFixed(1)}°</div>`,
            iconSize: [44, 18],
            iconAnchor: [-6, 24],
          }),
          interactive: false,
        }).addTo(deflectionGroup);
      }
    }

    if (points.length > 0 && !hasFitBounds.current) {
      map.fitBounds(
        points.map((p) => [p.lat, p.lng]),
        { padding: [40, 40] },
      );
      hasFitBounds.current = true;
    }
  }, [assets, coordinateSystem, selectedAssetId, onSelect, restrictedAssetIds, percentByAssetAndKey, groundWireConfig]);

  function zoomToSelected() {
    const map = mapRef.current;
    const marker = markersRef.current[selectedAssetId];
    if (!map || !marker) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 17));
  }

  return (
    <>
      <div ref={containerRef} className="map-view" />
      {selectedAssetId && markersRef.current[selectedAssetId] && (
        <button type="button" className="zoom-to-location-btn" onClick={zoomToSelected}>
          🎯 Zoom to location
        </button>
      )}
      <div className="basemap-control">
        {basemapMenuOpen && (
          <div className="basemap-menu">
            {Object.entries(BASEMAPS).map(([key, bm]) => (
              <button
                key={key}
                type="button"
                className={`basemap-menu-btn${key === basemap ? ' active' : ''}`}
                onClick={() => {
                  setBasemap(key as keyof typeof BASEMAPS);
                  setBasemapMenuOpen(false);
                }}
              >
                {bm.label}
              </button>
            ))}
          </div>
        )}
        <button type="button" className="basemap-btn" onClick={() => setBasemapMenuOpen((v) => !v)}>
          🗺 Base Map ▾
        </button>
      </div>
    </>
  );
}
