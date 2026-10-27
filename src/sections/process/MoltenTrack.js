import { gsap } from '../../core/BaseSection.js';
import { moltenHeads } from './moltenHeads.js';

const DESKTOP = '(min-width: 768px) and (prefers-reduced-motion: no-preference)';
const MOBILE = '(max-width: 767px) and (prefers-reduced-motion: no-preference)';
const REDUCED = '(prefers-reduced-motion: reduce)';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * The six-step track with a molten line that heats each step as it passes.
 * Desktop: pinned horizontal scroll. Narrow screens: vertical stack with a vertical line.
 * Geometry is measured only on refresh; the head position for ProcessAct is derived from
 * scrub progress, the cached geometry and the cached scroll value, so the scrub never reads layout.
 */
export class MoltenTrack {
  /** @param {HTMLElement} section @param {{ y: number }} scroll app scroll state (cached position) */
  constructor(section, scroll) {
    this.section = section;
    this.scroll = scroll;
    this.pin = section.querySelector('[data-pin]');
    this.track = section.querySelector('[data-track]');
    this.line = section.querySelector('.molten');
    this.fill = section.querySelector('[data-molten-fill]');
    this.head = section.querySelector('[data-molten-head]');
    this.steps = Array.from(section.querySelectorAll('.step'));
    this.stops = this.steps.map(() => 0);
    this.hot = this.steps.map(() => false);
    this.vertical = true;
    this.len = 0;
    this.p = 0;
    this.st = null;
    // cached on refresh: viewport size, head origin (p = 0, track x = 0) and the scroll it was read at
    this.geo = { vw: 1, vh: 1, x0: 0, y0: 0, s0: 0, ready: false };
    this.out = { x: 0.5, y: 0.5, vertical: true };
    moltenHeads.set(section, this);
  }

  /** Call inside the section's gsap context. */
  build() {
    const mm = gsap.matchMedia();
    mm.add(DESKTOP, () => this.#horizontal());
    mm.add(MOBILE, () => this.#verticalLine());
    mm.add(REDUCED, () => this.#static());
  }

  /**
   * Line head centre in viewport fractions, from cached values only (no layout reads).
   * Returns null until the geometry has been measured.
   */
  headPoint() {
    const g = this.geo;
    if (!g.ready) return null;
    const s = this.scroll?.y ?? g.s0;
    const o = this.out;
    o.vertical = this.vertical;
    if (this.vertical) {
      o.x = g.x0 / g.vw;
      o.y = (g.y0 - (s - g.s0) + this.p * this.len) / g.vh;
    } else {
      const x = Number(gsap.getProperty(this.track, 'x')) || 0;
      o.x = (g.x0 + x + this.p * this.len) / g.vw;
      o.y = (g.y0 - (this.#travel(s) - this.#travel(g.s0))) / g.vh;
    }
    return o;
  }

  /** How far the pinned block has moved with the page at scroll s (it holds still while pinned). */
  #travel(s) {
    const st = this.st;
    if (!st || !(st.end > st.start)) return s;
    return s - (clamp(s, st.start, st.end) - st.start);
  }

  /** Step centres as fractions of the line length, plus the head origin. Runs on refresh only. */
  #measure() {
    const tr = this.track.getBoundingClientRect();
    const lr = this.line.getBoundingClientRect();
    const len = this.vertical ? tr.height : tr.width;
    this.len = len;
    this.steps.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const c = this.vertical ? r.top - tr.top + 24 : r.left - tr.left + 12;
      this.stops[i] = len > 0 ? c / len : 0;
    });
    const g = this.geo;
    g.vw = window.innerWidth || 1;
    g.vh = window.innerHeight || 1;
    g.s0 = window.scrollY;
    if (this.vertical) {
      g.x0 = lr.left + lr.width / 2;
      g.y0 = lr.top;
    } else {
      g.x0 = lr.left - (Number(gsap.getProperty(this.track, 'x')) || 0);
      g.y0 = lr.top + lr.height / 2;
    }
    g.ready = true;
  }

  #horizontal() {
    this.vertical = false;
    this.section.classList.add('is-h');
    const distance = () => Math.max(0, this.track.scrollWidth - window.innerWidth);
    const heat = (p) => this.#heat(p);
    const tween = gsap.to(this.track, {
      x: () => -distance(),
      ease: 'none',
      onUpdate() { heat(this.progress()); },
      scrollTrigger: {
        trigger: this.pin,
        start: 'top top',
        end: () => `+=${distance() + window.innerHeight * 0.35}`,
        pin: true,
        anticipatePin: 1,
        scrub: 0.5,
        invalidateOnRefresh: true,
        onRefresh: () => this.#measure(),
        onToggle: (st) => this.#setLive(st.isActive),
      },
    });
    this.st = tween.scrollTrigger;
    this.#measure();
    return () => {
      tween.scrollTrigger?.kill();
      this.st = null;
      this.section.classList.remove('is-h');
      this.#reset();
    };
  }

  #verticalLine() {
    this.vertical = true;
    this.st = null;
    const proxy = { p: 0 };
    const st = gsap.to(proxy, {
      p: 1,
      ease: 'none',
      onUpdate: () => this.#heat(proxy.p),
      scrollTrigger: {
        trigger: this.track,
        start: 'top 62%',
        end: 'bottom 62%',
        scrub: 0.4,
        invalidateOnRefresh: true,
        onRefresh: () => this.#measure(),
        onToggle: (s) => this.#setLive(s.isActive),
      },
    });
    this.#measure();
    return () => { st.scrollTrigger?.kill(); this.#reset(); };
  }

  #static() {
    this.vertical = true;
    this.st = null;
    this.#measure();
    this.#heat(1);
    return () => this.#reset();
  }

  #reset() {
    this.fill.style.transform = '';
    this.head.style.transform = '';
    gsap.set(this.track, { clearProps: 'transform' });
    this.p = 0;
    this.geo.ready = false;
    this.hot.fill(false);
    this.steps.forEach((s) => s.classList.remove('is-hot'));
    this.#setLive(false);
  }

  /** Writes only: transforms and the step classes that actually changed. */
  #heat(p) {
    this.p = p;
    if (this.vertical) {
      this.fill.style.transform = `scaleY(${p})`;
      this.head.style.transform = `translate3d(0, ${p * this.len}px, 0)`;
    } else {
      this.fill.style.transform = `scaleX(${p})`;
      this.head.style.transform = `translate3d(${p * this.len}px, 0, 0)`;
    }
    for (let i = 0; i < this.steps.length; i++) {
      const on = p >= this.stops[i] - 0.005;
      if (on === this.hot[i]) continue;
      this.hot[i] = on;
      this.steps[i].classList.toggle('is-hot', on);
    }
  }

  #setLive(on) {
    const v = on ? '1' : '0';
    if (this.section.dataset.hot !== v) this.section.dataset.hot = v;
  }
}
