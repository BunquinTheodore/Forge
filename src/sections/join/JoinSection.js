import { BaseSection } from '../../core/BaseSection.js';
import { rise, lines } from '../../core/reveal.js';

/** JOIN: the three registration cards rise in; hover heat is CSS. */
export default class JoinSection extends BaseSection {
  static id = 'join';

  init() {
    if (this.reducedMotion) return;
    this.gsap(() => {
      lines(this.$('.join__title'), this.el);
      rise(this.$('.join__lead'), this.$('.join__head'), { delay: 0.2 });
      rise(this.$$('.offer'), this.$('.join__cards'), { y: 44, stagger: 0.14, start: 'top 85%' });
      rise(this.$$('.join__aside > *'), this.$('.join__aside'), { stagger: 0.12, start: 'top 92%' });
    });
  }
}
