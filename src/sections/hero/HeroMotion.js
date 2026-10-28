import { gsap, ScrollTrigger } from '../../core/BaseSection.js';

const STICKY_QUERY = '(min-width: 600px) and (min-height: 620px)';

/**
 * Hero choreography.
 * Entrance (on app 'ready'): a hammer strike. Each letter drops in white-hot, squashes on impact
 * and cools to steel. The h1 keeps opacity 1 throughout (LCP): only transforms, clip and a CSS heat var.
 * Exit (scroll, sticky stage): letters spread apart like metal being drawn, the rest lifts away.
 */
export class HeroMotion {
  constructor(section) {
    this.section = section;
    this.el = section.el;
    this.letters = section.$$('.hero__l');
    this.ph = section.$('.hero__ph');
    this.sub = section.$('.hero__sub');
    this.mark = section.$('.hero__mark');
    this.supporting = [
      section.$('.hero__presents'),
      ...section.$$('.hero__pillars li'),
      ...section.$$('.hero__tag-line'),
      section.$('.hero__strip'),
      section.$('.hero__count'),
      section.$('.hero__ctas'),
    ].filter(Boolean);
  }

  /** Pre-intro pose, applied while the splash still covers the page. Letters stay visible. */
  prime() {
    gsap.set(this.letters, { yPercent: -38, scaleY: 1.16, transformOrigin: '50% 100%', '--hot': 1 });
    gsap.set(this.ph, { scale: 0, rotation: -24, transformOrigin: '0% 100%' });
    gsap.set(this.sub, { clipPath: 'inset(0% 100% 0% 0%)' });
    gsap.set(this.supporting, { autoAlpha: 0, y: 18 });
  }

  /** Hammer strike entrance. Returns the timeline. */
  intro(onDone) {
    this.mark.classList.add('is-forging');
    const tl = gsap.timeline({
      onComplete: () => {
        this.mark.classList.remove('is-forging');
        onDone?.();
      },
    });
    this.letters.forEach((l, i) => {
      const at = i * 0.075;
      tl.to(l, { yPercent: 0, scaleY: 1, duration: 0.42, ease: 'power4.in' }, at)
        .to(l, { scaleY: 0.86, scaleX: 1.07, duration: 0.07, ease: 'power1.out' }, at + 0.42)
        .to(l, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'elastic.out(1, 0.45)' }, at + 0.49)
        .to(l, { '--hot': 0, duration: 1.3, ease: 'power2.out' }, at + 0.42);
    });
    const impact = 0.42 + (this.letters.length - 1) * 0.075;
    tl.to(this.ph, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2.2)' }, impact)
      .to(this.sub, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.out' }, impact - 0.1)
      .to(this.supporting, {
        autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06, clearProps: 'transform,visibility',
      }, impact + 0.05);
    return tl;
  }

  /** Final state without motion (reduced motion). */
  settle() {
    gsap.set(this.letters, { clearProps: 'transform', '--hot': 0 });
    gsap.set([this.ph, this.sub, ...this.supporting], { clearProps: 'all' });
  }

  /** Scroll scrubbed exit inside the sticky stage. Only where the stage is sticky. */
  scrollOut() {
    const mm = gsap.matchMedia();
    mm.add(STICKY_QUERY, () => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: this.el, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
      });
      const mid = (this.letters.length - 1) / 2;
      this.letters.forEach((l, i) => {
        tl.to(l, { xPercent: (i - mid) * 34, yPercent: (i % 2 ? -6 : 6), duration: 1 }, 0);
      });
      tl.to(this.mark, { scale: 1.08, yPercent: -8, duration: 1 }, 0)
        .to(this.ph, { xPercent: 120, yPercent: -40, duration: 1 }, 0)
        .to(this.section.$('.hero__sub'), { yPercent: -60, autoAlpha: 0, duration: 0.55 }, 0.3)
        .to(this.section.$$('.hero__pillars, .hero__presents'), { y: -40, autoAlpha: 0, duration: 0.5, stagger: 0.05 }, 0.25)
        .to(this.section.$('.hero__tag'), { y: -60, autoAlpha: 0, duration: 0.5, stagger: 0.08 }, 0.4)
        .to(this.section.$('.hero__base'), { y: 40, autoAlpha: 0, duration: 0.45 }, 0.5);
    });
    this.mm = mm;
    ScrollTrigger.refresh();
  }

  /**
   * Fallback ribbon parallax (no GL only): scroll drift on the image.
   * Returns { kill }; kill() reverts the tween and its ScrollTrigger.
   */
  fallbackParallax(img) {
    if (!img) return null;
    const drift = gsap.to(img, {
      yPercent: -14, scale: 1.08, ease: 'none',
      scrollTrigger: { trigger: this.el, start: 'top top', end: 'bottom top', scrub: true },
    });
    const kill = () => {
      drift.scrollTrigger?.kill();
      drift.kill();
      gsap.set(img, { clearProps: 'transform' });
    };
    return { kill };
  }

  destroy() { this.mm?.revert(); }
}
