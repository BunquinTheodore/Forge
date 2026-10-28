import { gsap } from '../../core/BaseSection.js';

const DESKTOP = '(min-width: 768px) and (min-height: 520px)';
const MOBILE = '(max-width: 767px), (max-height: 519px)';
const HOLD = 0.6;   // timeline units each vow holds the stage

/**
 * The Public Promise as a cinematic finale.
 * Desktop: the stage pins and the vows take the screen one at a time, each rising out of
 * darkness and settling, while a meter counts the vows.
 * Mobile / short screens: no pin, vows stack and ignite one by one as they scroll in.
 * Then the coda: closing statement and CTA, with an ember glow that heats up.
 */
export class PromiseFinale {
  constructor(section) {
    this.section = section;
    this.el = section.el;
    this.promise = section.$('.ask__promise');
    this.vows = section.$$('.ask__vow');
    this.meterN = section.$('.ask__meter-n');
    this.meterBar = section.$('.ask__meter-bar i');
  }

  init() {
    const mm = gsap.matchMedia();
    mm.add(DESKTOP, () => this.#pinned());
    mm.add(MOBILE, () => this.#stacked());
    this.#coda();
  }

  #pinned() {
    this.el.classList.add('ask--pinned');
    const n = this.vows.length;
    const counter = { v: 1 };
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { refreshPriority: this.section.prio,
        trigger: this.promise,
        start: 'top top',
        end: () => `+=${window.innerHeight * (n * 0.9)}`,
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (st) => this.#meter(st, counter),
      },
    });
    this.vows.forEach((vow, i) => {
      const span = vow.firstElementChild;
      const at = i * (HOLD + 0.5);
      if (i > 0) {
        tl.fromTo(vow, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 }, at)
          .fromTo(span, { yPercent: 40, scale: 0.92 },
            { yPercent: 0, scale: 1, duration: 0.5, ease: 'power2.out' }, at);
      }
      if (i < n - 1) {
        tl.to(span, { yPercent: -30, scale: 1.04, duration: 0.45, ease: 'power1.in' }, at + HOLD + 0.1)
          .to(vow, { autoAlpha: 0, duration: 0.4 }, at + HOLD + 0.15);
      }
    });
    tl.to({}, { duration: 0.4 });
    return () => {
      this.el.classList.remove('ask--pinned');
      gsap.set(this.vows, { clearProps: 'all' });
      gsap.set(this.vows.map((v) => v.firstElementChild), { clearProps: 'all' });
    };
  }

  /** Meter follows the vow on stage (timeline time), the bar follows raw scroll progress. */
  #meter(st, counter) {
    const n = this.vows.length;
    const t = st.animation ? st.animation.time() : st.progress * n;
    const v = Math.min(n, 1 + Math.floor((t + 0.3) / (HOLD + 0.5)));
    if (v !== counter.v && this.meterN) {
      counter.v = v;
      this.meterN.textContent = String(v);
    }
    if (this.meterBar) this.meterBar.style.transform = `scaleX(${st.progress.toFixed(4)})`;
  }

  #stacked() {
    this.vows.forEach((vow) => {
      gsap.fromTo(vow.firstElementChild,
        { opacity: 0.5, y: 24 },
        {
          opacity: 1, y: 0, ease: 'none',
          scrollTrigger: { refreshPriority: this.section.prio, trigger: vow, start: 'top 92%', end: 'top 55%', scrub: 0.4 },
        });
    });
  }

  #coda() {
    const coda = this.section.$('.ask__coda');
    if (!coda) return;
    gsap.from(this.section.$$('.ask__close .line > span'), {
      yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.12,
      scrollTrigger: { refreshPriority: this.section.prio, trigger: this.section.$('.ask__close'), start: 'top 85%', once: true },
    });
    gsap.from(this.section.$$('.ask__when, .ask__send--final'), {
      opacity: 0, y: 20, duration: 0.9, ease: 'power3.out', stagger: 0.12,
      scrollTrigger: { refreshPriority: this.section.prio, trigger: this.section.$('.ask__when'), start: 'top 92%', once: true },
    });
    const glow = this.section.$('.ask__glow');
    if (glow) {
      gsap.fromTo(glow, { opacity: 0.15, scale: 0.6 }, {
        opacity: 1, scale: 1.15, ease: 'none',
        scrollTrigger: { refreshPriority: this.section.prio, trigger: coda, start: 'top bottom', end: 'bottom bottom', scrub: true },
      });
    }
  }
}
