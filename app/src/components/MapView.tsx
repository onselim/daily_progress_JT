import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { utmToLatLng } from '../lib/utmToLatLng';
import type { AssetListItem } from '../lib/useAssets';

const STATUS_COLOR: Record<string, string> = {
  not_started: '#3d4259',
  in_progress: '#f59e0b',
  completed: '#00d4aa',
  on_hold: '#ef4444',
};

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
  const hasFitBounds = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true }).setView([0, 0], 2);
    L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      subdomains: '0123',
      maxZoom: 21,
      attribution: 'Google Satellite',
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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

      const color = restrictedAssetIds.has(asset.id)
        ? '#ef4444'
        : (STATUS_COLOR[asset.status] ?? STATUS_COLOR.not_started);
      const isSelected = asset.id === selectedAssetId;
      const size = isSelected ? 30 : 20;

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid ${
          isSelected ? '#2563eb' : '#fff'
        };box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:${
          size > 24 ? 10 : 8
        }px;font-family:ui-monospace,monospace;">${asset.asset_code}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);
      marker.on('click', () => onSelect(asset.id));
      markersRef.current[asset.id] = marker;
      points.push([lat, lng]);
    }

    if (points.length > 0 && !hasFitBounds.current) {
      map.fitBounds(points, { padding: [40, 40] });
      hasFitBounds.current = true;
    }
  }, [assets, coordinateSystem, selectedAssetId, onSelect, restrictedAssetIds]);

  return <div ref={containerRef} className="map-view" />;
}
