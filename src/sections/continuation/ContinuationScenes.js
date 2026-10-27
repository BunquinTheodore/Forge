import { gsap } from '../../core/BaseSection.js';
import { continuationState } from './continuationState.js';

const RUN = 0.7;            // share of the pinned timeline spent running the 90-day ruler
const PIN_SCREENS = 3.4;    // pinned scroll length in viewport heights
const HEAT_STEP = 0.004;

/**
 * Scroll scenes for the continuation section.
 * film: pinned desktop stage, the ruler runs 0 to 90, then OVERGROUND rises from it.
 * flow: mobile / short screens, vertical ruler alongside the stacked milestones.
 */
export class ContinuationScenes {
  constructor(section, clock) {
    this.section = section;
    this.el = section.el;
    this.clock = clock;
    this.trigger = null;
    this.mode = 'static';
    this.heat = -1;
    this.stops = [0, 1 / 3, 2 / 3, 1];
    this.letters = Array.from(this.el.querySelectorAll('[data-og] span'));
  }

  setHeat(v) {
    if (Math.abs(v - this.heat) < HEAT_STEP) return;
    this.heat = v;
    continuationState.heat = v;
  }

  #titleIntro() {
    const lines = this.el.querySelectorAll('.cont__title .line > span');
    gsap.from(lines, {
      yPercent: 115, rotate: 3, duration: 1.1, ease: 'expo.out', stagger: 0.1,
      scrollTrigger: { trigger: this.el, start: 'top 75%', toggleActions: 'play none none reverse' },
    });
  }

  buildFilm() {
    this.mode = 'film';
    this.el.classList.add('is-film');
    this.clock.setAxis('x');
    this.clock.set(0);
    this.#titleIntro();

    const $ = (s) => this.el.querySelector(s);
    const proxy = { p: 0 };
    gsap.from($('.cont__ruler'), {
      scaleX: 0, transformOrigin: '0 50%', duration: 1.4, ease: 'expo.inOut',
      scrollTrigger: { trigger: this.el, start: 'top 60%', toggleActions: 'play none none reverse' },
    });

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: $('.cont__stage'),
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * PIN_SCREENS)}`,
        pin: true,
        scrub: 0.7,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (st) => this.setHeat(st.progress),
      },
    });
    this.trigger = tl.scrollTrigger;
    continuationState.mode = 'film';
    continuationState.trigger = this.trigger;
    tl.to(proxy, { p: 1, duration: RUN, onUpdate: () => this.clock.set(proxy.p) }, 0)
      .to($('.cont__head'), { yPercent: -30, autoAlpha: 0, duration: 0.1, ease: 'power2.in' }, RUN + 0.02)
      .to($('.cont__counter'), { yPercent: -40, autoAlpha: 0, duration: 0.08, ease: 'power2.in' }, RUN + 0.01)
      .to($('.cont__ms'), { y: 40, autoAlpha: 0, duration: 0.1, ease: 'power2.in' }, RUN + 0.02)
      .fromTo(this.letters, { yPercent: 112 }, { yPercent: 0, duration: 0.14, stagger: 0.012, ease: 'power3.out' }, RUN + 0.05)
      .fromTo($('.cont__outro'), { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.1, ease: 'power2.out' }, RUN + 0.14)
      .to({}, { duration: 0.06 });

    return () => {
      this.el.classList.remove('is-film');
      this.trigger = null;
      this.mode = 'static';
      continuationState.mode = 'static';
      continuationState.trigger = null;
    };
  }

  buildFlow() {
    this.mode = 'flow';
    continuationState.mode = 'flow';
    this.clock.setAxis('y');
    this.clock.set(0);
    this.#titleIntro();
    const list = this.el.querySelector('.cont__ms');
    const proxy = { q: 0 };

    gsap.to(proxy, {
      q: 1, ease: 'none',
      scrollTrigger: {
        trigger: list, start: 'top 70%', end: 'bottom 70%', scrub: 0.4,
        invalidateOnRefresh: true,
        onRefresh: () => this.#measureStops(list),
      },
      onUpdate: () => {
        this.clock.set(proxy.q, this.#dayAt(proxy.q));
        this.setHeat(proxy.q * 0.6);
      },
    });

    gsap.fromTo(this.letters, { yPercent: 112 }, {
      yPercent: 0, ease: 'power3.out', stagger: 0.04,
      scrollTrigger: {
        trigger: this.el.querySelector('.cont__og'), start: 'top 88%', end: 'top 50%', scrub: 0.5,
        onUpdate: (st) => this.setHeat(0.6 + st.progress * 0.4),
      },
    });
    gsap.from(this.el.querySelectorAll('.cont__outro > *'), {
      y: 30, autoAlpha: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out',
      scrollTrigger: { trigger: this.el.querySelector('.cont__outro'), start: 'top 85%', toggleActions: 'play none none reverse' },
    });

    return () => {
      this.mode = 'static';
      continuationState.mode = 'static';
    };
  }

  #measureStops(list) {
    const top = list.getBoundingClientRect().top;
    const h = list.offsetHeight || 1;
    this.stops = this.clock.items.map((li) => (li.getBoundingClientRect().top - top) / h);
  }

  /** Piecewise map of flow progress to day so each card lights as it reaches the line. */
  #dayAt(q) {
    const s = this.stops;
    const d = this.clock.days;
    if (q <= s[0]) return d[0];
    for (let i = 1; i < s.length; i += 1) {
      if (q <= s[i]) {
        const t = (q - s[i - 1]) / Math.max(1e-4, s[i] - s[i - 1]);
        return d[i - 1] + (d[i] - d[i - 1]) * t;
      }
    }
    return this.clock.totalDays;
  }

  /** Scroll position that shows milestone i lit, or null when the page should scroll to the card. */
  jumpTarget(i) {
    if (this.mode !== 'film' || !this.trigger) return null;
    const st = this.trigger;
    const p = (this.clock.days[i] / this.clock.totalDays) * RUN + 0.01;
    return st.start + (st.end - st.start) * Math.min(p, RUN);
  }
}
