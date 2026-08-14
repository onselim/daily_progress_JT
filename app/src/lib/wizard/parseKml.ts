import { strFromU8, unzipSync } from 'fflate';

export interface KmlAsset {
  code: string;
  lat: number;
  lng: number;
  elevation: number | null;
}

export function parseKmlText(kmlText: string): KmlAsset[] {
  const doc = new DOMParser().parseFromString(kmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Could not parse KML file (invalid XML).');
  }

  const placemarks = Array.from(doc.getElementsByTagName('Placemark'));
  const result: KmlAsset[] = [];

  for (const pm of placemarks) {
    const nameEl = pm.getElementsByTagName('name')[0];
    const coordEl = pm.getElementsByTagName('coordinates')[0];
    if (!coordEl) continue;

    const raw = (coordEl.textContent ?? '').trim();
    // Point placemarks hold a single "lon,lat,alt" tuple; multiple
    // whitespace-separated tuples mean this is a LineString/Polygon path
    // (e.g. the line route itself), not an individual tower — skip those.
    if (/\s/.test(raw)) continue;

    const [lng, lat, alt] = raw.split(',').map((p) => Number(p.trim()));
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

    result.push({
      code: (nameEl?.textContent ?? '').trim() || `P${result.length + 1}`,
      lat,
      lng,
      elevation: Number.isFinite(alt) ? alt : null,
    });
  }

  return result;
}

export async function parseKmlOrKmzFile(file: File): Promise<KmlAsset[]> {
  const isKmz = file.name.toLowerCase().endsWith('.kmz');
  if (!isKmz) {
    return parseKmlText(await file.text());
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(buffer);
  const kmlEntryName = Object.keys(entries).find((n) => n.toLowerCase().endsWith('.kml'));
  if (!kmlEntryName) throw new Error('No .kml file found inside the .kmz archive.');

  return parseKmlText(strFromU8(entries[kmlEntryName]));
}
