import { BaseSection, gsap } from '../../core/BaseSection.js';
import { RoleLedger } from './RoleLedger.js';
import { PrincipleMarquee } from './PrincipleMarquee.js';

/**
 * Trust and governance. Cream paper ledger.
 * Entrance: ruled lines draw across like a ledger being written, then each entry rises out of its line.
 * Signature: role rows expand into "Does" / "Does not". Principles run as a pausable marquee.
 * Background: the paper ruling drifts with scroll and the ember margin rule grows down the page.
 */
export default class TrustSection extends BaseSection {
  static id = 'trust';

  /**
   * Sections are created in module (alphabetical) order, not page order. ScrollTriggers lower on the
   * page must refresh after the pins above them, so priority follows DOM order.
   */
  get prio() {
    return -Array.from(document.querySelectorAll('[data-section]')).indexOf(this.el);
  }

  init() {
    this.ledger = new RoleLedger(this, this.$$('[data-role]'));
    this.ledger.init();
    this.marquee = new PrincipleMarquee(this, this.$('.trust__marquee'));
    this.marquee.init();

    if (this.reducedMotion) return;
    this.gsap(() => {
      this.#paper();
      this.#title();
      this.#ledgerEntrance();
      this.#principles();
    });
  }

  #paper() {
    const trigger = { refreshPriority: this.prio, trigger: this.el, start: 'top bottom', end: 'bottom top', scrub: true };
    gsap.fromTo(this.$('.trust__ruling'), { yPercent: 0 }, { yPercent: -12, ease: 'none', scrollTrigger: trigger });
    gsap.fromTo(this.$('.trust__margin'), { scaleY: 0 }, {
      scaleY: 1, ease: 'none',
      scrollTrigger: { refreshPriority: this.prio, trigger: this.el, start: 'top 70%', end: 'bottom 80%', scrub: true },
    });
  }

  #title() {
    gsap.from(this.$$('.trust__title .line > span'), {
      yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.12,
      scrollTrigger: { refreshPriority: this.prio, trigger: this.$('.trust__head'), start: 'top 80%', once: true },
    });
    gsap.from(this.$$('.trust__label, .trust__hint'), {
      opacity: 0, duration: 0.8, ease: 'power2.out', stagger: 0.2,
      scrollTrigger: { refreshPriority: this.prio, trigger: this.$('.trust__head'), start: 'top 80%', once: true },
    });
  }

  /** Each ruled line is drawn with a pen stroke, then the entry is written onto it. */
  #ledgerEntrance() {
    const rows = this.$$('.trust__row');
    const tl = gsap.timeline({
      scrollTrigger: { refreshPriority: this.prio, trigger: this.$('.trust__ledger'), start: 'top 78%', once: true },
      defaults: { ease: 'expo.out' },
    });
    tl.from(this.$('.trust__cols'), { opacity: 0, duration: 0.6 }, 0);
    rows.forEach((row, i) => {
      const at = i * 0.16;
      tl.from(row.querySelector('.trust__rule'), { scaleX: 0, duration: 1.1, ease: 'power3.inOut' }, at)
        .from(row.querySelectorAll('.trust__clip > span'), { yPercent: 105, duration: 0.9, stagger: 0.08 }, at + 0.35)
        .from(row.querySelector('.trust__icon'), { scale: 0, rotate: -90, duration: 0.7 }, at + 0.5);
    });
    tl.from(this.$('.trust__rule--end'), { scaleX: 0, duration: 1.1, ease: 'power3.inOut' }, rows.length * 0.16);
  }

  #principles() {
    gsap.from(this.$('.trust__marquee'), {
      opacity: 0, x: 80, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { refreshPriority: this.prio, trigger: this.$('.trust__principles'), start: 'top 88%', once: true },
    });
  }

  onEnter() { this.marquee?.setVisible(true); }
  onLeave() { this.marquee?.setVisible(false); }
}
