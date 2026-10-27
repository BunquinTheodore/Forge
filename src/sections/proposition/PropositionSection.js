import { BaseSection, gsap } from '../../core/BaseSection.js';
import { PrepStepper } from './PrepStepper.js';

/**
 * PROPOSITION: what FORGE brings to the market. A cream programme sheet.
 * Entrance: the sheet wipes up over the dark page (clip-path) with a 3D tilt that settles flat.
 * Background: the navy edge band's ember strip fills as the reader moves down the sheet.
 * Signature: the "FORGE starts before October 29" stepper (PrepStepper).
 */
export default class PropositionSection extends BaseSection {
  static id = 'proposition';

  init() {
    this.stepper = new PrepStepper(this.$('.prop__stepper'), (t, type, fn, opts) => this.listen(t, type, fn, opts));
    if (this.reducedMotion) return;
    this.gsap(() => {
      this.#sheet();
      this.#edge();
      this.#header();
      this.#pillars();
      this.#claim();
    });
  }

  /**
   * Toggle trigger for content inside the tilted sheet. The sheet carries a scrubbed y/rotateX
   * entrance transform, so measuring its children directly would skew the start. Instead the
   * trigger is the untransformed section, offset by the node's layout position (offsetTop ignores
   * transforms), recomputed on every refresh.
   */
  #toggle(node, viewport) {
    return {
      trigger: this.el,
      start: () => `top+=${PropositionSection.#pageTop(node) - PropositionSection.#pageTop(this.el)} ${viewport}`,
      invalidateOnRefresh: true,
      toggleActions: 'play none none reverse',
    };
  }

  static #pageTop(node) {
    let y = 0;
    for (let n = node; n; n = n.offsetParent) y += n.offsetTop;
    return y;
  }

  #sheet() {
    gsap.fromTo(this.$('.prop__sheet'), {
      clipPath: 'inset(16% 5% 0% 5% round 40px)',
      rotateX: 11,
      y: 140,
      transformPerspective: 1600,
    }, {
      clipPath: 'inset(0% 0% 0% 0% round 0px)',
      rotateX: 0,
      y: 0,
      ease: 'none',
      scrollTrigger: { trigger: this.el, start: 'top bottom', end: 'top 12%', scrub: 0.7 },
    });
  }

  #edge() {
    gsap.fromTo(this.$('.prop__edge-fill'), { scaleY: 0 }, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: this.el, start: 'top 40%', end: 'bottom bottom', scrub: true },
    });
  }

  #header() {
    const tl = gsap.timeline({
      scrollTrigger: this.#toggle(this.$('.prop__head'), '78%'),
    });
    tl.fromTo(this.$('.prop__head .prop__label'), { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' })
      .fromTo(this.$('.prop__title'), { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 0.05)
      .fromTo(this.$('.prop__rule'), { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: 'power3.inOut' }, 0.2)
      .fromTo(this.$('.prop__intro'), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 0.35);
  }

  /** Each stripe is drawn first, like ink down a margin, then its card content settles. */
  #pillars() {
    const pillars = this.$$('.prop__pillar');
    const tl = gsap.timeline({
      scrollTrigger: this.#toggle(this.$('.prop__pillars'), '80%'),
    });
    pillars.forEach((p, i) => {
      const at = i * 0.16;
      tl.fromTo(p, { opacity: 0, y: 48, rotateX: -8, transformPerspective: 900 }, { opacity: 1, y: 0, rotateX: 0, duration: 0.9, ease: 'power3.out' }, at)
        .fromTo(p.querySelector('.prop__stripe'), { scaleY: 0 }, { scaleY: 1, duration: 0.7, ease: 'power2.inOut' }, at + 0.1);
    });
  }

  /** "another pitch day" is struck out, then the real purpose resolves. */
  #claim() {
    const tl = gsap.timeline({
      scrollTrigger: this.#toggle(this.$('.prop__claim'), '75%'),
    });
    tl.fromTo(this.$('.prop__claim'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' })
      .fromTo(this.$('.prop__strike-text'), { opacity: 1 }, { opacity: 0.55, duration: 0.5 }, 0.75)
      .fromTo(this.$('.prop__strike-line'), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power3.inOut' }, 0.6)
      .fromTo(this.$('.prop__claim-b'), { opacity: 0, x: -18 }, { opacity: 1, x: 0, duration: 0.7, ease: 'power2.out' }, 1.15);
  }
}
