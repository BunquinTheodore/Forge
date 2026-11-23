import { BaseSection } from '../../core/BaseSection.js';
import { ScrollTrigger } from '../../core/Scroll.js';
import { rise, lines } from '../../core/reveal.js';
import { goToChapter, focusChapter } from '../../core/navigation.js';

/**
 * STARTUP: the day bar fills across the three phases as the reader scrolls, then the day at a glance rises in.
 * The join call to action scrolls to the join chapter with the page's smooth scroller.
 */
export default class StartupSection extends BaseSection {
  static id = 'startup';

  init() {
    this.phases = this.$('[data-phases]');
    for (const link of this.$$('a[data-chapter]')) {
      this.listen(link, 'click', (e) => {
        e.preventDefault();
        goToChapter(this.app, link.dataset.chapter);
        if (e.detail === 0) focusChapter(link.dataset.chapter);
      }, { passive: false });
    }
    if (this.reducedMotion) {
      this.phases.style.setProperty('--p', '1');
      return;
    }
    this.gsap(() => {
      lines(this.$('.startup__title'), this.el);
      rise(this.$$('.startup__lead, .startup__text'), this.$('.startup__head'), { delay: 0.2 });
      rise(this.$$('.phase'), this.phases, { y: 40, stagger: 0.14, start: 'top 85%' });
      rise(this.$$('.startup__close, .startup__action'), this.$('.startup__close'), { start: 'top 90%' });
      rise(this.$$('.day__card, .day__head, .day__foot'), this.$('[data-day]'), { y: 36, stagger: 0.1, start: 'top 82%' });
      ScrollTrigger.create({
        trigger: this.phases,
        start: 'top 75%',
        end: 'bottom 55%',
        scrub: 0.4,
        onUpdate: (self) => this.phases.style.setProperty('--p', self.progress.toFixed(3)),
        onRefresh: (self) => this.phases.style.setProperty('--p', self.progress.toFixed(3)),
      });
    });
  }
}
