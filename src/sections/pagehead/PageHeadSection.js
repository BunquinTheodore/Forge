import { BaseSection } from '../../core/BaseSection.js';
import { gsap } from '../../core/Scroll.js';

/**
 * PAGEHEAD: title block of an inner page. The title lines forge up out of their masks once the splash hands over,
 * then the supporting copy follows. The h1 text stays in the HTML (no opacity change on it, so LCP is unaffected).
 */
export default class PageHeadSection extends BaseSection {
  static id = 'pagehead';

  init() {
    if (this.reducedMotion) return;
    const spans = this.$$('.pagehead__title .line > span');
    const rest = this.$$('.pagehead__back, .pagehead__eyebrow, .pagehead__lead, .pagehead__facts, .pagehead__ctas');
    this.gsap(() => {
      gsap.set(spans, { yPercent: 110 });
      gsap.set(rest, { autoAlpha: 0, y: 18 });
      this.app.on('ready', () => {
        gsap.to(spans, { yPercent: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out', delay: 0.1 });
        gsap.to(rest, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', delay: 0.25 });
      });
    });
  }
}
