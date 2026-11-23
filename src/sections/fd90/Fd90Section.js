import { BaseSection } from '../../core/BaseSection.js';
import { gsap, ScrollTrigger } from '../../core/Scroll.js';
import { rise, lines } from '../../core/reveal.js';

const DESKTOP = '(min-width: 900px)';

/** FD90: the 90-day line fills as the reader scrolls and each milestone lights as the line passes it. */
export default class Fd90Section extends BaseSection {
  static id = 'fd90';

  init() {
    this.timeline = this.$('[data-timeline]');
    this.miles = this.$$('.mile');
    if (this.reducedMotion) {
      this.timeline.style.setProperty('--p', '1');
      this.miles.forEach((m) => m.classList.add('is-lit'));
      return;
    }
    this.gsap(() => {
      lines(this.$('.fd90__title'), this.el);
      rise(this.$('.fd90__lead'), this.$('.fd90__head'), { delay: 0.2 });
      rise(this.miles, this.timeline, { y: 36, stagger: 0.14, start: 'top 85%' });
      rise(this.$$('.fd90__panel'), this.$('.fd90__split'), { y: 44, stagger: 0.14, start: 'top 85%' });
      const mm = gsap.matchMedia();
      mm.add({ wide: DESKTOP }, (ctx) => {
        const wide = ctx.conditions.wide;
        ScrollTrigger.create({
          trigger: this.timeline,
          start: wide ? 'top 78%' : 'top 70%',
          end: wide ? 'top 40%' : 'bottom 65%',
          scrub: 0.4,
          onUpdate: (self) => this.#paint(self.progress),
          onRefresh: (self) => this.#paint(self.progress),
        });
      });
    });
  }

  #paint(p) {
    this.timeline.style.setProperty('--p', p.toFixed(3));
    const n = this.miles.length;
    this.miles.forEach((m, i) => m.classList.toggle('is-lit', p >= (i + 0.1) / n));
  }
}
