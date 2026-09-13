/** Tips a tower's standing local-frame point (east, north, up meters relative to its own
 * base) over so it lies flat on the ground, roughly parallel to the line -- used to show
 * a ground-assembled-but-not-yet-erected tower lying down instead of standing upright.
 * Not a physically exact fall simulation (this is a visual cue, not an engineering
 * animation): the original vertical extent (height) becomes horizontal reach along the
 * line's bearing, the across-line footprint is left untouched, and the small original
 * along-line footprint offset becomes a low residual height above ground. */
export function toLyingLocalPoint(e: number, n: number, u: number, bearingDegrees: number): [number, number, number] {
  const bearingRad = (bearingDegrees * Math.PI) / 180;
  const fwdE = Math.sin(bearingRad);
  const fwdN = Math.cos(bearingRad);
  const rightE = Math.cos(bearingRad);
  const rightN = -Math.sin(bearingRad);

  const along = e * fwdE + n * fwdN;
  const across = e * rightE + n * rightN;

  const newAlong = u;
  const newAcross = across;
  const newUp = Math.abs(along);

  const newE = newAlong * fwdE + newAcross * rightE;
  const newN = newAlong * fwdN + newAcross * rightN;
  return [newE, newN, newUp];
}
