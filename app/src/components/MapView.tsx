import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { utmToLatLng } from '../lib/utmToLatLng';
import { resolveLinePath, bearingDeg } from '../lib/lineGeometry';
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

/** Where offset lines on the inside of a bend converge (cross each other in the raw
 * per-span rendering) and lines on the outside of a bend diverge (leave a gap), the
 * intersection of the two infinite lines is a single miter point that simultaneously
 * trims the inside and fillets/joins the outside — a standard stroke miter-join. */
function lineIntersect(
  p1: [number, number],
  d1: [number, number],
  p2: [number, number],
  d2: [number, number],
): [number, number] | null {
  const det = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(det) < 1e-12) return null;
  const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / det;
  return [p1[0] + t * d1[0], p1[1] + t * d1[1]];
}

interface SpanChannel {
  sign: number;
  baseDeg: number;
  color: string;
  weight: number;
  statusKey: string;
  enabled: boolean;
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

const HEAT_GRADIENT_STOPS: [number, [number, number, number]][] = [
  [0, [37, 99, 235]], // #2563eb
  [0.35, [0, 212, 170]], // #00d4aa
  [0.6, [245, 158, 11]], // #f59e0b
  [0.8, [239, 68, 68]], // #ef4444
  [1, [127, 29, 29]], // #7f1d1d
];

/** Maps a normalized 0..1 intensity to a color along the same blue -> amber -> dark-red
 * scale used elsewhere in the app, for the heat-map "cloud" circles' fill. */
function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < HEAT_GRADIENT_STOPS.length - 1; i++) {
    const [t0, c0] = HEAT_GRADIENT_STOPS[i];
    const [t1, c1] = HEAT_GRADIENT_STOPS[i + 1];
    if (clamped >= t0 && clamped <= t1) {
      const f = t1 === t0 ? 0 : (clamped - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return `rgb(${HEAT_GRADIENT_STOPS[HEAT_GRADIENT_STOPS.length - 1][1].join(', ')})`;
}

/** Existing-infrastructure overlays (OpenStreetMap power lines / pipelines uploaded as
 * GeoJSON to the Layers panel) get a dashed line distinct from the project's own solid
 * conductor spans, colored by category so power and pipeline read apart at a glance. */
function geoLayerStyle(category?: string): L.PathOptions {
  if (category === 'pipeline') {
    return { color: '#a16207', weight: 3, dashArray: '2 6', opacity: 0.85 };
  }
  if (category === 'substation') {
    return { color: '#ef4444', weight: 2, fillColor: '#ef4444', fillOpacity: 0.25, opacity: 0.9 };
  }
  if (category === 'power_plant') {
    return { color: '#a855f7', weight: 2, fillColor: '#a855f7', fillOpacity: 0.25, opacity: 0.9 };
  }
  if (category === 'railway') {
    return { color: '#1f2937', weight: 3, dashArray: '1 6', opacity: 0.9 };
  }
  if (category === 'excavation_pit') {
    // These are drawn at true physical scale (a few metres per side), so they're only
    // meaningfully visible once zoomed into a specific tower -- a solid, saturated fill
    // reads clearly at that scale instead of getting lost against satellite imagery.
    return { color: '#dc2626', weight: 1.5, fillColor: '#dc2626', fillOpacity: 0.45, opacity: 0.95 };
  }
  return { color: '#f59e0b', weight: 3, dashArray: '6 4', opacity: 0.85 };
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
  heatmapEnabled?: boolean;
  heatPoints?: [number, number, number][];
  heatCentroid?: [number, number] | null;
  geoLayers?: { id: string; name: string; url: string }[];
  onLayerError?: (layerId: string, message: string) => void;
}

export function MapView({
  assets,
  coordinateSystem,
  selectedAssetId,
  onSelect,
  restrictedAssetIds,
  percentByAssetAndKey,
  groundWireConfig,
  heatmapEnabled = false,
  heatPoints = [],
  heatCentroid = null,
  geoLayers = [],
  onLayerError,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const spansGroupRef = useRef<L.LayerGroup | null>(null);
  const crossGroupRef = useRef<L.LayerGroup | null>(null);
  const deflectionGroupRef = useRef<L.LayerGroup | null>(null);
  const basemapLayerRef = useRef<L.TileLayer | null>(null);
  const heatLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const heatCentroidMarkerRef = useRef<L.Marker | null>(null);
  const geoLayersRef = useRef<Record<string, L.GeoJSON>>({});
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

    if (heatLayerGroupRef.current) {
      map.removeLayer(heatLayerGroupRef.current);
      heatLayerGroupRef.current = null;
    }

    if (heatmapEnabled && heatPoints.length > 0) {
      // A diffuse leaflet.heat-style blur reads as washed out for a handful of sparse
      // towers -- solid, black-outlined "cloud" circles per tower (color + size both
      // driven by intensity) read far more clearly, and overlapping circles still blend
      // into a cluster the way a real heat map would.
      const weights = heatPoints.map((p) => p[2]);
      const minW = Math.min(...weights);
      const maxW = Math.max(...weights);
      const span = maxW - minW;

      const group = L.layerGroup();
      for (const [lat, lng, weight] of heatPoints) {
        const t = span > 0 ? (weight - minW) / span : 0.6;
        const radiusM = 110 + t * 260;
        L.circle([lat, lng], {
          radius: radiusM,
          color: '#000000',
          weight: 2,
          opacity: 0.8,
          fillColor: heatColor(t),
          fillOpacity: 0.55,
        }).addTo(group);
      }
      group.addTo(map);
      heatLayerGroupRef.current = group;
    }
  }, [heatmapEnabled, heatPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatCentroidMarkerRef.current) {
      map.removeLayer(heatCentroidMarkerRef.current);
      heatCentroidMarkerRef.current = null;
    }

    if (heatmapEnabled && heatCentroid) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:26px;height:26px;position:relative;pointer-events:none;">
          <svg width="26" height="26" viewBox="0 0 26 26" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.7));">
            <circle cx="13" cy="13" r="10" fill="rgba(251,191,36,0.25)" stroke="#fbbf24" stroke-width="2"/>
            <line x1="13" y1="2" x2="13" y2="7" stroke="#fbbf24" stroke-width="2"/>
            <line x1="13" y1="19" x2="13" y2="24" stroke="#fbbf24" stroke-width="2"/>
            <line x1="2" y1="13" x2="7" y2="13" stroke="#fbbf24" stroke-width="2"/>
            <line x1="19" y1="13" x2="24" y2="13" stroke="#fbbf24" stroke-width="2"/>
            <circle cx="13" cy="13" r="2.5" fill="#fbbf24"/>
          </svg>
        </div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      heatCentroidMarkerRef.current = L.marker(heatCentroid, { icon, interactive: false, zIndexOffset: 1000 }).addTo(
        map,
      );
    }
  }, [heatmapEnabled, heatCentroid]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    const activeIds = new Set(geoLayers.map((l) => l.id));
    for (const [id, layer] of Object.entries(geoLayersRef.current)) {
      if (!activeIds.has(id)) {
        map.removeLayer(layer);
        delete geoLayersRef.current[id];
      }
    }

    for (const geoLayer of geoLayers) {
      if (geoLayersRef.current[geoLayer.id]) continue;
      fetch(geoLayer.url)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled || geoLayersRef.current[geoLayer.id]) return;
          const validTypes = ['FeatureCollection', 'Feature', 'GeometryCollection'];
          if (!validTypes.includes(data?.type)) {
            onLayerError?.(geoLayer.id, `Not a GeoJSON file (found "${data?.type ?? typeof data}" instead)`);
            return;
          }
          const layer = L.geoJSON(data, {
            style: (feature) => geoLayerStyle(feature?.properties?.category),
            onEachFeature: (feature, featureLayer) => {
              const p = feature.properties ?? {};
              if (p.category === 'excavation_pit') {
                const bWidth = p.b_width_m ?? p.excavation_side_m;
                const header = [p.tower, p.tower_type, p.stub ? `Leg ${p.leg} (${p.stub})` : null, bWidth ? `B (pad width): ${bWidth} m` : null]
                  .filter(Boolean)
                  .join(' — ');
                const cornerLines = Array.isArray(p.corners)
                  ? p.corners.map((c: [number, number], i: number) => `C${i + 1}: ${c[0]}, ${c[1]}`).join('<br/>')
                  : '';
                featureLayer.bindTooltip(`${header}${cornerLines ? `<br/>${cornerLines}` : ''}`, { sticky: true });
                return;
              }
              const bits = [p.name, p.voltage ? `${Number(p.voltage) / 1000} kV` : null, p.man_made ?? p.power];
              featureLayer.bindTooltip(bits.filter(Boolean).join(' — ') || geoLayer.name, { sticky: true });
            },
          });
          layer.addTo(map);
          geoLayersRef.current[geoLayer.id] = layer;
        })
        .catch((err) => {
          onLayerError?.(geoLayer.id, err instanceof Error ? err.message : 'Failed to load layer');
        });
    }

    return () => {
      cancelled = true;
    };
  }, [geoLayers, onLayerError]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

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
    }

    // Ordered by station (chainage), not by asset_code — code sort order isn't guaranteed
    // to follow the physical route, station is.
    const points = resolveLinePath(assets, coordinateSystem);

    const spansGroup = spansGroupRef.current;
    const crossGroup = crossGroupRef.current;
    const deflectionGroup = deflectionGroupRef.current;
    spansGroup?.clearLayers();
    crossGroup?.clearLayers();
    deflectionGroup?.clearLayers();

    const pctFor = (assetId: string, key: string) => percentByAssetAndKey[assetId]?.[key] ?? 0;

    const channels: SpanChannel[] = [
      { sign: 1, baseDeg: 0.00009, color: SPAN_COLOR.conductor, weight: 3, statusKey: STRINGING_KEYS.conductor, enabled: true },
      { sign: -1, baseDeg: 0.00009, color: SPAN_COLOR.conductor, weight: 3, statusKey: STRINGING_KEYS.conductor, enabled: true },
      {
        sign: 1,
        baseDeg: 0.000045,
        color: SPAN_COLOR.earthwire,
        weight: 2.5,
        statusKey: STRINGING_KEYS.earthwire,
        enabled: groundWireConfig.earthwire > 0,
      },
      {
        sign: groundWireConfig.earthwire > 0 ? -1 : 0,
        baseDeg: 0.000045,
        color: SPAN_COLOR.opgw,
        weight: 2.5,
        statusKey: STRINGING_KEYS.opgw,
        enabled: groundWireConfig.opgw > 0,
      },
    ];

    const spanGeos: ({ geo: SpanGeometry; cosLat: number } | null)[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const geo = spanGeometry(a.lat, a.lng, b.lat, b.lng);
      const cosLat = Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
      spanGeos.push(geo ? { geo, cosLat } : null);
    }

    const channelOffset = (ch: SpanChannel, sg: { geo: SpanGeometry; cosLat: number }): [number, number] => [
      (ch.sign * ch.baseDeg) / sg.cosLat,
      ch.sign * ch.baseDeg,
    ];

    // Junctions at each interior tower, per channel: the point where the incoming and
    // outgoing span's offset line for that channel should meet. Trims the inside of a
    // bend (where offset lines would otherwise cross) and fillets the outside (where
    // they would otherwise leave a gap). Null = fall back to each span's own raw offset
    // endpoint (nearly-straight spans, or a miter so extreme it'd spike).
    const MITER_LIMIT_FACTOR = 8;
    const junctions: ([number, number] | null)[][] = points.map(() => channels.map(() => null));
    for (let j = 1; j < points.length - 1; j++) {
      const sgIn = spanGeos[j - 1];
      const sgOut = spanGeos[j];
      if (!sgIn || !sgOut) continue;
      const cur = points[j];
      const prev = points[j - 1];
      const next = points[j + 1];
      const dir1: [number, number] = [cur.lng - prev.lng, cur.lat - prev.lat];
      const dir2: [number, number] = [next.lng - cur.lng, next.lat - cur.lat];

      channels.forEach((ch, chIdx) => {
        if (!ch.enabled) return;
        const [snIn, sl] = channelOffset(ch, sgIn);
        const [snOut] = channelOffset(ch, sgOut);
        const endIn = offsetLatLng(cur.lat, cur.lng, sgIn.geo, snIn, sl);
        const startOut = offsetLatLng(cur.lat, cur.lng, sgOut.geo, snOut, sl);
        const p1: [number, number] = [endIn[1], endIn[0]];
        const p2: [number, number] = [startOut[1], startOut[0]];
        const hit = lineIntersect(p1, dir1, p2, dir2);
        if (!hit) return;
        const dist = Math.hypot(hit[0] - cur.lng, hit[1] - cur.lat);
        if (dist > ch.baseDeg * MITER_LIMIT_FACTOR) return;
        junctions[j][chIdx] = [hit[1], hit[0]];
      });
    }

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const sg = spanGeos[i];
      if (!sg || !spansGroup) continue;

      const cdDone = pctFor(a.id, STRINGING_KEYS.conductor) >= 100 && pctFor(b.id, STRINGING_KEYS.conductor) >= 100;
      const ewDone = pctFor(a.id, STRINGING_KEYS.earthwire) >= 100 && pctFor(b.id, STRINGING_KEYS.earthwire) >= 100;
      const opDone = pctFor(a.id, STRINGING_KEYS.opgw) >= 100 && pctFor(b.id, STRINGING_KEYS.opgw) >= 100;
      const doneByStatusKey: Record<string, boolean> = {
        [STRINGING_KEYS.conductor]: cdDone,
        [STRINGING_KEYS.earthwire]: ewDone,
        [STRINGING_KEYS.opgw]: opDone,
      };

      channels.forEach((ch, chIdx) => {
        if (!ch.enabled) return;
        const [sn, sl] = channelOffset(ch, sg);
        const start = junctions[i][chIdx] ?? offsetLatLng(a.lat, a.lng, sg.geo, sn, sl);
        const end = junctions[i + 1][chIdx] ?? offsetLatLng(b.lat, b.lng, sg.geo, sn, sl);
        L.polyline([start, end], { color: ch.color, weight: ch.weight, opacity: doneByStatusKey[ch.statusKey] ? 1 : 0.45 }).addTo(
          spansGroup,
        );
      });
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
