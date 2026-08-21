import { utmToLatLng } from './utmToLatLng';
import type { AssetListItem } from './useAssets';

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
// Small buffer around the project's own tower extent so infrastructure that crosses
// just outside the line's own footprint (a nearby substation, a line running parallel
// a field away) still gets picked up.
const BOUNDS_BUFFER_DEG = 0.02;

/** Bounding box of the project's towers (from lat/lng where set, else UTM x/y), with a
 * small buffer -- the area an Overpass query searches. Null if no assets have coordinates. */
export function computeProjectBounds(assets: AssetListItem[], coordinateSystem: string | null): Bounds | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

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
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  if (!Number.isFinite(minLat)) return null;
  return {
    south: minLat - BOUNDS_BUFFER_DEG,
    west: minLng - BOUNDS_BUFFER_DEG,
    north: maxLat + BOUNDS_BUFFER_DEG,
    east: maxLng + BOUNDS_BUFFER_DEG,
  };
}

async function runOverpassQuery(ql: string): Promise<OverpassElement[]> {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(ql)}`,
  });
  if (!res.ok) throw new Error(`Overpass API request failed (${res.status})`);
  const data = await res.json();
  return data.elements ?? [];
}

function isClosedRing(geometry: { lat: number; lon: number }[]): boolean {
  if (geometry.length < 4) return false;
  const first = geometry[0];
  const last = geometry[geometry.length - 1];
  return first.lat === last.lat && first.lon === last.lon;
}

function elementsToGeoJSON(
  elements: OverpassElement[],
  categoryFor: (tags: Record<string, string>) => string,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const el of elements) {
    if (!el.geometry || el.geometry.length < 2 || !el.tags) continue;
    const coords: [number, number][] = el.geometry.map((pt) => [pt.lon, pt.lat]);
    const geometry: GeoJSON.Geometry = isClosedRing(el.geometry)
      ? { type: 'Polygon', coordinates: [coords] }
      : { type: 'LineString', coordinates: coords };
    features.push({
      type: 'Feature',
      properties: { osm_id: el.id, category: categoryFor(el.tags), ...el.tags },
      geometry,
    });
  }
  return { type: 'FeatureCollection', features };
}

function bboxString(b: Bounds): string {
  return `${b.south},${b.west},${b.north},${b.east}`;
}

/** Existing overhead power lines and pipelines within the bounds, from OpenStreetMap
 * (same underlying data source openinframap.org itself uses, via the official,
 * documented Overpass API rather than embedding OpenInfraMap's own undocumented
 * vector-tile service). */
export async function fetchExistingPowerAndPipelines(bounds: Bounds): Promise<{
  powerLines: GeoJSON.FeatureCollection;
  pipelines: GeoJSON.FeatureCollection;
}> {
  const bbox = bboxString(bounds);
  const ql = `[out:json][timeout:60];(way["power"="line"](${bbox});way["power"="minor_line"](${bbox});way["man_made"="pipeline"](${bbox}););out geom;`;
  const elements = await runOverpassQuery(ql);
  const powerEls = elements.filter((e) => e.tags?.power === 'line' || e.tags?.power === 'minor_line');
  const pipelineEls = elements.filter((e) => e.tags?.man_made === 'pipeline');
  return {
    powerLines: elementsToGeoJSON(powerEls, () => 'power_line'),
    pipelines: elementsToGeoJSON(pipelineEls, () => 'pipeline'),
  };
}

/** Existing substations and power plants within the bounds. */
export async function fetchExistingSubstationsAndPlants(bounds: Bounds): Promise<GeoJSON.FeatureCollection> {
  const bbox = bboxString(bounds);
  const ql = `[out:json][timeout:60];(node["power"="substation"](${bbox});way["power"="substation"](${bbox});way["power"="plant"](${bbox});way["power"="cable"](${bbox}););out geom;`;
  const elements = await runOverpassQuery(ql);
  return elementsToGeoJSON(elements, (tags) => (tags.power === 'plant' ? 'power_plant' : tags.power === 'cable' ? 'power_line' : 'substation'));
}
