import { gsap } from '../../core/Scroll.js';

const SEEN_KEY = 'forge:splash-seen';
/**
 * Timings in seconds. The intro itself is CSS (splash.css), started by the inline head script, so
 * `intro` must match the CSS timeline end (hot wordmark cooled at 1.6s, scaled by --sd on repeat).
 * Total time is max(intro, cap - outro) + outro, so the cap is a hard ceiling.
 */
const TIMING = {
  first: { intro: 1.6, cap: 2.1, outro: 0.6 },
  repeat: { intro: 0.72, cap: 1.2, outro: 0.45 },
  reduced: { intro: 0, cap: 0.45, outro: 0.35 },
};
/** Heat counter follows the ember line: same delay and duration as splash-fill, in first-visit seconds. */
const HEAT = { delay: 0.15, duration: 1.2 };
const SKIP_KEYS_IGNORED = new Set(['Shift', 'Control', 'Alt', 'Meta', 'Tab']);
const START_TIMEOUT_MS = 900;

const wait = (s) => new Promise((r) => setTimeout(r, Math.max(0, s) * 1000));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

/**
 * Splash overlay: ICCPI presents, an ember line forges across while a heat counter climbs,
 * the FORGE wordmark cools from white-hot to steel, then the overlay splits along the seam.
 * The intro runs as compositor CSS animations; this class only drives the counter, skip and outro.
 * Not a BaseSection: App calls play(glPromise) and awaits it before emitting 'ready'.
 */
export default class Splash {
  constructor(app) {
    this.app = app;
    this.el = document.querySelector('[data-splash]');
    this.reduced = app.device.reducedMotion;
    this.repeat = document.documentElement.classList.contains('splash-repeat');
    this.bypass = Boolean(app.device?.saveData);
    this.timing = this.reduced ? TIMING.reduced : (this.repeat ? TIMING.repeat : TIMING.first);
    this.pace = this.repeat ? 0.45 : 1;
    this.skipped = false;
    this.#abort = new AbortController();
    this.#skipResolve = null;
    this.#raf = 0;
  }

  #abort;
  #skipResolve;
  #raf;

  static #markSeen() {
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* storage unavailable: always full intro */ }
  }

  async play(glPromise) {
    if (!this.el) return;
    if (this.bypass) { this.#finish(); return; }
    const skip = new Promise((r) => { this.#skipResolve = r; });
    this.#bindSkip();

    const elapsed = this.reduced ? 0 : await Splash.#elapsed();
    if (!this.reduced) this.#countHeat();
    const introLeft = this.timing.intro - elapsed;
    const glGrace = Promise.race([
      Promise.resolve(glPromise).catch(() => null),
      wait(this.timing.cap - this.timing.outro - elapsed),
    ]);

    await Promise.race([Promise.all([wait(introLeft), glGrace]), skip]);
    if (this.skipped) this.el.classList.add('is-skipped');
    await this.#outro();
    this.#finish();
  }

  /** Seconds since the CSS intro started, waiting for the head script's start signal if needed. */
  static async #elapsed() {
    const root = document.documentElement;
    if (!root.classList.contains('splash-go')) {
      await Promise.race([
        new Promise((r) => document.addEventListener('splash-go', r, { once: true })),
        wait(START_TIMEOUT_MS / 1000),
      ]);
    }
    const t0 = window.__splashT0 ?? performance.now();
    return (performance.now() - t0) / 1000;
  }

  /** Text-only counter in step with the CSS line fill. */
  #countHeat() {
    const count = this.el.querySelector('.splash__count');
    const t0 = window.__splashT0 ?? performance.now();
    const delay = HEAT.delay * this.pace;
    const duration = HEAT.duration * this.pace;
    let shown = -1;
    const tick = (now) => {
      const p = Math.min(1, Math.max(0, ((now - t0) / 1000 - delay) / duration));
      const value = this.skipped ? 100 : Math.round(easeInOut(p) * 100);
      if (value !== shown) {
        shown = value;
        count.textContent = String(value).padStart(3, '0');
      }
      if (value < 100) this.#raf = requestAnimationFrame(tick);
    };
    this.#raf = requestAnimationFrame(tick);
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
    cancelAnimationFrame(this.#raf);
    this.#abort.abort();
    Splash.#markSeen();
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
    this.el = null;
  }
}
