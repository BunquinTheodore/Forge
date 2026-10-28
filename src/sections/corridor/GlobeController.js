import { REGIONS } from './corridorData.js';
import { corridorState } from './corridorState.js';

const LAT_FACTOR = 0.6;       // tilt only partway toward the region latitude
const FOLLOW = 3.4;           // easing rate toward the target view
const DRIFT_DEG = 8;          // gentle scroll drift inside a region

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const damp = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));

/**
 * Owns where the globe looks. Combines the active region and scroll progress
 * and publishes the result to corridorState.
 * Used by both the GL act and the SVG fallback, so they always agree.
 */
export class GlobeController {
  constructor(reducedMotion) {
    this.reduced = reducedMotion;
    this.regionIndex = 0;
    this.progress = 0;
    const r = REGIONS[0];
    this.lon = r.lon;
    this.lat = r.lat * LAT_FACTOR;
    corridorState.animate = !reducedMotion;
  }

  setRegion(index) {
    this.regionIndex = index;
  }

  setProgress(p) {
    this.progress = p;
  }

  update(dt) {
    const region = REGIONS[this.regionIndex];
    const drift = this.reduced ? 0 : (this.progress - 0.5) * DRIFT_DEG;
    const rate = this.reduced ? 60 : FOLLOW;
    this.lon = damp(this.lon, region.lon + drift, rate, dt);
    this.lat = damp(this.lat, region.lat * LAT_FACTOR, rate, dt);
    this.#publish(region, dt);
  }

  #publish(region, dt) {
    const s = corridorState;
    const p = this.progress;
    s.lon = this.lon;
    s.lat = this.lat;
    s.focusLon = region.lon;
    s.focusLat = region.lat;
    if (this.reduced) {
      s.intro = 1;
      s.reveal = 1;
      return;
    }
    const byRegion = this.regionIndex === 2 ? 1 : this.regionIndex === 1 ? 0.56 : 0;
    s.intro = smooth(0.02, 0.26, p);
    const target = Math.max(smooth(0.2, 0.62, p), byRegion);
    // Ease so a region change draws the arcs instead of popping them in.
    s.reveal = target < s.reveal ? target : damp(s.reveal, target, 2.2, dt);
  }
}
