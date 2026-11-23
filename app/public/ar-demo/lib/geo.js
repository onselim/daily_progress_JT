// Shared geodesy helpers for the AR pages (plain ES module, no build step: served as-is from public/).
// Same maths as the inline copy in ar-demo/geo/index.html.
export const R = 6378137, rad = Math.PI / 180, deg = 180 / Math.PI;
export const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// local East/North (metres) of (lat,lng) seen from (lat0,lng0); fine for the few-km extents used here
export const enuFrom = (lat0, lng0, lat, lng) => ({ e: (lng - lng0) * rad * R * Math.cos(lat0 * rad), n: (lat - lat0) * rad * R });
export const offsetLatLng = (lat, lng, e, n) => [lat + n / (rad * R), lng + e / (rad * R * Math.cos(lat * rad))];
export const distM = (a, b) => { const o = enuFrom(a.lat, a.lng, b.lat, b.lng); return Math.hypot(o.e, o.n); };

// UTM <-> WGS84 (Krüger series, sub-millimetre inside a zone)
const WGS = (() => {
  const a = 6378137, f = 1 / 298.257223563, n = f / (2 - f), n2 = n * n, n3 = n2 * n, n4 = n3 * n;
  return {
    A: a / (1 + n) * (1 + n2 / 4 + n4 / 64), n,
    alpha: [n / 2 - 2 * n2 / 3 + 5 * n3 / 16 + 41 * n4 / 180, 13 * n2 / 48 - 3 * n3 / 5 + 557 * n4 / 1440, 61 * n3 / 240 - 103 * n4 / 140, 49561 * n4 / 161280],
    beta: [n / 2 - 2 * n2 / 3 + 37 * n3 / 96 - n4 / 360, n2 / 48 + n3 / 15 - 437 * n4 / 1440, 17 * n3 / 480 - 37 * n4 / 840, 4397 * n4 / 161280],
    delta: [2 * n - 2 * n2 / 3 - 2 * n3 + 116 * n4 / 45, 7 * n2 / 3 - 8 * n3 / 5 - 227 * n4 / 45, 56 * n3 / 15 - 136 * n4 / 35, 4279 * n4 / 630],
  };
})();
export const utmZoneOf = (lng) => Math.min(60, Math.max(1, Math.floor((lng + 180) / 6) + 1));
export function latLngToUtm(lat, lng, zone, north = true) {
  const { n, A, alpha } = WGS, k0 = 0.9996, c = 2 * Math.sqrt(n) / (1 + n);
  const lam = lng * rad - ((zone - 1) * 6 - 180 + 3) * rad, sp = Math.sin(lat * rad);
  const t = Math.sinh(Math.atanh(sp) - c * Math.atanh(c * sp));
  const xi0 = Math.atan2(t, Math.cos(lam)), eta0 = Math.asinh(Math.sin(lam) / Math.hypot(t, Math.cos(lam)));
  let xi = xi0, eta = eta0;
  for (let j = 1; j <= 4; j++) { xi += alpha[j - 1] * Math.sin(2 * j * xi0) * Math.cosh(2 * j * eta0); eta += alpha[j - 1] * Math.cos(2 * j * xi0) * Math.sinh(2 * j * eta0); }
  return [500000 + k0 * A * eta, (north ? 0 : 10000000) + k0 * A * xi];
}
export function utmToLatLng(zone, north, E, N) {
  const { A, beta, delta } = WGS, k0 = 0.9996;
  const xi0 = (N - (north ? 0 : 10000000)) / (k0 * A), eta0 = (E - 500000) / (k0 * A);
  let xi = xi0, eta = eta0;
  for (let j = 1; j <= 4; j++) { xi -= beta[j - 1] * Math.sin(2 * j * xi0) * Math.cosh(2 * j * eta0); eta -= beta[j - 1] * Math.cos(2 * j * xi0) * Math.sinh(2 * j * eta0); }
  const chi = Math.asin(Math.sin(xi) / Math.cosh(eta));
  let phi = chi; for (let j = 1; j <= 4; j++) phi += delta[j - 1] * Math.sin(2 * j * chi);
  return [phi * deg, ((zone - 1) * 6 - 180 + 3) + Math.atan2(Math.sinh(eta), Math.cos(xi)) * deg];
}
// "EPSG:32638" (the app's projects.coordinate_system) -> { zone: 38, north: true }, or null
export function epsgToUtm(cs) {
  const m = /EPSG:(\d{4,5})/.exec(cs || ''); if (!m) return null;
  const epsg = +m[1], north = epsg < 32700, zone = north ? epsg - 32600 : epsg - 32700;
  return zone >= 1 && zone <= 60 ? { zone, north } : null;
}
