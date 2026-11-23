// Excavation-pit geometry: a line-for-line port of app/src/lib/stubGeometry.ts (validated: 804/804 real
// tower leg-rows to 0.5 mm) so the AR pits are exactly the ones the app's map draws. Works in UTM (E, N).
const KNOWN_TYPES = ['B90C', 'BNS', 'B30', 'B60', 'B90', 'BLC', 'BLS'];
const STUB_TYPE_ALIASES = { B90C: 'B90' };   // B90C has no stub/foundation table of its own -> B90's
export const STUB_NAMES = { 1: 'Z41', 2: 'Z42', 3: 'Z43', 4: 'Z44' };
const LEG_OFFSET_SIGNS = { 1: [-1, 1], 2: [-1, -1], 3: [1, -1], 4: [1, 1] };

export function parseTowerType(assetType) {
  if (!assetType) return null;
  for (const type of KNOWN_TYPES) if (assetType.startsWith(type)) {
    const m = assetType.slice(type.length).match(/^([+-]\d+(?:\.\d+)?)/);
    return { type, bodyExtM: m ? Number(m[1]) : 0 };
  }
  return null;
}
const normalize = (v) => { const m = Math.hypot(v[0], v[1]); return [v[0] / m, v[1] / m]; };

// bisector (along the line) + its perpendicular at index i of an ordered [{x,y}] UTM list
export function computeBisector(i, coords) {
  const cur = coords[i], prev = coords[i - 1], next = coords[i + 1];
  let bis;
  if (!prev && !next) bis = [0, 1];
  else if (!prev) bis = normalize([next.x - cur.x, next.y - cur.y]);
  else if (!next) bis = normalize([cur.x - prev.x, cur.y - prev.y]);
  else { const v1 = normalize([cur.x - prev.x, cur.y - prev.y]), v2 = normalize([next.x - cur.x, next.y - cur.y]); bis = normalize([v1[0] + v2[0], v1[1] + v2[1]]); }
  return [bis, [bis[1], -bis[0]]];
}

export function computeLegExcavation(base, bodyExtM, legExtM, bWidthM, stub, legIndex, center, bis, perp) {
  const entry = stub.table.find((t) => t.bodyExtM === bodyExtM && t.legExtM === legExtM);
  if (!entry) return null;
  const dimMm = base === 'BLS' ? entry.bMm : entry.wMm;
  const { a, j, k } = stub.angleFactor, offsetMm = (a / j) * k;
  const z1Mm = offsetMm + dimMm / 2 + (bWidthM * 1000) / 2, hM = bWidthM / 2, legM = z1Mm / 1000 - hM;
  const [sB, sP] = LEG_OFFSET_SIGNS[legIndex];
  const lc = [center[0] + sB * legM * bis[0] + sP * legM * perp[0], center[1] + sB * legM * bis[1] + sP * legM * perp[1]];
  const corners = [[-1, 1], [-1, -1], [1, -1], [1, 1]].map(([cb, cp]) => [lc[0] + cb * hM * bis[0] + cp * hM * perp[0], lc[1] + cb * hM * bis[1] + cp * hM * perp[1]]);
  return { leg: legIndex, stub: STUB_NAMES[legIndex], bWidthM, legExtM, centerUtm: lc, cornersUtm: corners };
}

// foundation entry for this asset type + soil type (falls back to the first uploaded soil type, as the app does)
export function foundationFor(assetType, foundationTypes, soilType) {
  if (!assetType) return null;
  const alias = Object.keys(STUB_TYPE_ALIASES).find((a) => assetType.startsWith(a));
  const canon = alias ? STUB_TYPE_ALIASES[alias] : (foundationTypes.find((f) => assetType.startsWith(f.type)) || {}).type;
  if (!canon) return null;
  const opts = foundationTypes.filter((f) => f.type === canon);
  return opts.find((f) => soilType != null && f.soilTypeCode === soilType) || opts[0] || null;
}

// All 4 pits of tower i in an ordered asset list ({code, type, E, N, legExts:[4], soil}).
// Returns { legs:[LegResult|null x4], missing:[reason...], parsed, foundation } -- never throws.
export function towerExcavation(assets, i, stubSettings, foundationTypes) {
  const a = assets[i], out = { legs: [null, null, null, null], missing: [], parsed: null, foundation: null };
  const parsed = parseTowerType(a.type); out.parsed = parsed;
  if (!parsed) { out.missing.push(`direk tipi tanınamadı (${a.type || 'boş'})`); return out; }
  const lookup = STUB_TYPE_ALIASES[parsed.type] || parsed.type;
  const stub = stubSettings.find((s) => s.type === lookup);
  if (!stub) { out.missing.push(`stub ayarı tablosu yok (${lookup})`); return out; }
  const found = foundationFor(a.type, foundationTypes, a.soil); out.foundation = found;
  if (!found) { out.missing.push(`temel (kazı) ölçüsü yok (${lookup})`); return out; }
  if (a.legExts.some((e) => e == null)) { out.missing.push('bacak uzatma (LE) verisi eksik'); return out; }
  const coords = assets.map((x) => ({ x: x.E, y: x.N }));
  const [bis, perp] = computeBisector(i, coords);
  for (let leg = 1; leg <= 4; leg++) {
    out.legs[leg - 1] = computeLegExcavation(parsed.type, parsed.bodyExtM, a.legExts[leg - 1], found.bWidthM, stub, leg, [a.E, a.N], bis, perp);
    if (!out.legs[leg - 1]) out.missing.push(`${STUB_NAMES[leg]}: tabloda gövde ${parsed.bodyExtM} / LE ${a.legExts[leg - 1]} yok`);
  }
  out.bis = bis;
  return out;
}
