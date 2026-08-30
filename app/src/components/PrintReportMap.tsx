import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { resolveLinePath } from '../lib/lineGeometry';
import type { AssetListItem } from '../lib/useAssets';

interface PrintReportMapProps {
  assets: AssetListItem[];
  coordinateSystem: string | null;
  highlightedAssetIds: Set<string>;
}

/** A small, dedicated Leaflet map for the PDF report's second page -- deliberately not
 * a reuse of the full interactive MapView, which carries basemap switching, heatmap and
 * photo-clustering controls that don't belong on a static print page. */
export function PrintReportMap({ assets, coordinateSystem, highlightedAssetIds }: PrintReportMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView([0, 0], 2);
    mapRef.current = map;
    L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      subdomains: '0123',
      maxZoom: 21,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (layerGroupRef.current) {
      layerGroupRef.current.remove();
      layerGroupRef.current = null;
    }

    const path = resolveLinePath(assets, coordinateSystem);
    if (path.length === 0) return;

    const group = L.layerGroup();
    const points: [number, number][] = path.map((p) => [p.lat, p.lng]);
    L.polyline(points, { color: '#f59e0b', weight: 2, opacity: 0.7 }).addTo(group);

    for (const p of path) {
      if (highlightedAssetIds.has(p.id)) {
        L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:22px;height:22px;border-radius:50%;background:#dc2626;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;font-family:ui-monospace,monospace;">${p.asset_code}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        }).addTo(group);
      } else {
        L.circleMarker([p.lat, p.lng], {
          radius: 2.5,
          color: '#1f2937',
          weight: 1,
          fillColor: '#9ca3af',
          fillOpacity: 0.9,
        }).addTo(group);
      }
    }

    group.addTo(map);
    layerGroupRef.current = group;

    map.fitBounds(points, { padding: [20, 20] });
    setTimeout(() => map.invalidateSize(), 50);
  }, [assets, coordinateSystem, highlightedAssetIds]);

  return <div ref={containerRef} className="pd-report-map" />;
}
