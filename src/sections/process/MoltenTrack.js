import { gsap } from '../../core/BaseSection.js';

const DESKTOP = '(min-width: 768px) and (prefers-reduced-motion: no-preference)';
const MOBILE = '(max-width: 767px) and (prefers-reduced-motion: no-preference)';
const REDUCED = '(prefers-reduced-motion: reduce)';

/**
 * The six-step track with a molten line that heats each step as it passes.
 * Desktop: pinned horizontal scroll. Narrow screens: vertical stack with a vertical line.
 * Publishes the line head (viewport fractions) on the section dataset for ProcessAct.
 */
export class MoltenTrack {
  constructor(section) {
    this.section = section;
    this.pin = section.querySelector('[data-pin]');
    this.track = section.querySelector('[data-track]');
    this.fill = section.querySelector('[data-molten-fill]');
    this.head = section.querySelector('[data-molten-head]');
    this.steps = Array.from(section.querySelectorAll('.step'));
    this.stops = this.steps.map(() => 0);
    this.hot = this.steps.map(() => false);
    this.vertical = true;
    this.len = 0;
  }

  /** Call inside the section's gsap context. */
  build() {
    const mm = gsap.matchMedia();
    mm.add(DESKTOP, () => this.#horizontal());
    mm.add(MOBILE, () => this.#verticalLine());
    mm.add(REDUCED, () => this.#static());
  }

  /** Step centres as fractions of the line length, measured along the active axis. */
  #measure() {
    const tr = this.track.getBoundingClientRect();
    const len = this.vertical ? tr.height : tr.width;
    this.len = len;
    this.steps.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const c = this.vertical ? r.top - tr.top + 24 : r.left - tr.left + 12;
      this.stops[i] = len > 0 ? c / len : 0;
    });
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
    this.#measure();
    return () => {
      tween.scrollTrigger?.kill();
      this.section.classList.remove('is-h');
      this.#reset();
    };
  }

  #verticalLine() {
    this.vertical = true;
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
    this.#measure();
    this.#heat(1);
    return () => this.#reset();
  }

  #reset() {
    this.fill.style.transform = '';
    this.head.style.transform = '';
    gsap.set(this.track, { clearProps: 'transform' });
    this.hot.fill(false);
    this.steps.forEach((s) => s.classList.remove('is-hot'));
    this.#setLive(false);
  }

  #heat(p) {
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
    this.#publishHead();
  }

  #publishHead() {
    const r = this.head.getBoundingClientRect();
    const ds = this.section.dataset;
    ds.hx = ((r.left + r.width / 2) / window.innerWidth).toFixed(4);
    ds.hy = ((r.top + r.height / 2) / window.innerHeight).toFixed(4);
    ds.dir = this.vertical ? 'v' : 'h';
  }

  #setLive(on) {
    this.section.dataset.hot = on ? '1' : '0';
  }
}
