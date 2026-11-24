const EASE = 7;            // pointer follow speed (per second)
const IDLE_AFTER = 1.8;    // seconds without input before the heat starts to wander
const IDLE_RADIUS = 0.55;  // hotspot radius as a fraction of the word height, at rest
const HOT_RADIUS = 0.9;    // hotspot radius while the visitor is steering it
const WRITE_EPSILON = 0.4; // px, skip CSS variable writes smaller than this
const DRIFT_BUDGET = 8;    // seconds of idle drifting before the heat settles and holds still
const SCROLL_QUIET = 0.4;  // seconds after the last scroll event before the heat may drift
const DRIFT_STEP = 1 / 30; // idle drift is written at about 30 Hz, steering at the full frame rate
const DRIFT_TICK = DRIFT_STEP * 0.6; // slack so frame times of 20 to 25 ms still tick every frame, not every other

/**
 * Giant outlined FORGE wordmark whose letters fill with molten ember around
 * the pointer (mouse, pen or touch drag). Each letter carries its own offset
 * (--ox) so the gradient stays continuous across letters. When nobody steers
 * it, the heat wanders slowly along the word for a few seconds (unless reduced
 * motion), then settles and holds still.
 *
 * Every write to --mx/--my/--r restyles and repaints the huge gradient filled
 * letters, so writes are kept to the minimum: none while the page scrolls (idle
 * drift and pointer steering both hold their last target until scrolling stops),
 * none once the heat has settled, and idle drift runs at half the frame rate.
 */
export class MoltenWordmark {
  constructor(section, mark) {
    this.section = section;
    this.mark = mark;
    this.word = mark.querySelector('.footer__word');
    this.letters = Array.from(mark.querySelectorAll('.footer__l'));
    this.w = 1; this.h = 1;
    this.x = 0; this.y = 0; this.r = 0;
    this.tx = 0; this.ty = 0; this.tr = 0;
    this.written = { x: -1, y: -1, r: -1 };
    this.idle = IDLE_AFTER;
    this.steering = false;
    this.pointer = null;
    this.wander = 0;
    this.budget = DRIFT_BUDGET;
    this.sinceScroll = SCROLL_QUIET;
    this.pending = 0;
    this.measured = false;

    section.listen(mark, 'pointermove', (e) => this.#aim(e));
    section.listen(mark, 'pointerdown', (e) => this.#aim(e));
    section.listen(mark, 'pointerleave', () => { this.steering = false; this.pointer = null; });
    section.listen(mark, 'pointercancel', () => { this.steering = false; this.pointer = null; });
    section.listen(window, 'scroll', () => { this.sinceScroll = 0; });
    section.listen(window, 'resize', () => this.measure());
    this.measure();
    this.x = this.tx; this.y = this.ty; this.r = this.tr;
  }

  measure() {
    const box = this.word.getBoundingClientRect();
    const w = Math.max(1, box.width);
    const h = Math.max(1, box.height);
    this.letters.forEach((l) => l.style.setProperty('--ox', `${l.offsetLeft}px`));
    if (!this.measured) {
      this.w = w; this.h = h; this.measured = true;
      this.#rest(this.section.reducedMotion ? 0.5 : 0.2);
      return;
    }
    // Keep the heat where it is, scaled to the new size: a mobile URL bar collapsing
    // fires resize while scrolling, and must not snap a settled heat back to rest.
    const sx = w / this.w;
    const sy = h / this.h;
    if (sx === 1 && sy === 1) return;
    this.w = w; this.h = h;
    this.tx *= sx; this.x *= sx;
    this.ty *= sy; this.y *= sy;
    this.tr *= sy; this.r *= sy;
  }

  /** Give the idle drift a fresh budget, e.g. when the footer comes back into view. */
  wake() {
    this.budget = DRIFT_BUDGET;
    this.idle = IDLE_AFTER + DRIFT_STEP;
    this.pending = 0;
  }

  /** Remember the pointer only; the layout read happens once per frame in update(). */
  #aim(e) {
    this.pointer = { x: e.clientX, y: e.clientY };
    this.steering = true;
    this.idle = 0;
    this.budget = DRIFT_BUDGET;
  }

  #steer() {
    const box = this.word.getBoundingClientRect();
    this.tx = this.pointer.x - box.left;
    this.ty = this.pointer.y - box.top;
    this.tr = this.h * HOT_RADIUS;
  }

  #rest(u) {
    this.tx = this.w * u;
    this.ty = this.h * 0.62;
    this.tr = this.h * IDLE_RADIUS;
  }

  #drift(dt) {
    this.budget -= dt;
    this.wander += dt * 0.16;
    const u = 0.5 + Math.sin(this.wander * Math.PI) * 0.46;
    this.#rest(u);
    this.ty = this.h * (0.55 + Math.sin(this.wander * 2.3) * 0.18);
  }

  update(frameDt) {
    let dt = frameDt;
    this.sinceScroll += dt;
    const scrolling = this.sinceScroll <= SCROLL_QUIET;
    let drifting = false;
    if (this.steering && this.pointer) {
      // The cursor can rest on the wordmark while the page scrolls under it: hold the last
      // target (no layout read, no repaint) until scrolling stops.
      if (!scrolling) this.#steer();
    } else if (!this.steering) {
      this.idle += dt;
      drifting = this.idle > IDLE_AFTER && !this.section.reducedMotion && !scrolling && this.budget > 0;
    }
    if (drifting) {
      // Idle drift is slow, so it only needs a new frame about 30 times a second.
      this.pending += dt;
      if (this.pending < DRIFT_TICK) return;
      dt = this.pending;
      this.pending = 0;
      this.#drift(dt);
    } else {
      this.pending = 0;
    }
    const k = Math.min(1, dt * EASE);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    this.r += (this.tr - this.r) * k;
    this.#write();
  }

  #write() {
    const s = this.word.style;
    const w = this.written;
    if (Math.abs(this.x - w.x) > WRITE_EPSILON) { w.x = this.x; s.setProperty('--mx', `${this.x.toFixed(1)}px`); }
    if (Math.abs(this.y - w.y) > WRITE_EPSILON) { w.y = this.y; s.setProperty('--my', `${this.y.toFixed(1)}px`); }
    if (Math.abs(this.r - w.r) > WRITE_EPSILON) { w.r = this.r; s.setProperty('--r', `${this.r.toFixed(1)}px`); }
  }

  /** 0..1 molten "pour" level from the bottom of the letters, driven by scroll. */
  setLevel(level) {
    this.word.style.setProperty('--level', `${(level * 100).toFixed(1)}%`);
  }
}
