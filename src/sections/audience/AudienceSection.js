import { BaseSection, gsap, ScrollTrigger } from '../../core/BaseSection.js';

const STEP = 60;   // degrees the GL constellation turns per role

/**
 * Who FORGE is for. Six static role cards; scrolling through them highlights each in turn.
 * Writes data-role (highlighted index) and data-angle (constellation rotation, degrees) for AudienceAct.
 */
export default class AudienceSection extends BaseSection {
  static id = 'audience';

  init() {
    this.cards = this.$$('.role');
    this.index = -1;
    this.#highlight(0);

    if (this.reducedMotion) {
      this.el.classList.add('is-in');
      return;
    }
    this.gsap(() => this.#entrance());
  }

  #highlight(i) {
    if (i === this.index) return;
    this.index = i;
    this.el.dataset.role = String(i);
    this.cards.forEach((card, k) => card.classList.toggle('is-active', k === i));
  }

  #entrance() {
    const n = this.cards.length;
    const grid = this.$('.aud__roles');

    // Headline: lines rise out of their masks with a slight skew settling to zero
    gsap.from(this.$$('.aud__title .line > span'), {
      yPercent: 115, skewY: 6, duration: 1.1, ease: 'expo.out', stagger: 0.12,
      scrollTrigger: { trigger: this.$('.aud__head'), start: 'top 78%', once: true },
    });
    gsap.from(this.$$('.aud__head .label, .aud__lead'), {
      opacity: 0, x: -24, duration: 0.9, ease: 'power3.out', stagger: 0.1,
      scrollTrigger: { trigger: this.$('.aud__head'), start: 'top 75%', once: true },
    });

    gsap.from(this.cards, {
      opacity: 0, y: 40, duration: 1, ease: 'power3.out', stagger: 0.08,
      scrollTrigger: { trigger: grid, start: 'top 82%', once: true },
    });

    // Scroll walks the highlight across the roles and turns the GL constellation with it
    ScrollTrigger.create({
      trigger: grid, start: 'top 70%', end: 'bottom 40%',
      onUpdate: (st) => {
        this.el.dataset.angle = (-st.progress * (n - 1) * STEP).toFixed(1);
        this.#highlight(Math.min(n - 1, Math.floor(st.progress * n)));
      },
    });

    gsap.from(this.$('.aud__rule'), {
      opacity: 0, y: 18, duration: 1.2, ease: 'power2.out',
      scrollTrigger: { trigger: this.$('.aud__rule'), start: 'top 90%', once: true },
    });

    // Background ember glow drifts and swells through the section (CSS fallback for the GL act)
    gsap.fromTo(this.$('.aud__glow'), { yPercent: -20, scale: 0.8 }, {
      yPercent: 30, scale: 1.15, ease: 'none',
      scrollTrigger: { trigger: this.el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }
}
