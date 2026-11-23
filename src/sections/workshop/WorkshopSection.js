import { BaseSection } from '../../core/BaseSection.js';
import { gsap } from '../../core/Scroll.js';
import { rise, lines } from '../../core/reveal.js';
import { WorkshopLoop } from './WorkshopLoop.js';

/** WORKSHOP: working tables beside the orbiting loop. The loop draws itself as it arrives, then circles on its own. */
export default class WorkshopSection extends BaseSection {
  static id = 'workshop';

  init() {
    this.loop = new WorkshopLoop(this.$('.wk__loop'), this.reducedMotion);
    if (this.reducedMotion) return;
    this.gsap(() => {
      lines(this.$('.wk__title'), this.el);
      rise(this.$$('.wk__label, .wk__lead, .wk__text, .wk__aim, .wk__action'), this.$('.wk__copy'), { delay: 0.15 });
      const tl = gsap.timeline({
        scrollTrigger: { trigger: this.$('.wk__loop'), start: 'top 80%', end: 'top 35%', scrub: 0.6 },
      });
      tl.fromTo(this.$('.loop__track'), { strokeDashoffset: 754 }, { strokeDashoffset: 0, ease: 'none', duration: 1 }, 0)
        .fromTo(this.$$('.wk__step'), { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, stagger: 0.18, duration: 0.3, ease: 'back.out(2)' }, 0.1);
    });
  }

  update(dt) {
    this.loop.update(dt);
  }
}
