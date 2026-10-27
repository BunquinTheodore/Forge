/**
 * Detects capability once and exposes a performance tier.
 * Tiers: 'low' (no WebGL / weak device / save-data), 'mid' (phones, tablets), 'high' (desktop GPU).
 */
export class Device {
  constructor() {
    const nav = navigator;
    const mq = (q) => window.matchMedia(q).matches;

    this.reducedMotion = mq('(prefers-reduced-motion: reduce)');
    this.coarsePointer = mq('(pointer: coarse)');
    this.saveData = Boolean(nav.connection && nav.connection.saveData);
    this.cores = nav.hardwareConcurrency || 4;
    this.memory = nav.deviceMemory || 4;
    this.webgl = Device.#hasWebGL();
    this.isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;
    this.tier = this.#computeTier();
  }

  #computeTier() {
    if (!this.webgl || this.saveData || this.memory <= 2 || this.cores <= 2) return 'low';
    // Phones with few cores cannot hold the shared stage at a usable frame rate: they get the CSS
    // fallbacks instead of GL. Judge by touch input plus physical screen size, so a desktop in a
    // short window or a touch tablet is not mistaken for a phone.
    const phone = this.coarsePointer && Math.min(screen.width, screen.height) < 600;
    if (phone && this.cores <= 4) return 'low';
    if (this.coarsePointer || this.isSmallScreen || this.memory <= 4) return 'mid';
    return 'high';
  }

  /** Device pixel ratio cap for the GL canvas at the current tier. */
  get maxDpr() {
    return { low: 1, mid: 1.25, high: 2 }[this.tier];
  }

  /** Multiplier for particle counts and geometry detail: 0.35 / 0.6 / 1. */
  get detail() {
    return { low: 0.35, mid: 0.6, high: 1 }[this.tier];
  }

  downgrade() {
    if (this.tier === 'high') this.tier = 'mid';
    else if (this.tier === 'mid') this.tier = 'low';
    return this.tier;
  }

  static #hasWebGL() {
    try {
      const c = document.createElement('canvas');
      return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  }
}
