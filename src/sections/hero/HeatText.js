const HEAT_DECAY = 1.6;      // heat units lost per second once the pointer leaves
const HEAT_RISE = 7;         // how fast the metal reaches full glow under the pointer

/**
 * Pointer heat on the FORGE wordmark. Each letter carries an ember duplicate (::after)
 * masked by a radial spot at the pointer. Letter offsets are measured on resize only,
 * so pointer moves write just three custom properties on one element.
 */
export class HeatText {
  constructor(mark, letters) {
    this.mark = mark;
    this.letters = letters;
    this.target = 0;
    this.heat = 0;
    this.x = -9999;
    this.y = -9999;
    this.dirty = false;
    this.measure();
  }

  measure() {
    for (const l of this.letters) {
      l.style.setProperty('--ox', `${l.offsetLeft}px`);
      l.style.setProperty('--oy', `${l.offsetTop}px`);
    }
  }

  /** Pointer in viewport coordinates. */
  point(clientX, clientY, strength = 1) {
    const box = this.mark.getBoundingClientRect();
    this.x = clientX - box.left;
    this.y = clientY - box.top;
    this.target = strength;
    this.dirty = true;
  }

  release() { this.target = 0; }

  /** Strike: full heat at a point that then cools on its own. */
  strike(clientX, clientY) {
    this.point(clientX, clientY, 1);
    this.heat = 1;
    this.target = 0;
  }

  get active() { return this.heat > 0.002 || this.target > 0; }

  update(dt) {
    if (!this.active && !this.dirty) return;
    const goal = this.target;
    if (this.heat < goal) this.heat = Math.min(goal, this.heat + dt * HEAT_RISE);
    else this.heat = Math.max(goal, this.heat - dt * HEAT_DECAY);
    const s = this.mark.style;
    if (this.dirty) {
      s.setProperty('--hx', `${this.x.toFixed(1)}px`);
      s.setProperty('--hy', `${this.y.toFixed(1)}px`);
      this.dirty = false;
    }
    s.setProperty('--heat', this.heat < 0.002 ? '0' : this.heat.toFixed(3));
  }
}
