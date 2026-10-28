import { BaseSection, gsap } from '../../core/BaseSection.js';
import { PromiseFinale } from './PromiseFinale.js';

/**
 * The ask + the public promise + final CTA.
 * Entrance: a molten heat bar sweeps across each need and leaves the text forged behind it.
 * Finale: pinned promise (desktop) over the AskAct forge core; CSS glow fallback without GL.
 */
export default class AskSection extends BaseSection {
  static id = 'ask';

  /**
   * Sections are created in module (alphabetical) order, not page order. ScrollTriggers lower on the
   * page must refresh after the pins above them, so priority follows DOM order.
   */
  get prio() {
    return -Array.from(document.querySelectorAll('[data-section]')).indexOf(this.el);
  }

  init() {
    if (this.reducedMotion) return;

    this.gsap(() => {
      this.#head();
      this.#needs();
      this.#offer();
      this.finale = new PromiseFinale(this);
      this.finale.init();
    });
  }

  #head() {
    const head = this.$('.ask__head');
    gsap.from(this.$('.ask__title'), {
      xPercent: -6, opacity: 0, duration: 1.3, ease: 'expo.out',
      scrollTrigger: { refreshPriority: this.prio, trigger: head, start: 'top 80%', once: true },
    });
    gsap.from(this.$('.ask__lead'), {
      opacity: 0, y: 16, duration: 1, delay: 0.25, ease: 'power3.out',
      scrollTrigger: { refreshPriority: this.prio, trigger: head, start: 'top 80%', once: true },
    });
  }

  /** Heat pass: the bar sweeps in from the left, the line is revealed, the bar exits right. */
  #needs() {
    const items = this.$$('.ask__need');
    const tl = gsap.timeline({
      scrollTrigger: { refreshPriority: this.prio, trigger: this.$('.ask__needs'), start: 'top 78%', once: true },
    });
    items.forEach((li, i) => {
      const heat = li.querySelector('.ask__heat');
      const text = li.querySelector('.ask__need-t');
      const at = i * 0.14;
      tl.fromTo(heat, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.45, ease: 'power3.in' }, at)
        .set(heat, { transformOrigin: '100% 50%' }, at + 0.45)
        .fromTo(text, { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.6, ease: 'expo.out' }, at + 0.42)
        .to(heat, { scaleX: 0, duration: 0.55, ease: 'power3.out' }, at + 0.45);
    });
  }

  #offer() {
    gsap.from(this.$$('.ask__offer-copy, .ask__offer .ask__send'), {
      opacity: 0, y: 24, duration: 0.9, ease: 'power3.out', stagger: 0.1,
      scrollTrigger: { refreshPriority: this.prio, trigger: this.$('.ask__offer'), start: 'top 82%', once: true },
    });
  }
}
