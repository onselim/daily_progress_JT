import proj4 from 'proj4';

const registered = new Set<string>();

function ensureUtmDef(epsgCode: string) {
  if (registered.has(epsgCode)) return;

  const match = epsgCode.match(/^EPSG:(\d{4,5})$/i);
  if (!match) throw new Error(`Unsupported coordinate system: ${epsgCode}`);

  const code = Number(match[1]);
  let zone: number;
  let south = false;

  if (code >= 32601 && code <= 32660) {
    zone = code - 32600;
  } else if (code >= 32701 && code <= 32760) {
    zone = code - 32700;
    south = true;
  } else {
    throw new Error(`Only WGS84 UTM EPSG codes (326xx/327xx) are supported, got ${epsgCode}`);
  }

  proj4.defs(epsgCode, `+proj=utm +zone=${zone}${south ? ' +south' : ''} +datum=WGS84 +units=m +no_defs`);
  registered.add(epsgCode);
}

/** Converts UTM (x, y) to [lat, lng] using the project's WGS84 UTM EPSG code, e.g. "EPSG:32638". */
export function utmToLatLng(x: number, y: number, epsgCode: string): [number, number] {
  ensureUtmDef(epsgCode);
  const [lng, lat] = proj4(epsgCode, 'WGS84', [x, y]);
  return [lat, lng];
}

/** Converts a UTM zone like "38N" / "38 S" / "38" (defaults to north) into a WGS84 UTM EPSG code. */
export function utmZoneToEpsg(zoneInput: string): string {
  const match = zoneInput.trim().match(/^(\d{1,2})\s*([NnSs]?)$/);
  if (!match) throw new Error(`Could not parse UTM zone "${zoneInput}" (expected e.g. "38N")`);

  const zone = Number(match[1]);
  if (zone < 1 || zone > 60) throw new Error(`UTM zone must be between 1 and 60, got ${zone}`);

  const south = match[2].toLowerCase() === 's';
  return `EPSG:${south ? 32700 + zone : 32600 + zone}`;
}
