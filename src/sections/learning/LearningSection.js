import { BaseSection, gsap, ScrollTrigger } from '../../core/BaseSection.js';
import { LoopPath } from './LoopPath.js';
import { RecapBoard } from './RecapBoard.js';

/**
 * LEARNING. FORGE 01 to FORGE 02 drawn as a self-drawing loop, then the
 * Generative Recap demo where sample notes sort themselves into four steps.
 * Cream "paper" section, so it uses SVG/CSS visuals instead of a GL act.
 */
export default class LearningSection extends BaseSection {
  static id = 'learning';

  init() {
    this.loop = new LoopPath(this.$('.learning__loop'), { gsap, reducedMotion: this.reducedMotion });
    this.recap = new RecapBoard(this.$('.recap'), {
      gsap,
      reducedMotion: this.reducedMotion,
      listen: (t, type, fn, opts) => this.listen(t, type, fn, opts),
    });
    this.gsap(() => this.loop.build());
    if (this.reducedMotion) return;

    this.gsap(() => {
      this.#titleEntrance();
      this.#rings();
      this.#recapTriggers();
    });
  }

  /** Title slides in on scroll as the loop begins to draw. */
  #titleEntrance() {
    const title = this.$('.learning__title');
    gsap.fromTo(title, { opacity: 0, x: () => -window.innerWidth * 0.06 }, {
      opacity: 1, x: 0, ease: 'power2.out',
      scrollTrigger: { trigger: title, start: 'top 92%', end: 'top 55%', scrub: 0.6 },
    });
    gsap.from(this.$('.learning__statement'), {
      opacity: 0, y: 30, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: this.$('.learning__statement'), start: 'top 85%' },
    });
  }

  /** Background growth rings turn and swell with scroll: one more cycle, one more ring. */
  #rings() {
    gsap.fromTo(this.$('.learning__rings svg'), { rotate: -40, scale: 0.85 }, {
      rotate: 80, scale: 1.12, ease: 'none',
      scrollTrigger: { trigger: this.el, start: 'top bottom', end: 'bottom top', scrub: 1 },
    });
  }

  #recapTriggers() {
    const board = this.$('.recap__board');
    ScrollTrigger.create({
      trigger: board, start: 'top bottom+=200', once: true,
      onEnter: () => this.recap.prepare(),
    });
    ScrollTrigger.create({
      trigger: board, start: 'top 62%', once: true,
      onEnter: () => { if (!this.recap.hasRun) this.recap.run(); },
    });
  }

  destroy() {
    this.loop?.destroy();
    this.recap?.destroy();
    super.destroy();
  }
}
