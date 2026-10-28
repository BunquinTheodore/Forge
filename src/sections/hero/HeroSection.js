import { BaseSection } from '../../core/BaseSection.js';
import { HeroMotion } from './HeroMotion.js';

/**
 * Hero: the poster as a live forge. The GL act (HeroAct.js) forges the ribbon as the page scrolls.
 */
export default class HeroSection extends BaseSection {
  static id = 'hero';

  init() {
    this.motion = new HeroMotion(this);
    this.parallax = null;

    this.#bindCtas();
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
  }

  #start() {
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
      this.parallax = this.motion.fallbackParallax(this.$('.hero__ribbon'));
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

  destroy() {
    this.motion.destroy();
    super.destroy();
  }
}
