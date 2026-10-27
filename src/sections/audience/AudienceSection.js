import { BaseSection, gsap } from '../../core/BaseSection.js';
import { RoleRing } from './RoleRing.js';
import { RoleMap } from './RoleMap.js';

/**
 * Who FORGE is for. Six roles on a draggable 3D ring; the selected role draws its flows on a hex map.
 * Writes data-role (active index) and data-angle (ring rotation, degrees) for AudienceAct.
 */
export default class AudienceSection extends BaseSection {
  static id = 'audience';

  init() {
    const listen = this.listen.bind(this);
    this.map = new RoleMap(this.$('.aud__map'), {
      listen,
      onPick: (i) => this.ring.go(i),
    });
    this.ring = new RoleRing(this.$('[data-ring]'), {
      listen,
      reducedMotion: this.reducedMotion,
      onChange: (i) => this.#select(i),
      onTurn: (deg) => { this.el.dataset.angle = deg.toFixed(1); },
    });
    this.#select(0);

    if (this.reducedMotion) {
      this.ring.setAssembly(1);
      this.el.classList.add('is-in');
      return;
    }
    this.gsap(() => this.#entrance());
  }

  #select(i) {
    this.el.dataset.role = String(i);
    this.map.select(i);
  }

  #entrance() {
    const proxy = { a: 0 };
    // Headline: lines rise out of their masks with a slight skew settling to zero
    gsap.from(this.$$('.aud__title .line > span'), {
      yPercent: 115, skewY: 6, duration: 1.1, ease: 'expo.out', stagger: 0.12,
      scrollTrigger: { trigger: this.$('.aud__head'), start: 'top 78%', once: true },
    });
    gsap.from(this.$$('.aud__head .label, .aud__lead'), {
      opacity: 0, x: -24, duration: 0.9, ease: 'power3.out', stagger: 0.1,
      scrollTrigger: { trigger: this.$('.aud__head'), start: 'top 75%', once: true },
    });

    // Signature entrance: the collapsed, tilted pile of plates opens into a ring as you scroll
    gsap.to(proxy, {
      a: 1, ease: 'none',
      onUpdate: () => this.ring.setAssembly(proxy.a),
      scrollTrigger: { trigger: this.$('[data-ring]'), start: 'top 95%', end: 'center 55%', scrub: 0.6 },
    });

    gsap.from(this.$('.map'), {
      opacity: 0, rotate: -30, scale: 0.85, duration: 1.4, ease: 'expo.out',
      scrollTrigger: { trigger: this.$('.aud__map'), start: 'top 80%', once: true },
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
