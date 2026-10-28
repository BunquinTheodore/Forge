import { BaseSection, gsap } from '../../core/BaseSection.js';
import { MoltenTrack } from './MoltenTrack.js';

/**
 * How FORGE works: six steps heated by a molten line, the solution architecture,
 * and the product hypothesis lit word by word.
 * Publishes data-hot on the section and the line head through moltenHeads for ProcessAct.
 */
export default class ProcessSection extends BaseSection {
  static id = 'process';

  init() {
    this.track = new MoltenTrack(this.el, this.scroll);

    this.gsap(() => this.track.build());
    if (this.reducedMotion) {
      this.el.classList.add('is-in');
      return;
    }
    this.#splitWords(this.$('[data-words]'));
    this.gsap(() => {
      this.#headEntrance();
      this.#archEntrance();
    });
  }

  /** Wrap each word in a span so the hypothesis can be lit word by word (text stays in the HTML). */
  #splitWords(el) {
    if (!el) return;
    const text = el.textContent.trim();
    const words = text.split(/\s+/);
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    el.replaceChildren(sr, ...words.flatMap((w, i) => {
      const s = document.createElement('span');
      s.className = 'hypo__w';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = w;
      return i < words.length - 1 ? [s, document.createTextNode(' ')] : [s];
    }));
  }

  #headEntrance() {
    const head = this.$('.prc__head');
    gsap.from(this.$('.prc__title'), {
      opacity: 0, yPercent: 40, rotateX: -55, transformPerspective: 900, transformOrigin: '50% 100%',
      duration: 1.3, ease: 'expo.out',
      scrollTrigger: { trigger: head, start: 'top 80%', once: true },
    });
    // the four phrases heat up one after another as the reader scrolls
    gsap.fromTo(this.$$('.prc__phrase'), { opacity: 0.5 }, {
      opacity: 1, stagger: 0.5, ease: 'none',
      scrollTrigger: { trigger: head, start: 'top 70%', end: 'bottom 45%', scrub: true },
    });
  }

  #archEntrance() {
    const plates = this.$$('.plate');
    gsap.from(this.$('.arch__title'), {
      opacity: 0, x: -60, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: this.$('.arch'), start: 'top 78%', once: true },
    });
    // plates are stamped down one after another, like parts dropped onto an anvil
    gsap.from(plates, {
      opacity: 0, scale: 1.18, y: -30, duration: 0.7, ease: 'back.out(1.6)', stagger: 0.18,
      scrollTrigger: {
        trigger: this.$('.arch__flow'), start: 'top 80%', once: true,
        onEnter: () => this.$('.arch__flow').classList.add('is-linked'),
      },
    });
    gsap.fromTo(this.$$('.hypo__w'), { opacity: 0.6 }, {
      opacity: 1, stagger: 0.08, ease: 'none',
      scrollTrigger: { trigger: this.$('.hypo'), start: 'top 82%', end: 'bottom 55%', scrub: true },
    });
  }
}
