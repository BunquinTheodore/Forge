/**
 * Corridor geography shared by the section (DOM/SVG) and the GL act.
 * Plain data only: no three.js here so the section bundle stays light.
 */

/** Regions the visitor can focus. lon/lat = where the globe turns to. */
export const REGIONS = [
  { id: 'europe', name: 'Italy / Europe', lon: 12.5, lat: 41.9 },
  { id: 'philippines', name: 'Philippines', lon: 121, lat: 14.6 },
  { id: 'asean', name: 'ASEAN', lon: 104, lat: 5 },
];

export const REGION_INDEX = Object.freeze(
  Object.fromEntries(REGIONS.map((r, i) => [r.id, i])),
);

/** [lon, lat] of each corridor city, plus label placement for the SVG overlay. */
export const CITIES = {
  milan: { name: 'Milan', lon: 9.19, lat: 45.46, dx: -7, anchor: 'end' },
  rome: { name: 'Rome', lon: 12.5, lat: 41.9, dx: 7, anchor: 'start' },
  manila: { name: 'Manila', lon: 120.98, lat: 14.6, dx: 8, anchor: 'start' },
  bangkok: { name: 'Bangkok', lon: 100.5, lat: 13.75, dx: -7, anchor: 'end' },
  hcmc: { name: 'Ho Chi Minh City', lon: 106.63, lat: 10.82, dx: 7, anchor: 'start', dy: 9 },
  kl: { name: 'Kuala Lumpur', lon: 101.69, lat: 3.14, dx: -7, anchor: 'end' },
  singapore: { name: 'Singapore', lon: 103.82, lat: 1.35, dx: 7, anchor: 'start' },
  jakarta: { name: 'Jakarta', lon: 106.85, lat: -6.2, dx: 7, anchor: 'start' },
};

/**
 * Routes: [from, to, gateStart, gateLength]. The gate is the slice of the global
 * reveal (0..1) during which the arc draws itself. Europe first, then ASEAN fan-out.
 */
export const ROUTES = [
  ['milan', 'manila', 0.0, 0.5],
  ['rome', 'manila', 0.04, 0.5],
  ['manila', 'bangkok', 0.56, 0.24],
  ['manila', 'hcmc', 0.6, 0.22],
  ['manila', 'kl', 0.64, 0.24],
  ['manila', 'singapore', 0.68, 0.22],
  ['manila', 'jakarta', 0.72, 0.26],
];

/** Arc altitude (in sphere radii) for an arc spanning `omega` radians. */
export function arcHeight(omega) {
  return 0.06 + 0.32 * (omega / Math.PI);
}

const DEG = Math.PI / 180;

/** Unit vector for lat/lon in the globe's object space (x right at lon 0, y up, z toward lon -90). */
export function latLonToUnit(lat, lon, out, offset = 0) {
  const phi = lat * DEG;
  const lam = lon * DEG;
  out[offset] = Math.cos(phi) * Math.cos(lam);
  out[offset + 1] = Math.sin(phi);
  out[offset + 2] = -Math.cos(phi) * Math.sin(lam);
  return out;
}

/**
 * Sample a great-circle arc lifted above the sphere. Writes `count` xyz points into `out`.
 * Returns the angular span (radians).
 */
export function sampleArc(a, b, count, out, offset = 0) {
  const A = latLonToUnit(a.lat, a.lon, [0, 0, 0]);
  const B = latLonToUnit(b.lat, b.lon, [0, 0, 0]);
  const dot = Math.min(1, Math.max(-1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
  const omega = Math.acos(dot);
  const sinO = Math.sin(omega) || 1;
  const h = arcHeight(omega);
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const wa = Math.sin((1 - t) * omega) / sinO;
    const wb = Math.sin(t * omega) / sinO;
    const lift = 1 + h * Math.sin(Math.PI * t);
    const k = offset + i * 3;
    out[k] = (A[0] * wa + B[0] * wb) * lift;
    out[k + 1] = (A[1] * wa + B[1] * wb) * lift;
    out[k + 2] = (A[2] * wa + B[2] * wb) * lift;
  }
  return omega;
}
