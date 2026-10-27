import { gsap } from '../../core/BaseSection.js';

/**
 * Before / In the room / After as an accessible tab timeline.
 * The ember rail fills to the selected phase; the panel copy slides in from the
 * direction of travel. WAI-ARIA tabs keyboard model (arrows, Home, End).
 */
export class PhaseTabs {
  constructor(section) {
    this.section = section;
    this.tabs = section.$$('.capital__tab');
    this.panels = section.$$('.capital__phase');
    this.fill = section.$('.capital__rail-fill');
    this.reduced = section.reducedMotion;
    this.index = 0;
    if (!this.tabs.length) return;
    this.tabs.forEach((tab, i) => {
      section.listen(tab, 'click', () => this.select(i));
    });
    section.listen(section.$('.capital__tabs'), 'keydown', (e) => this.#onKey(e), { passive: false });
    this.#paint(0, false);
  }

  #onKey(e) {
    const last = this.tabs.length - 1;
    const map = { ArrowRight: this.index + 1, ArrowLeft: this.index - 1, Home: 0, End: last };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = (map[e.key] + this.tabs.length) % this.tabs.length;
    this.select(next);
    this.tabs[next].focus();
  }

  select(i) {
    if (i === this.index) return;
    const dir = Math.sign(i - this.index);
    this.index = i;
    this.#paint(dir, !this.reduced);
  }

  /** Fill the rail to the centre of the current phase tab (used by the entrance too). */
  fillTo(i, animate) {
    if (!this.fill) return;
    const scale = (i + 0.5) / this.tabs.length;
    if (animate) gsap.to(this.fill, { scaleX: scale, duration: 0.9, ease: 'expo.out', overwrite: true });
    else gsap.set(this.fill, { scaleX: scale });
  }

  #paint(dir, animate) {
    this.tabs.forEach((tab, i) => {
      const on = i === this.index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      tab.classList.toggle('is-past', i < this.index);
    });
    this.panels.forEach((p, i) => { p.hidden = i !== this.index; });
    this.fillTo(this.index, animate);
    const panel = this.panels[this.index];
    if (animate && panel) {
      gsap.fromTo(panel, { x: dir * 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out', overwrite: true });
    }
  }
}
