const EASE = 7;            // pointer follow speed (per second)
const IDLE_AFTER = 1.8;    // seconds without input before the heat starts to wander
const IDLE_RADIUS = 0.55;  // hotspot radius as a fraction of the word height, at rest
const HOT_RADIUS = 0.9;    // hotspot radius while the visitor is steering it
const WRITE_EPSILON = 0.4; // px, skip CSS variable writes smaller than this

/**
 * Giant outlined FORGE wordmark whose letters fill with molten ember around
 * the pointer (mouse, pen or touch drag). Each letter carries its own offset
 * (--ox) so the gradient stays continuous across letters. When nobody steers
 * it, the heat wanders slowly along the word (unless reduced motion).
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
    this.wander = 0;

    section.listen(mark, 'pointermove', (e) => this.#aim(e));
    section.listen(mark, 'pointerdown', (e) => this.#aim(e));
    section.listen(mark, 'pointerleave', () => { this.steering = false; });
    section.listen(mark, 'pointercancel', () => { this.steering = false; });
    section.listen(window, 'resize', () => this.measure());
    this.measure();
    this.x = this.tx; this.y = this.ty; this.r = this.tr;
  }

  measure() {
    const box = this.word.getBoundingClientRect();
    this.w = Math.max(1, box.width);
    this.h = Math.max(1, box.height);
    this.letters.forEach((l) => l.style.setProperty('--ox', `${l.offsetLeft}px`));
    if (!this.steering) this.#rest(this.section.reducedMotion ? 0.5 : 0.2);
  }

  #aim(e) {
    const box = this.word.getBoundingClientRect();
    this.tx = e.clientX - box.left;
    this.ty = e.clientY - box.top;
    this.tr = this.h * HOT_RADIUS;
    this.steering = true;
    this.idle = 0;
  }

  #rest(u) {
    this.tx = this.w * u;
    this.ty = this.h * 0.62;
    this.tr = this.h * IDLE_RADIUS;
  }

  update(dt) {
    if (!this.steering) {
      this.idle += dt;
      if (this.idle > IDLE_AFTER && !this.section.reducedMotion) {
        this.wander += dt * 0.16;
        const u = 0.5 + Math.sin(this.wander * Math.PI) * 0.46;
        this.#rest(u);
        this.ty = this.h * (0.55 + Math.sin(this.wander * 2.3) * 0.18);
      }
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
