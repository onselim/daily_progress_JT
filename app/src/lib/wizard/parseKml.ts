import { strFromU8, unzipSync } from 'fflate';

export interface KmlAsset {
  code: string;
  lat: number;
  lng: number;
  elevation: number | null;
  assetType: string | null;
  station: string | null;
}

/**
 * PLS-CADD's Google Earth export puts a "sta=..." / "ht=... ele=..." description
 * under each structure Placemark, with the tower type code as its own first line
 * (e.g. "2tt+0"). Pull those out when present.
 */
function parsePlacemarkDescription(text: string | null): {
  assetType: string | null;
  station: string | null;
  elevation: number | null;
} {
  if (!text) return { assetType: null, station: null, elevation: null };
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const staLine = lines.find((l) => /^sta\s*=/i.test(l));
  const station = staLine ? staLine.replace(/^sta\s*=\s*/i, '') : null;

  const eleMatch = text.match(/ele\s*=\s*(-?[\d.]+)/i);
  const elevation = eleMatch ? Number(eleMatch[1]) : null;

  const typeLine = lines.find((l) => !/^(sta|ht|ele)\s*=/i.test(l));

  return {
    assetType: typeLine ?? null,
    station,
    elevation: Number.isFinite(elevation as number) ? elevation : null,
  };
}

/** Find a Folder whose own <name> (not a descendant's) mentions "structure location(s)". */
function findStructureLocationsFolder(doc: Document): Element | null {
  const folders = Array.from(doc.getElementsByTagName('Folder'));
  for (const folder of folders) {
    const nameEl = folder.getElementsByTagName('name')[0];
    if (nameEl?.parentElement === folder && /structure location/i.test(nameEl.textContent ?? '')) {
      return folder;
    }
  }
  return null;
}

export function parseKmlText(kmlText: string): KmlAsset[] {
  const doc = new DOMParser().parseFromString(kmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Could not parse KML file (invalid XML).');
  }

  // PLS-CADD exports keep real tower points in a "Structure locations" folder,
  // separate from route/alignment/offset-tour placemarks elsewhere in the file —
  // scope to that folder when present so those don't get imported as towers too.
  const scope = findStructureLocationsFolder(doc) ?? doc;
  const placemarks = Array.from(scope.getElementsByTagName('Placemark'));
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

    const descEl = pm.getElementsByTagName('description')[0];
    const { assetType, station, elevation } = parsePlacemarkDescription(descEl?.textContent ?? null);

    result.push({
      code: (nameEl?.textContent ?? '').trim() || `P${result.length + 1}`,
      lat,
      lng,
      elevation: elevation ?? (Number.isFinite(alt) ? alt : null),
      assetType,
      station,
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
