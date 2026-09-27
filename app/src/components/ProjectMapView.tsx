import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ProjectLocation } from '../lib/useProjectLocations';

export interface ProjectMapEntry {
  id: string;
  slug: string;
  name: string;
  location: ProjectLocation;
}

interface ProjectMapViewProps {
  basePath: '/admin' | '/field';
  entries: ProjectMapEntry[];
}

const pinHtml = (name: string) => `
  <div class="project-map-pin">
    <span class="project-map-pin-dot"></span>
    <span class="project-map-pin-label">${name.replace(/</g, '&lt;')}</span>
  </div>
`;

export default function ProjectMapView({ basePath, entries }: ProjectMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, minZoom: 2 }).setView([20, 20], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);

    entries.forEach((entry) => {
      const icon = L.divIcon({ className: '', html: pinHtml(entry.name), iconSize: undefined, iconAnchor: [8, 8] });
      const marker = L.marker([entry.location.lat, entry.location.lng], { icon }).addTo(layer);
      marker.on('click', () => navigate(`${basePath}/${entry.slug}`));
    });

    if (entries.length) {
      const bounds = L.latLngBounds(entries.map((e) => [e.location.lat, e.location.lng]));
      map.fitBounds(bounds.pad(0.3), { maxZoom: 9 });
    }

    return () => {
      layer.remove();
    };
  }, [entries, basePath, navigate]);

  return <div ref={containerRef} className="project-map-view" />;
}
