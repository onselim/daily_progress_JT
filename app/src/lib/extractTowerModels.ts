import { loadCesium } from './loadCesium';

export interface TowerModelSegment {
  a: [number, number, number];
  b: [number, number, number];
}

interface AssetPoint {
  id: string;
  lat: number;
  lng: number;
}

const MAX_CANDIDATE_RADIUS_M = 35;
const EARTH_RADIUS_M = 6371000;

/** Cheap planar pre-filter (no Cesium math yet) so the expensive per-asset local-frame
 * transform below only ever runs on the handful of lines actually near that asset,
 * instead of every line in a file that can hold 100k+ of them. */
function roughMetersBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const cosLat = Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180 * cosLat;
  return EARTH_RADIUS_M * Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Loads a PLS-CADD-exported KML/KMZ (via Cesium's own KmlDataSource -- no hand-rolled
 * zip/XML parsing needed) and, for each of this project's real assets, collects the
 * short 2-point line segments that make up that specific tower's own steel-lattice
 * wireframe: legs, cross-arms, bracing. Longer lines (conductor spans, the alignment/
 * tour flythrough paths, profile lines) have endpoints far apart and never land fully
 * inside one tower's small local radius, so they're excluded by construction rather
 * than by name/type -- this file's folder/placemark naming isn't reliable enough to
 * match on directly (PLS-CADD's own KMZ export nests things differently release to
 * release), but real-world proximity is.
 *
 * Segments are returned in each asset's own local East-North-Up frame, in meters,
 * relative to that tower's own base (lowest point in its matched cluster) -- not in
 * absolute lat/lng/height -- so they can be repositioned and reoriented (see
 * `toLyingLocalPoint`) independent of the source file's own coordinates.
 */
export async function extractTowerModelsFromKml(
  kmlUrl: string,
  assets: AssetPoint[],
): Promise<Record<string, TowerModelSegment[]>> {
  await loadCesium();
  const Cesium = window.Cesium;

  const dataSource = await Cesium.KmlDataSource.load(kmlUrl, { clampToGround: false });
  const now = Cesium.JulianDate.now();

  interface CandidateLine {
    centerLat: number;
    centerLng: number;
    positions: any[];
  }
  const lines: CandidateLine[] = [];
  for (const entity of dataSource.entities.values) {
    if (!entity.polyline) continue;
    const positions = entity.polyline.positions?.getValue(now);
    if (!positions || positions.length !== 2) continue;
    const cartoA = Cesium.Cartographic.fromCartesian(positions[0]);
    const cartoB = Cesium.Cartographic.fromCartesian(positions[1]);
    lines.push({
      centerLat: (Cesium.Math.toDegrees(cartoA.latitude) + Cesium.Math.toDegrees(cartoB.latitude)) / 2,
      centerLng: (Cesium.Math.toDegrees(cartoA.longitude) + Cesium.Math.toDegrees(cartoB.longitude)) / 2,
      positions,
    });
  }

  const result: Record<string, TowerModelSegment[]> = {};

  for (const asset of assets) {
    const candidates = lines.filter(
      (line) => roughMetersBetween(asset.lat, asset.lng, line.centerLat, line.centerLng) <= MAX_CANDIDATE_RADIUS_M,
    );
    if (candidates.length === 0) continue;

    const basePosition = Cesium.Cartesian3.fromDegrees(asset.lng, asset.lat, 0);
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(basePosition);
    const invMatrix = Cesium.Matrix4.inverseTransformation(enuMatrix, new Cesium.Matrix4());

    const localPairs: [any, any][] = [];
    let minZ = Infinity;
    for (const line of candidates) {
      const localA = Cesium.Matrix4.multiplyByPoint(invMatrix, line.positions[0], new Cesium.Cartesian3());
      const localB = Cesium.Matrix4.multiplyByPoint(invMatrix, line.positions[1], new Cesium.Cartesian3());
      // Both endpoints have to actually be within the radius in the *local* frame too --
      // the rough lat/lng center check above can admit a line whose midpoint is close
      // but whose far endpoint reaches well outside (e.g. one end of a long span).
      if (Math.hypot(localA.x, localA.y) > MAX_CANDIDATE_RADIUS_M || Math.hypot(localB.x, localB.y) > MAX_CANDIDATE_RADIUS_M) {
        continue;
      }
      localPairs.push([localA, localB]);
      minZ = Math.min(minZ, localA.z, localB.z);
    }
    if (localPairs.length === 0) continue;

    result[asset.id] = localPairs.map(([localA, localB]) => ({
      a: [localA.x, localA.y, localA.z - minZ],
      b: [localB.x, localB.y, localB.z - minZ],
    }));
  }

  dataSource.entities.removeAll();
  return result;
}
