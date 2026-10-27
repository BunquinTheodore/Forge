import { BaseSection, gsap, ScrollTrigger } from '../../core/BaseSection.js';
import { RiskLens } from './RiskLens.js';
import { PhaseTabs } from './PhaseTabs.js';

/**
 * CAPITAL: smart capital, risk intelligence, risk sharing, and the role of a
 * risk-intelligence partner (programme p6 + p7).
 * Entrance: headline words flip up on their x axis like struck plates; the three
 * capitals are pressed into place by scroll at different rates.
 * Signature: the risk lens (RiskLens.js). Tabs: PhaseTabs.js.
 * section.dataset.capital (0..2) tells CapitalAct which ring to heat.
 */
export default class CapitalSection extends BaseSection {
  static id = 'capital';

  init() {
    this.lens = new RiskLens(this);
    this.tabs = new PhaseTabs(this);
    this.#bindCapitals();
    if (this.reducedMotion) return;
    this.gsap(() => this.#animate());
  }

  #bindCapitals() {
    const items = this.$$('.capital__item');
    const set = (v) => {
      if (v === null) delete this.el.dataset.capital;
      else this.el.dataset.capital = v;
      items.forEach((it) => it.classList.toggle('is-on', it.dataset.capital === v));
    };
    for (const it of items) {
      const v = it.dataset.capital;
      this.listen(it, 'pointerenter', (e) => { if (e.pointerType !== 'touch') set(v); });
      this.listen(it, 'pointerleave', (e) => { if (e.pointerType !== 'touch') set(null); });
      this.listen(it, 'focus', () => set(v));
      this.listen(it, 'blur', () => set(null));
      this.listen(it, 'click', () => set(this.el.dataset.capital === v ? null : v));
    }
  }

  #animate() {
    const el = this.el;

    gsap.from(this.$$('.capital__w'), {
      rotateX: -95, yPercent: 40, opacity: 0, transformOrigin: '50% 100% -20px',
      duration: 1, ease: 'power4.out', stagger: 0.06,
      scrollTrigger: { refreshPriority: -11, trigger: this.$('.capital__head'), start: 'top 80%' },
    });

    // The three capitals are pressed in at different rates, settling together.
    this.$$('.capital__item').forEach((item, i) => {
      gsap.fromTo(item, { y: 90 + i * 70, scale: 0.94, opacity: 0 }, {
        y: 0, scale: 1, opacity: 1, ease: 'none',
        scrollTrigger: { refreshPriority: -11, trigger: this.$('.capital__three'), start: 'top 95%', end: 'top 45%', scrub: 0.5 },
      });
    });

    gsap.from(this.$('.capital__boundary'), {
      opacity: 0, y: 30, duration: 1.2, ease: 'power2.out',
      scrollTrigger: { refreshPriority: -11, trigger: this.$('.capital__boundary'), start: 'top 85%' },
    });

    gsap.from(this.$('.capital__panel'), {
      scale: 0.94, opacity: 0, duration: 1.1, ease: 'expo.out',
      scrollTrigger: { refreshPriority: -11, trigger: this.$('.capital__panel'), start: 'top 75%' },
    });

    // Rail draws itself from nothing to the current phase when the timeline arrives.
    const fill = this.$('.capital__rail-fill');
    if (fill) {
      gsap.set(fill, { scaleX: 0 });
      ScrollTrigger.create({
        refreshPriority: -11,
        trigger: this.$('.capital__phases'), start: 'top 80%', once: true,
        onEnter: () => this.tabs.fillTo(this.tabs.index, true),
      });
      gsap.from(this.$$('.capital__tab'), {
        y: 24, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12,
        scrollTrigger: { refreshPriority: -11, trigger: this.$('.capital__phases'), start: 'top 85%' },
      });
    }

    // CSS rings (no-GL background) turn with the scroll.
    this.$$('.capital__ring').forEach((ring, i) => {
      gsap.fromTo(ring, { rotate: i * 40 }, {
        rotate: i * 40 + (i % 2 ? -160 : 200), ease: 'none',
        scrollTrigger: { refreshPriority: -11, trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  }

  destroy() {
    this.lens?.destroy();
    super.destroy();
  }

  update(dt) {
    this.lens?.update(dt, this.reducedMotion);
  }
}
