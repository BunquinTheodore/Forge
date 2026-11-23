import { BaseSection } from '../../core/BaseSection.js';
import { rise, lines, onceVisible } from '../../core/reveal.js';

/** INTL: the corridor arc ignites as it scrolls into view, a spark travels Italy to Philippines, themes rise in. */
export default class IntlSection extends BaseSection {
  static id = 'intl';

  /** Pulses and the travelling spark only run while the corridor is on screen. */
  onEnter() { this.#live(true); }
  onLeave() { this.#live(false); }

  #live(on) {
    const map = this.$('[data-map]');
    map?.classList.toggle('is-live', on);
    const svg = map?.querySelector('svg');
    if (on) svg?.unpauseAnimations?.(); else svg?.pauseAnimations?.();
  }

  init() {
    const map = this.$('[data-map]');
    if (this.reducedMotion) {
      map.classList.add('is-in');
      return;
    }
    this.gsap(() => {
      lines(this.$('.intl__title'), this.el);
      rise(this.$('.intl__lead'), this.$('.intl__copy'), { delay: 0.2 });
      onceVisible(map, 'top 80%', () => map.classList.add('is-in'));
      rise(this.$$('.intl__card'), this.$('.intl__grid'), { y: 40, stagger: 0.12, start: 'top 86%' });
      rise(this.$('.intl__foot'), this.$('.intl__foot'), { start: 'top 95%' });
    });
  }
}
