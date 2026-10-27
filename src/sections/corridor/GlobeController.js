import { REGIONS } from './corridorData.js';
import { corridorState } from './corridorState.js';

const LAT_FACTOR = 0.6;       // tilt only partway toward the region latitude
const FOLLOW = 3.4;           // easing rate toward the target view
const SPIN_FRICTION = 2.6;    // inertia decay after a fling
const RETURN_DELAY = 2.2;     // seconds idle before a manual spin drifts home
const RETURN_RATE = 0.7;
const DRIFT_DEG = 8;          // gentle scroll drift inside a region

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const damp = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));

/**
 * Owns where the globe looks. Combines the active region, scroll progress and
 * manual spin (drag, keys) and publishes the result to corridorState.
 * Used by both the GL act and the SVG fallback, so they always agree.
 */
export class GlobeController {
  constructor(reducedMotion) {
    this.reduced = reducedMotion;
    this.regionIndex = 0;
    this.progress = 0;
    this.spin = 0;
    this.spinVel = 0;
    this.dragging = false;
    this.idle = 0;
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

  /** Manual spin in degrees (positive drags the surface to the right). */
  dragBy(deg) {
    this.spin += deg;
    this.idle = 0;
  }

  beginDrag() {
    this.dragging = true;
    this.spinVel = 0;
  }

  endDrag(velocityDeg) {
    this.dragging = false;
    this.spinVel = this.reduced ? 0 : velocityDeg;
    this.idle = 0;
  }

  update(dt) {
    this.#integrateSpin(dt);
    const region = REGIONS[this.regionIndex];
    const drift = this.reduced ? 0 : (this.progress - 0.5) * DRIFT_DEG;
    const targetLon = region.lon + drift - this.spin;
    const targetLat = region.lat * LAT_FACTOR;
    const rate = this.reduced ? 60 : FOLLOW;
    this.lon = damp(this.lon, targetLon, this.dragging ? 18 : rate, dt);
    this.lat = damp(this.lat, targetLat, rate, dt);
    this.#publish(region, dt);
  }

  #integrateSpin(dt) {
    if (this.dragging) return;
    this.idle += dt;
    if (Math.abs(this.spinVel) > 0.01) {
      this.spin += this.spinVel * dt;
      this.spinVel *= Math.exp(-SPIN_FRICTION * dt);
    }
    if (this.idle > RETURN_DELAY) this.spin = damp(this.spin, 0, RETURN_RATE, dt);
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
    // Ease so a tab click draws the arcs instead of popping them in.
    s.reveal = target < s.reveal ? target : damp(s.reveal, target, 2.2, dt);
  }
}
