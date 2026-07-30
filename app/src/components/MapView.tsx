import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { utmToLatLng } from '../lib/utmToLatLng';
import type { AssetListItem } from '../lib/useAssets';

const STATUS_COLOR: Record<string, string> = {
  not_started: '#3d4259',
  in_progress: '#00d4aa',
  completed: '#3b82f6',
  on_hold: '#ef4444',
};

const BASEMAPS: Record<string, { label: string; url: string; options: L.TileLayerOptions }> = {
  satellite: {
    label: 'Google Satellite',
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    options: { subdomains: '0123', maxZoom: 21, attribution: 'Google Satellite' },
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
}

export function MapView({ assets, coordinateSystem, selectedAssetId, onSelect, restrictedAssetIds }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const lineRef = useRef<L.Polyline | null>(null);
  const basemapLayerRef = useRef<L.TileLayer | null>(null);
  const hasFitBounds = useRef(false);
  const [basemap, setBasemap] = useState<keyof typeof BASEMAPS>('satellite');
  const [basemapMenuOpen, setBasemapMenuOpen] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true }).setView([0, 0], 2);
    basemapLayerRef.current = L.tileLayer(BASEMAPS.satellite.url, BASEMAPS.satellite.options).addTo(map);
    lineRef.current = L.polyline([], { color: '#fff', weight: 2, dashArray: '4 6', opacity: 0.8 }).addTo(map);
    mapRef.current = map;

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
    if (!map || !coordinateSystem) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    const points: [number, number][] = [];

    for (const asset of assets) {
      let lat = asset.lat;
      let lng = asset.lng;
      if ((lat == null || lng == null) && asset.x != null && asset.y != null) {
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
      markersRef.current[asset.id] = marker;
      points.push([lat, lng]);
    }

    lineRef.current?.setLatLngs(points);

    if (points.length > 0 && !hasFitBounds.current) {
      map.fitBounds(points, { padding: [40, 40] });
      hasFitBounds.current = true;
    }
  }, [assets, coordinateSystem, selectedAssetId, onSelect, restrictedAssetIds]);

  return (
    <>
      <div ref={containerRef} className="map-view" />
      <div className="basemap-control">
        {basemapMenuOpen && (
          <div className="basemap-menu">
            {Object.entries(BASEMAPS).map(([key, bm]) => (
              <button
                key={key}
                type="button"
                className={key === basemap ? 'active' : ''}
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
