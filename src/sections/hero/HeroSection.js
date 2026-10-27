import { BaseSection } from '../../core/BaseSection.js';
import { Countdown } from './Countdown.js';
import { HeatText } from './HeatText.js';
import { HeroMotion } from './HeroMotion.js';

const PARALLAX_PX = 22;

/**
 * Hero: the poster as a live forge. Wordmark heats under the pointer (signature interaction),
 * the GL act (HeroAct.js) forges the ribbon, and a countdown runs to the doors opening.
 */
export default class HeroSection extends BaseSection {
  static id = 'hero';

  init() {
    this.mark = this.$('[data-heat]');
    this.heat = new HeatText(this.mark, this.$$('.hero__l'));
    this.countdown = new Countdown(this.$('[data-countdown]'));
    this.motion = new HeroMotion(this);
    this.parallax = null;

    this.#bindCtas();
    this.#bindHeat();
    this.#watchGL();

    this.gsap(() => {
      if (this.reducedMotion) { this.motion.settle(); return; }
      this.motion.prime();
    });
    // The stage never exists yet at init (sections are built before it), so only commit to the
    // fallback parallax when GL is known to be missing. A late GL failure is caught at ready or by 'gl-failed'.
    if (this.#glMissing()) this.#buildParallax();
    this.app.on('gl-failed', () => this.#buildParallax());

    this.app.on('ready', () => {
      if (this.#glMissing()) this.#buildParallax();
      this.#start();
    });
    this.listen(window, 'resize', () => this.#queueMeasure());
  }

  #start() {
    this.heat.measure();
    if (this.reducedMotion) return;
    this.gsap(() => {
      this.motion.intro(() => this.gsap(() => this.motion.scrollOut()));
    });
  }

  #glMissing() {
    return !this.app.stage && document.documentElement.classList.contains('no-gl');
  }

  #buildParallax() {
    if (this.parallax || this.reducedMotion) return;
    this.gsap(() => {
      this.parallax = this.motion.fallbackParallax(this.$('.hero__fallback'), this.$('.hero__ribbon'));
    });
  }

  #watchGL() {
    const mark = () => {
      this.el.classList.add('has-gl');
      this.parallax?.kill();
      this.parallax = null;
    };
    if (this.app.stage) mark();
    else this.app.on('gl', (stage) => { if (stage) mark(); });
  }

  #bindCtas() {
    for (const a of this.$$('[data-scrollto]')) {
      this.listen(a, 'click', (e) => {
        const target = document.querySelector(a.dataset.scrollto);
        if (!target) return;
        e.preventDefault();
        this.app.scroll.to(target);
      }, { passive: false });
    }
  }

  #bindHeat() {
    this.listen(this.el, 'pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.heat.point(e.clientX, e.clientY, this.#overMark(e) ? 1 : 0.55);
      this.#nudge(e);
    });
    this.listen(this.el, 'pointerleave', () => {
      this.heat.release();
      this.parallax?.x(0);
      this.parallax?.y(0);
    });
    this.listen(this.el, 'pointerdown', (e) => {
      if (this.#overMark(e) || e.pointerType === 'touch') this.heat.strike(e.clientX, e.clientY);
    });
  }

  #overMark(e) {
    return e.target instanceof Element && this.mark.contains(e.target);
  }

  #nudge(e) {
    if (!this.parallax) return;
    const nx = e.clientX / window.innerWidth - 0.5;
    const ny = e.clientY / window.innerHeight - 0.5;
    this.parallax.x(-nx * PARALLAX_PX);
    this.parallax.y(-ny * PARALLAX_PX);
  }

  #queueMeasure() {
    if (this.measureQueued) return;
    this.measureQueued = true;
    requestAnimationFrame(() => {
      this.measureQueued = false;
      this.heat.measure();
    });
  }

  update(dt) {
    this.countdown.tick(dt);
    this.heat.update(dt);
  }

  destroy() {
    this.motion.destroy();
    super.destroy();
  }
}
