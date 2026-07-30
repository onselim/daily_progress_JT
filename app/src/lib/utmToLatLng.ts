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
