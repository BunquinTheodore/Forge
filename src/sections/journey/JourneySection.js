import { BaseSection } from '../../core/BaseSection.js';
import { gsap, ScrollTrigger } from '../../core/Scroll.js';
import { rise, lines } from '../../core/reveal.js';

const DESKTOP = '(min-width: 900px)';

/**
 * JOURNEY: the molten line fills as the reader scrolls and each stage lights when the line reaches it.
 * Cards are real links to the page that explains the stage.
 */
export default class JourneySection extends BaseSection {
  static id = 'journey';

  init() {
    this.track = this.$('[data-track]');
    this.stages = this.$$('.stage');
    if (this.reducedMotion) {
      this.track.style.setProperty('--p', '1');
      this.stages.forEach((s) => s.classList.add('is-lit'));
      return;
    }

    this.gsap(() => {
      lines(this.$('.journey__title'), this.el);
      rise(this.stages, this.track, { y: 40, stagger: 0.12, start: 'top 85%' });
      rise(this.$('.journey__foot'), this.$('.journey__foot'), { start: 'top 95%' });
      this.#fillOnScroll();
    });
  }

  /** Scrub --p from 0 to 1 over the track; light each stage once the line passes its node. */
  #fillOnScroll() {
    const mm = gsap.matchMedia();
    mm.add({ wide: DESKTOP }, (ctx) => {
      const horizontal = ctx.conditions.wide;
      ScrollTrigger.create({
        trigger: this.track,
        start: horizontal ? 'top 78%' : 'top 70%',
        end: horizontal ? 'top 40%' : 'bottom 65%',
        scrub: 0.4,
        onUpdate: (self) => this.#paint(self.progress),
        onRefresh: (self) => this.#paint(self.progress),
      });
    });
  }

  #paint(p) {
    this.track.style.setProperty('--p', p.toFixed(3));
    const n = this.stages.length;
    this.stages.forEach((s, i) => s.classList.toggle('is-lit', p >= (i + 0.2) / n));
  }
}
