import { gsap } from '../../core/BaseSection.js';

const TOTAL_DAYS = 90;

/**
 * Renders the 90-day state: counter digits, molten fill, spark head,
 * lit milestones and ticks. Writes to the DOM only when a value changes.
 */
export class DayClock {
  constructor(root) {
    this.root = root;
    this.counter = root.querySelector('[data-counter]');
    this.mini = root.querySelector('[data-counter-mini]');
    this.fill = root.querySelector('[data-fill]');
    this.head = root.querySelector('[data-head]');
    this.items = Array.from(root.querySelectorAll('.ms'));
    this.ticks = Array.from(root.querySelectorAll('.cont__tick'));
    this.days = this.items.map((li) => Number(li.dataset.day));
    this.lit = this.items.map(() => false);
    this.day = -1;
    this.active = -1;
    this.picked = -1;
    this.axis = 'x';
    this.#bindSetters();
  }

  get totalDays() { return TOTAL_DAYS; }

  /** 'x' = horizontal film ruler, 'y' = vertical flow ruler. */
  setAxis(axis) {
    this.axis = axis;
    gsap.set(this.fill, { clearProps: 'transform' });
    gsap.set(this.head, { clearProps: 'transform' });
    this.#bindSetters();
    this.day = -1;
  }

  #bindSetters() {
    const vertical = this.axis === 'y';
    this.setFill = gsap.quickSetter(this.fill, vertical ? 'scaleY' : 'scaleX');
    this.setHead = gsap.quickSetter(this.head, vertical ? 'yPercent' : 'xPercent');
  }

  /** p: 0..1 position along the ruler (ruler distance), day derived from dayAt. */
  set(p, day = p * TOTAL_DAYS) {
    this.setFill(p);
    this.setHead(p * 100);
    const d = Math.round(Math.min(TOTAL_DAYS, Math.max(0, day)));
    if (d === this.day) return;
    this.day = d;
    const txt = d < 10 ? `0${d}` : String(d);
    this.counter.textContent = txt;
    if (this.mini) this.mini.textContent = `D+${d}`;
    this.#updateLit(d);
  }

  #updateLit(d) {
    let last = -1;
    for (let i = 0; i < this.items.length; i += 1) {
      const on = d >= this.days[i];
      if (on) last = i;
      if (on === this.lit[i]) continue;
      this.lit[i] = on;
      this.items[i].classList.toggle('is-lit', on);
      this.ticks[i]?.classList.toggle('is-lit', on);
    }
    if (last !== this.active) {
      this.active = last;
      this.picked = -1;
      this.#markCurrent();
    }
  }

  pick(i) {
    this.picked = i;
    this.#markCurrent();
  }

  #markCurrent() {
    const cur = this.picked >= 0 ? this.picked : this.active;
    this.items.forEach((li, i) => {
      if (i === cur) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
  }

  /** Static final state (reduced motion / no scroll film). */
  complete() {
    this.set(1);
  }
}
