import { BaseSection } from '../../core/BaseSection.js';
import { ScrollTrigger } from '../../core/Scroll.js';
import { rise, lines } from '../../core/reveal.js';

/** INTL: the corridor arc ignites as it scrolls into view, a spark travels Italy to Philippines, themes rise in. */
export default class IntlSection extends BaseSection {
  static id = 'intl';

  init() {
    const map = this.$('[data-map]');
    if (this.reducedMotion) {
      map.classList.add('is-in');
      return;
    }
    this.gsap(() => {
      lines(this.$('.intl__title'), this.el);
      rise(this.$('.intl__lead'), this.$('.intl__copy'), { delay: 0.2 });
      ScrollTrigger.create({ trigger: map, start: 'top 80%', once: true, onEnter: () => map.classList.add('is-in') });
      rise(this.$$('.intl__card'), this.$('.intl__grid'), { y: 40, stagger: 0.12, start: 'top 86%' });
      rise(this.$('.intl__foot'), this.$('.intl__foot'), { start: 'top 95%' });
    });
  }
}
