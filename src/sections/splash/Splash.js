import { gsap } from '../../core/Scroll.js';

const SEEN_KEY = 'forge:splash-seen';
/**
 * Timings in seconds. Total time is max(intro, cap - outro) + outro, so the cap is a hard ceiling.
 * The first visit is kept short so the hero is not held back during the load window; GL only
 * gets the grace that fits inside the cap and finishes warming up behind the hero if it is late.
 */
const TIMING = {
  first: { intro: 1.5, cap: 2.1, outro: 0.6 },
  repeat: { intro: 0.7, cap: 1.2, outro: 0.45 },
  reduced: { intro: 0, cap: 0.45, outro: 0.35 },
};
const SKIP_KEYS_IGNORED = new Set(['Shift', 'Control', 'Alt', 'Meta', 'Tab']);

const wait = (s) => new Promise((r) => setTimeout(r, Math.max(0, s) * 1000));

/**
 * Splash overlay: ICCPI presents, an ember line forges across while a heat counter climbs,
 * the FORGE wordmark cools from white-hot to steel, then the overlay splits along the seam.
 * Not a BaseSection: App calls play(glPromise) and awaits it before emitting 'ready'.
 */
export default class Splash {
  constructor(app) {
    this.app = app;
    this.el = document.querySelector('[data-splash]');
    this.reduced = app.device.reducedMotion;
    this.repeat = Splash.#hasSeen();
    this.bypass = Splash.#shouldBypass(app.device);
    this.timing = this.reduced ? TIMING.reduced : (this.repeat ? TIMING.repeat : TIMING.first);
    this.skipped = false;
    this.#abort = new AbortController();
    this.#skipResolve = null;
  }

  #abort;
  #skipResolve;

  static #hasSeen() {
    try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
  }

  /** Data saver users get the page straight away, without the overlay. */
  static #shouldBypass(device) {
    return Boolean(device?.saveData);
  }

  static #markSeen() {
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* storage unavailable: always full intro */ }
  }

  async play(glPromise) {
    if (!this.el) return;
    if (this.bypass) { this.#finish(); return; }
    const skip = new Promise((r) => { this.#skipResolve = r; });
    this.#bindSkip();

    if (this.reduced) gsap.set(this.el.querySelectorAll('.splash__shutter'), { autoAlpha: 0 });
    const intro = this.reduced ? null : this.#buildIntro();
    const introDone = intro ? new Promise((r) => intro.eventCallback('onComplete', r)) : Promise.resolve();
    const glGrace = Promise.race([
      Promise.resolve(glPromise).catch(() => null),
      wait(this.timing.cap - this.timing.outro),
    ]);

    await Promise.race([Promise.all([introDone, glGrace]), skip]);
    if (this.skipped) intro?.progress(1);
    await this.#outro();
    this.#finish();
  }

  #bindSkip() {
    const opts = { signal: this.#abort.signal };
    const skip = () => {
      if (this.skipped) return;
      this.skipped = true;
      this.#skipResolve?.();
    };
    this.el.addEventListener('pointerdown', skip, opts);
    window.addEventListener('keydown', (e) => { if (!SKIP_KEYS_IGNORED.has(e.key)) skip(); }, opts);
  }

  #q(sel) { return this.el.querySelector(sel); }

  #buildIntro() {
    const line = this.#q('.splash__line');
    const count = this.#q('.splash__count');
    const hot = this.#q('.splash__word--hot');
    const shutters = this.el.querySelectorAll('.splash__shutter');
    line.style.setProperty('--w', `${line.offsetWidth}px`);

    const heat = { p: 0 };
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from(this.#q('.splash__presents'), { y: 14, autoAlpha: 0, duration: 0.45 }, 0)
      .to(heat, {
        p: 1, duration: 1.15, ease: 'power2.inOut',
        onUpdate: () => {
          line.style.setProperty('--p', heat.p.toFixed(4));
          count.textContent = String(Math.round(heat.p * 100)).padStart(3, '0');
        },
      }, 0.2)
      // Wordmark opens from the seam: two ink shutters slide apart (transform only) while the
      // whole mark settles from a slight overscale as one composited layer, so the filtered
      // steel text is rasterized once instead of every frame.
      .fromTo(this.#q('.splash__mark'), { scale: 1.06 }, { scale: 1, duration: 0.6, ease: 'expo.out' }, 0.5)
      .fromTo(shutters, { xPercent: 0 }, {
        xPercent: (i) => (i === 0 ? -100 : 100), duration: 0.6, ease: 'expo.out',
      }, 0.5)
      .set(shutters, { autoAlpha: 0 }, 1.1)
      .to(hot, { autoAlpha: 0, duration: 0.65, ease: 'power1.in' }, 1.1)
      .from(this.#q('.splash__skip'), { autoAlpha: 0, duration: 0.3 }, 0.3);
    tl.timeScale(tl.duration() / this.timing.intro);
    return tl;
  }

  #outro() {
    const { outro } = this.timing;
    if (this.reduced) {
      return gsap.to(this.el, { autoAlpha: 0, duration: outro, ease: 'power1.out' }).then();
    }
    this.el.classList.add('is-opening');
    const d = this.skipped ? Math.min(outro, 0.35) : outro;
    const tl = gsap.timeline({ defaults: { ease: 'expo.inOut', duration: d } });
    tl.to(this.#q('.splash__stage'), { scale: 1.08, autoAlpha: 0, duration: d * 0.6, ease: 'power2.in' }, 0)
      .to(this.#q('.splash__panel--top'), { yPercent: -101 }, d * 0.15)
      .to(this.#q('.splash__panel--bottom'), { yPercent: 101 }, d * 0.15);
    return tl.then();
  }

  #finish() {
    this.#abort.abort();
    Splash.#markSeen();
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
    this.el = null;
  }
}
