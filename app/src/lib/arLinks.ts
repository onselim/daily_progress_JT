/** The daily-report app's AR page (public/ar-demo/hat/): only the project's PLS-CADD line on the terrain plus the
 * excavation pits of one tower. It loads the project, its towers and the stub/foundation tables from Supabase by
 * slug itself (reusing this app's login when present) and the line KMZ from the project's Layers documents. The
 * model-library sandbox at /ar-demo/geo/ is a separate tool and is no longer linked from the app. */
export const AR_HAT_PAGE = '/ar-demo/hat/index.html'; // explicit index.html: works on Netlify and on the Vite dev server

function arHatUrl(projectSlug: string, extra: Record<string, string>, kmz: { url: string; name: string } | null): string {
  const qs = new URLSearchParams({ slug: projectSlug, ...extra });
  if (kmz) {
    qs.set('kmzurl', kmz.url);
    qs.set('kmzname', kmz.name);
  }
  return `${AR_HAT_PAGE}?${qs.toString()}`;
}

/** Opens the AR page with this tower picked in its "Kazı alanı" menu: once the AR alignment is done (phone GPS,
 * reference towers, or the tower's centre + alignment stakes) its four pits are drawn in place. */
export function arExcavationUrl(projectSlug: string, assetCode: string, kmz: { url: string; name: string } | null = null): string {
  return arHatUrl(projectSlug, { kazi: assetCode }, kmz);
}

/** Opens the AR page centred on this tower, for the Stringing section's visual sag check against the imported
 * PLS-CADD line (stand ~50-100 m off a span's midpoint and compare the real conductor). */
export function arStringingUrl(projectSlug: string, assetCode: string, kmz: { url: string; name: string } | null): string {
  return arHatUrl(projectSlug, { direk: assetCode }, kmz);
}

/** The whole project's line, no tower pre-selected (the /ar/<slug> route). */
export function arProjectUrl(projectSlug: string): string {
  return arHatUrl(projectSlug, {}, null);
}

/** Link to the standalone 3D "stub ayar" measurement page (public/stub-ayar/index.html): it reads this one tower
 * (type, body extension, per-leg extensions) and the project's stub_settings table from Supabase by project slug +
 * asset code, then animates where each stub-setting dimension (W, B, BC) is taken with a tape measure. */
export function stubSettingsUrl(projectSlug: string, assetCode: string, language?: string): string {
  const qs = new URLSearchParams({ slug: projectSlug, kod: assetCode });
  if (language) qs.set('dil', language); // the page has the app's 9 languages (falls back to the app_language setting)
  return `/stub-ayar/index.html?${qs.toString()}`;
}
