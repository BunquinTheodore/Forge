import { pageHeat } from './heat.js';

const HIDE_AFTER = 160;   // px scrolled before the bar is allowed to tuck away
const SCROLLED_AT = 24;   // px scrolled before the bar gets its backdrop
const DELTA = 6;          // px of travel needed to flip direction
const DUST_LOOP = 480;    // px period of the fallback dust parallax

/**
 * Fixed header behaviour: hide on scroll down, show on scroll up, the ember
 * progress bar, the CSS ambient fallback and the cream "paper" theme switch.
 */
export class Header {
  constructor(section) {
    this.section = section;
    this.root = section.el;
    this.bar = section.$('.chrome__bar');
    this.fill = section.$('.chrome__progress-fill');
    this.hot = section.$('.chrome__amb--hot');
    this.dust = section.$('.chrome__dust');
    this.lastY = window.scrollY;
    this.hidden = false;
    this.locked = false;
    this.observers = [];

    this.unsubscribe = section.scroll.onScroll((s) => this.#onScroll(s.y, s.progress));
    section.listen(this.bar, 'focusin', () => this.#setHidden(false));
    this.#observePaper();
    this.#onScroll(window.scrollY, this.#nativeProgress());
  }

  #nativeProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? window.scrollY / max : 0;
  }

  lock(on) {
    this.locked = on;
    if (on) this.#setHidden(false);
  }

  #onScroll(y, progress) {
    const p = Math.min(1, Math.max(0, progress || 0));
    this.fill.style.transform = `scaleX(${p.toFixed(4)})`;
    this.hot.style.opacity = pageHeat(p).toFixed(3);
    this.dust.style.transform = `translate3d(0, ${(-(y * 0.18) % DUST_LOOP).toFixed(1)}px, 0)`;
    this.root.classList.toggle('is-scrolled', y > SCROLLED_AT);

    const dy = y - this.lastY;
    if (Math.abs(dy) < DELTA) return;
    this.lastY = y;
    if (this.locked || y < HIDE_AFTER) this.#setHidden(false);
    else this.#setHidden(dy > 0 && !this.bar.contains(document.activeElement));
  }

  #setHidden(hidden) {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    this.bar.classList.toggle('is-hidden', hidden);
  }

  /** Switch header and rail ink colours while a cream section sits beneath them. */
  #observePaper() {
    const papers = document.querySelectorAll('.sec--paper');
    if (!papers.length || !('IntersectionObserver' in window)) return;
    this.#watch(papers, '0px 0px -93% 0px', 'is-paper-top');
    this.#watch(papers, '-48% 0px -51% 0px', 'is-paper-mid');
  }

  #watch(targets, rootMargin, className) {
    const active = new Set();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) active.add(e.target);
        else active.delete(e.target);
      }
      this.root.classList.toggle(className, active.size > 0);
    }, { rootMargin });
    targets.forEach((t) => io.observe(t));
    this.observers.push(io);
  }

  destroy() {
    this.unsubscribe?.();
    this.observers.forEach((io) => io.disconnect());
  }
}
