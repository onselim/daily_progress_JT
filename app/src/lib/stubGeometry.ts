import { utmToLatLng } from './utmToLatLng';
import { parseTowerType } from './useTowerWeightsConfig';
import { getFoundationTypeForAsset, type FoundationTypeConfig } from './useFoundationTypesConfig';
import type { StubSettingConfig } from './useStubSettingsConfig';
import type { AssetListItem } from './useAssets';

// Same alias used by useFoundationTypesConfig: B90C has no dedicated stub-setting
// table, so it looks up B90's.
const STUB_TYPE_ALIASES: Record<string, string> = { B90C: 'B90' };

type Vec2 = [number, number];

function normalize(v: Vec2): Vec2 {
  const mag = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
  return [v[0] / mag, v[1] / mag];
}

/** Bisector direction (along the line) and its perpendicular, at asset `index` within
 * an already-ordered (by natural asset-code sort, as `useAssets` provides) coordinate
 * list. End-of-line assets use the single adjacent segment's direction. */
export function computeBisector(index: number, coords: { x: number; y: number }[]): [Vec2, Vec2] {
  const cur = coords[index];
  const prev = coords[index - 1];
  const next = coords[index + 1];

  let bis: Vec2;
  if (!prev) {
    bis = normalize([next.x - cur.x, next.y - cur.y]);
  } else if (!next) {
    bis = normalize([cur.x - prev.x, cur.y - prev.y]);
  } else {
    const v1 = normalize([cur.x - prev.x, cur.y - prev.y]);
    const v2 = normalize([next.x - cur.x, next.y - cur.y]);
    bis = normalize([v1[0] + v2[0], v1[1] + v2[1]]);
  }
  const perpSag: Vec2 = [bis[1], -bis[0]];
  return [bis, perpSag];
}

interface LegResult {
  leg: number;
  stub: string;
  bWidthM: number;
  cornersUtm: Vec2[];
}

const STUB_NAMES: Record<number, string> = { 1: 'Z41', 2: 'Z42', 3: 'Z43', 4: 'Z44' };
const LEG_OFFSET_SIGNS: Record<number, [number, number]> = {
  1: [-1, 1],
  2: [-1, -1],
  3: [1, -1],
  4: [1, 1],
};

/** Validated formula (804/804 real-tower leg-rows matched to 0.5mm): offset + dim/2 +
 * (B*1000)/2 for Z1, Z1 - B*1000 for Z2. dim is the type's B-dimension for every leg
 * (the corrected reading -- the source Excel has a copy-paste bug that only applies B
 * to leg 1 and silently uses W for legs 2-4 on BLS towers; this computes the intended
 * engineering value for all 4 legs instead). Returns null if the (bodyExt, legExt)
 * combo isn't in the table (data gap). */
export function computeLegExcavation(
  base: string,
  bodyExtM: number,
  legExtM: number,
  bWidthM: number,
  stub: StubSettingConfig,
  legIndex: number,
  center: Vec2,
  bis: Vec2,
  perpSag: Vec2,
): LegResult | null {
  const entry = stub.table.find((t) => t.bodyExtM === bodyExtM && t.legExtM === legExtM);
  if (!entry) return null;

  const isBls = base === 'BLS';
  const dimMm = isBls ? entry.bMm : entry.wMm;
  const { a, j, k } = stub.angleFactor;
  const offsetMm = (a / j) * k;

  const z1Mm = offsetMm + dimMm / 2 + (bWidthM * 1000) / 2;
  const hM = bWidthM / 2; // (z1 - z2) / 2 / 1000 simplifies to this by construction
  const legM = z1Mm / 1000 - hM;

  const [sBis, sPerp] = LEG_OFFSET_SIGNS[legIndex];
  const legCenter: Vec2 = [center[0] + sBis * legM * bis[0] + sPerp * legM * perpSag[0], center[1] + sBis * legM * bis[1] + sPerp * legM * perpSag[1]];

  const cornerSigns: [number, number][] = [
    [-1, 1],
    [-1, -1],
    [1, -1],
    [1, 1],
  ];
  const cornersUtm = cornerSigns.map(
    ([cb, cp]): Vec2 => [legCenter[0] + cb * hM * bis[0] + cp * hM * perpSag[0], legCenter[1] + cb * hM * bis[1] + cp * hM * perpSag[1]],
  );

  return { leg: legIndex, stub: STUB_NAMES[legIndex], bWidthM, cornersUtm };
}

/** Builds the per-leg excavation-pit GeoJSON layer directly from asset data (leg
 * extensions + soil type on `assets`, foundation B-width and stub-setting lookup
 * tables from project_config) -- no external Excel needed. Assets must already be in
 * natural asset-code order (as `useAssets` returns) so bisector adjacency is correct. */
export function buildExcavationFeatureCollection(
  assets: AssetListItem[],
  stubSettings: StubSettingConfig[],
  foundationTypes: FoundationTypeConfig[],
  coordinateSystem: string | null,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (!coordinateSystem) return { type: 'FeatureCollection', features };

  const coords = assets.map((a) => ({ x: a.x ?? NaN, y: a.y ?? NaN }));

  assets.forEach((asset, index) => {
    if (asset.x == null || asset.y == null || !asset.asset_type) return;
    const legExts = [asset.leg1_ext_m, asset.leg2_ext_m, asset.leg3_ext_m, asset.leg4_ext_m];
    if (legExts.some((e) => e == null)) return;

    const parsed = parseTowerType(asset.asset_type);
    if (!parsed) return;
    const lookupType = STUB_TYPE_ALIASES[parsed.type] ?? parsed.type;
    const stub = stubSettings.find((s) => s.type === lookupType);
    if (!stub) return;

    const foundation = getFoundationTypeForAsset(asset.asset_type, foundationTypes);
    if (!foundation) return;

    const center: Vec2 = [asset.x, asset.y];
    const [bis, perpSag] = computeBisector(index, coords);

    for (let legIndex = 1; legIndex <= 4; legIndex++) {
      const legExtM = legExts[legIndex - 1] as number;
      const result = computeLegExcavation(
        parsed.type,
        parsed.bodyExtM,
        legExtM,
        foundation.bWidthM,
        stub,
        legIndex,
        center,
        bis,
        perpSag,
      );
      if (!result) continue;

      const ring = [...result.cornersUtm, result.cornersUtm[0]].map(([x, y]) => {
        const [lat, lng] = utmToLatLng(x, y, coordinateSystem);
        return [lng, lat];
      });
      features.push({
        type: 'Feature',
        properties: {
          category: 'excavation_pit',
          tower: asset.asset_code,
          tower_type: asset.asset_type,
          leg: result.leg,
          stub: result.stub,
          b_width_m: Number(result.bWidthM.toFixed(3)),
          // Site engineers work in UTM, not lat/lng -- shown on hover in MapView.
          corners_utm: result.cornersUtm.map(([x, y]) => [Number(x.toFixed(3)), Number(y.toFixed(3))]),
        },
        geometry: { type: 'Polygon', coordinates: [ring] },
      });
    }
  });

  return { type: 'FeatureCollection', features };
}
