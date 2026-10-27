/**
 * Tiny shared state bus between CorridorSection (writer) and CorridorAct (reader).
 * Mutated in place every frame on purpose: no per-frame allocations.
 */
export const corridorState = {
  lon: 12.5,        // view centre longitude (deg)
  lat: 25,          // view centre latitude (deg)
  focusLon: 12.5,   // highlighted region (deg)
  focusLat: 41.9,
  intro: 0,         // 0..1 dots converge into a globe
  reveal: 0,        // 0..1 arcs draw themselves
  animate: true,    // false under reduced motion: no pulses or drift
  glActive: false,  // set by the act once it renders
};
