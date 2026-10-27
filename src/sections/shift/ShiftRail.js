import { gsap, ScrollTrigger } from '../../core/BaseSection.js';

const DESKTOP = '(min-width: 900px) and (prefers-reduced-motion: no-preference)';
const MOBILE = '(max-width: 899px) and (prefers-reduced-motion: no-preference)';
const PIN_LENGTH = '+=170%';

/**
 * The forged rail: four stages light up one by one as an ember runs along it.
 * Desktop: the header and rail pin while the scroll drives the runner.
 * Mobile: no pin, a vertical rail fills and each stage ignites as it reaches the reading line.
 * Must be constructed inside the section's gsap context so it reverts on destroy.
 */
export class ShiftRail {
  constructor(root) {
    this.root = root;
    this.pin = root.querySelector('.shift__pin');
    this.rail = root.querySelector('.shift__rail');
    this.fill = root.querySelector('.shift__fill');
    this.runner = root.querySelector('.shift__runner');
    this.stages = Array.from(root.querySelectorAll('.shift__stage'));
    this.lit = -1;
    this.mm = gsap.matchMedia();
    this.mm.add(DESKTOP, () => this.#desktop());
    this.mm.add(MOBILE, () => this.#mobile());
  }

  /** Light stages [0..count-1]; only touches the DOM when the count changes. */
  #light(count) {
    if (count === this.lit) return;
    this.lit = count;
    this.stages.forEach((s, i) => s.classList.toggle('is-lit', i < count));
  }

  #reset() {
    this.rail.classList.remove('is-stepped');
    this.stages.forEach((s) => s.classList.remove('is-lit'));
    this.lit = -1;
  }

  #desktop() {
    this.rail.classList.add('is-stepped');
    const n = this.stages.length;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      // Driven by the smoothed timeline progress so lighting stays in sync with the runner.
      // The track spans node centres, so the fill reaches stage i at progress i / (n - 1).
      onUpdate: () => {
        const p = tl.progress();
        this.#light(p < 0.02 ? 0 : Math.min(n, Math.floor(p * (n - 1) + 1.04)));
      },
      scrollTrigger: {
        trigger: this.pin,
        start: 'top top',
        end: PIN_LENGTH,
        pin: true,
        anticipatePin: 1,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });
    tl.fromTo(this.fill, { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0)
      .fromTo(this.runner, { xPercent: 0 }, { xPercent: 100, duration: 1 }, 0);
    this.#light(0);
    return () => this.#reset();
  }

  #mobile() {
    this.rail.classList.add('is-stepped');
    gsap.fromTo(this.fill, { scaleY: 0 }, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: this.rail, start: 'top 72%', end: 'bottom 60%', scrub: 0.4 },
    });
    this.stages.forEach((stage, i) => {
      ScrollTrigger.create({
        trigger: stage,
        start: 'top 72%',
        onEnter: () => this.#light(Math.max(this.lit, i + 1)),
        onLeaveBack: () => this.#light(i),
      });
    });
    this.#light(0);
    return () => this.#reset();
  }

  destroy() {
    this.mm.revert();
  }
}
