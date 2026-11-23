import { BaseSection } from '../../core/BaseSection.js';
import { rise, lines } from '../../core/reveal.js';

/** PARTNERS: title lines forge in, then the presenter, main sponsor and partner groups rise. */
export default class PartnersSection extends BaseSection {
  static id = 'partners';

  init() {
    if (this.reducedMotion) return;
    this.gsap(() => {
      lines(this.$('.partners__title'), this.el);
      rise(this.$('.partners__lead'), this.$('.partners__head'), { delay: 0.2 });
      rise(this.$$('.pcard'), this.$('.partners__lead-row'), { y: 40, stagger: 0.14, start: 'top 86%' });
      rise(this.$$('.pgroup'), this.$('.partners__groups'), { y: 32, stagger: 0.1, start: 'top 90%' });
    });
  }
}
