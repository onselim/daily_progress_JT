import { utmToLatLng } from './utmToLatLng';
import type { AssetListItem } from './useAssets';

/** Handed to the standalone AR page (/ar-demo/geo/) through localStorage: both live on the same origin,
 * so no keys or extra requests are needed and the project's own access rules already applied when this
 * data was fetched. Keep in sync with `projLoad()` in ar-demo/site/geo/index.html (payload version 1). */
export const AR_STORAGE_KEY = 'arProject';
export const AR_PAGE_URL = '/ar-demo/geo/index.html?proje=1'; // explicit index.html: works on Netlify and on the Vite dev server

export interface ArPayloadAsset {
  c: string; // asset code, e.g. "10" or "G1"
  lat: number;
  lng: number;
  z: number | null; // ground elevation (project datum)
  s: string; // not_started | in_progress | completed | on_hold
  a: 0 | 1; // work happened today or is planned tomorrow
  r: 0 | 1; // site access restricted today
  st: string | null; // station / chainage
  t: string | null; // structure type
}

export interface ArPayload {
  v: 1;
  slug: string;
  name: string;
  at: string;
  assets: ArPayloadAsset[];
}

export function buildArPayload(
  project: { slug: string; name: string; coordinate_system: string | null },
  assets: AssetListItem[],
  activeIds: Set<string>,
  restrictedIds: Set<string>,
): ArPayload {
  const out: ArPayloadAsset[] = [];
  for (const asset of assets) {
    let lat = asset.lat;
    let lng = asset.lng;
    if ((lat == null || lng == null) && asset.x != null && asset.y != null && project.coordinate_system) {
      try {
        [lat, lng] = utmToLatLng(asset.x, asset.y, project.coordinate_system);
      } catch {
        continue;
      }
    }
    if (lat == null || lng == null) continue;
    out.push({
      c: asset.asset_code,
      lat,
      lng,
      z: asset.z,
      s: asset.status,
      a: activeIds.has(asset.id) ? 1 : 0,
      r: restrictedIds.has(asset.id) ? 1 : 0,
      st: asset.station,
      t: asset.asset_type,
    });
  }
  return { v: 1, slug: project.slug, name: project.name, at: new Date().toISOString(), assets: out };
}

/** Stores the payload for the AR page and opens it. */
export function launchAr(payload: ArPayload) {
  try {
    localStorage.setItem(AR_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // storage full / blocked: the AR page then simply shows no project layer
  }
  window.location.href = AR_PAGE_URL;
}

/** Deep link into the AR page's per-tower excavation-pit application (see the "Kazı aplikasyonu"
 * form and `digFetch()` in ar-demo/site/geo/index.html): the AR page re-fetches that one tower's
 * geometry itself from Supabase by project slug + asset code, pre-filled and auto-run, so a field
 * engineer opens straight into that tower's excavation stakeout instead of typing the project slug
 * and tower number by hand on their phone. Opened in a new tab so the report view stays open. */
export function arExcavationUrl(projectSlug: string, assetCode: string): string {
  const qs = new URLSearchParams({ dig: '1', slug: projectSlug, code: assetCode });
  return `/ar-demo/geo/index.html?${qs.toString()}`;
}

/** Deep link into the AR page's full line/KMZ viewer (the "Hat" panel), centred on one tower,
 * for the Stringing section's visual sag check: a field engineer stands ~50-100 m off the
 * midpoint of a span and compares the real conductor against the imported PLS-CADD line drawn
 * in AR. If the project's line was uploaded as a Layers document (`kmz`), the AR page fetches
 * and imports it automatically instead of requiring a manual KMZ pick on that device; if not,
 * the AR page still opens and prompts for a manual KMZ/KML upload (same as using it directly). */
export function arStringingUrl(assetCode: string, kmz: { url: string; name: string } | null): string {
  const qs = new URLSearchParams({ goto: assetCode });
  if (kmz) {
    qs.set('kmzurl', kmz.url);
    qs.set('kmzname', kmz.name);
  }
  return `/ar-demo/geo/index.html?${qs.toString()}`;
}

/** Link to the standalone 3D "stub ayar" measurement page (public/stub-ayar/index.html): it reads this one tower
 * (type, body extension, per-leg extensions) and the project's stub_settings table from Supabase by project slug +
 * asset code, then animates where each stub-setting dimension (W, B, BC) is taken with a tape measure. */
export function stubSettingsUrl(projectSlug: string, assetCode: string): string {
  const qs = new URLSearchParams({ slug: projectSlug, kod: assetCode });
  return `/stub-ayar/index.html?${qs.toString()}`;
}
