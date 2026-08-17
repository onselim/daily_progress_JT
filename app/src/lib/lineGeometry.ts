import { utmToLatLng } from './utmToLatLng';
import type { AssetListItem } from './useAssets';

export interface LinePathPoint {
  id: string;
  asset_code: string;
  lat: number;
  lng: number;
  x: number | null;
  y: number | null;
  z: number | null;
  station: number | null;
}

/** Pulls the leading numeric value out of a station/chainage string like "Sta.2955m" or "2+955". */
export function parseStationValue(s: string | null): number | null {
  if (!s) return null;
  const match = s.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const cosLat = Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const dLon = (bLng - aLng) * cosLat;
  const dLat = bLat - aLat;
  return (Math.atan2(dLon, dLat) * 180) / Math.PI;
}

/** Straight-line distance in projected (UTM) meters — more precise than the geodesic
 * approximation when both points have real x/y, since it's exactly what the structure
 * list's own coordinates were surveyed in. Falls back to haversine on lat/lng for points
 * that only have KML-derived coordinates (no x/y). */
export function pathDistanceMeters(a: LinePathPoint, b: LinePathPoint): number {
  if (a.x != null && a.y != null && b.x != null && b.y != null) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
  return haversineMeters(a.lat, a.lng, b.lat, b.lng);
}

/**
 * Resolves each asset to a lat/lng, then reconstructs the physical tower-to-tower order
 * by nearest-neighbor chaining on real coordinates. Neither asset_code nor the station/
 * chainage text field can be trusted to reflect true adjacency — asset_code is whatever
 * numbering the structure list happened to use, and station text can have gaps/resets
 * from real-world data-entry issues — but towers are always much closer to their true
 * line-neighbors than to any other tower, so walking to the nearest unvisited point each
 * step reliably reconstructs the route from coordinates alone. The line always starts at
 * "G1" (the entry gantry) when one exists, so cumulative length reads the way the client
 * expects it; otherwise it starts from whichever point sits farthest from the centroid.
 */
export function resolveLinePath(assets: AssetListItem[], coordinateSystem: string | null): LinePathPoint[] {
  const resolved: LinePathPoint[] = [];
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
    resolved.push({
      id: asset.id,
      asset_code: asset.asset_code,
      lat,
      lng,
      x: asset.x,
      y: asset.y,
      z: asset.z,
      station: parseStationValue(asset.station),
    });
  }

  if (resolved.length <= 2) return resolved;

  const g1Idx = resolved.findIndex((p) => p.asset_code.trim().toLowerCase() === 'g1');
  let startIdx = g1Idx;

  if (startIdx === -1) {
    let cLat = 0;
    let cLng = 0;
    for (const p of resolved) {
      cLat += p.lat;
      cLng += p.lng;
    }
    cLat /= resolved.length;
    cLng /= resolved.length;

    startIdx = 0;
    let startDist = -1;
    for (let i = 0; i < resolved.length; i++) {
      const d = haversineMeters(cLat, cLng, resolved[i].lat, resolved[i].lng);
      if (d > startDist) {
        startDist = d;
        startIdx = i;
      }
    }
  }

  const visited = new Array(resolved.length).fill(false);
  const path: LinePathPoint[] = [];
  let currentIdx = startIdx;
  visited[currentIdx] = true;
  path.push(resolved[currentIdx]);

  for (let step = 1; step < resolved.length; step++) {
    const cur = resolved[currentIdx];
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < resolved.length; i++) {
      if (visited[i]) continue;
      const d = pathDistanceMeters(cur, resolved[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    visited[bestIdx] = true;
    path.push(resolved[bestIdx]);
    currentIdx = bestIdx;
  }

  return path;
}
