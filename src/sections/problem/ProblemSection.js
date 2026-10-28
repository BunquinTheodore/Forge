import { BaseSection, gsap } from '../../core/BaseSection.js';
import { WordSplit } from '../../core/WordSplit.js';

/**
 * PROBLEM. Deck page 3.
 * Entrance: the headline physically splits. OPPORTUNITY and INVESTABILITY drift apart while a
 * glowing fissure widens between them (scrubbed by scroll, written as the --gap CSS variable).
 * Then, as the "problem in one line" statement scrolls through, the gap closes again (--b, scrubbed):
 * the statement lights word by word and the ProblemAct particle clouds converge (section.dataset.bridge).
 */
export default class ProblemSection extends BaseSection {
  static id = 'problem';

  init() {
    this.split = this.$('[data-split]');
    this.oneline = this.$('[data-oneline]');
    this.words = new WordSplit(this.$('[data-reveal]'), 'pw').words;
    this.lit = 0;

    if (this.reducedMotion) {
      this.el.classList.add('is-static');
      this.split.style.setProperty('--gap', '0.6');
      this.#onBridge(1);
      return;
    }
    this.split.style.setProperty('--gap', '0');
    this.#onBridge(0);
    this.gsap(() => {
      this.#splitOnScroll();
      this.#cardsIn();
      this.#closeOnScroll();
    });
  }

  #splitOnScroll() {
    const st = { trigger: this.split, start: 'top 85%', end: 'bottom 30%', scrub: 0.8 };
    const proxy = { gap: 0 };
    gsap.to(proxy, {
      gap: 1,
      ease: 'power1.inOut',
      scrollTrigger: st,
      onUpdate: () => this.split.style.setProperty('--gap', proxy.gap.toFixed(3)),
    });
    gsap.from(this.$$('.problem__lede, .problem__sub'), {
      opacity: 0,
      x: -28,
      ease: 'power3.out',
      duration: 1,
      stagger: 0.12,
      scrollTrigger: { trigger: this.split, start: 'top 92%', once: true },
    });
  }

  #cardsIn() {
    // Cards converge from both sides of the chasm toward the centre seam.
    const cards = this.$$('.problem__card');
    cards.forEach((card, i) => {
      gsap.from(card, {
        x: i % 2 === 0 ? -70 : 70,
        opacity: 0,
        ease: 'expo.out',
        duration: 1.3,
        delay: (i % 2) * 0.08,
        scrollTrigger: { trigger: card, start: 'top 90%', once: true },
      });
    });
  }

  #closeOnScroll() {
    const proxy = { b: 0 };
    gsap.to(proxy, {
      b: 1,
      ease: 'none',
      scrollTrigger: { trigger: this.oneline, start: 'top 85%', end: 'bottom 45%', scrub: 0.6 },
      onUpdate: () => this.#onBridge(proxy.b),
    });
  }

  #onBridge(v) {
    const value = v.toFixed(3);
    this.el.dataset.bridge = value;
    this.split.style.setProperty('--b', value);
    this.#lightWords(v);
    this.el.classList.toggle('is-bridged', v >= 0.999);
  }

  /** Light the one-line statement word by word as the gap closes. Only touches changed words. */
  #lightWords(v) {
    const n = this.words.length;
    const target = Math.min(n, Math.round((v / 0.92) * n));
    if (target === this.lit) return;
    const [from, to, on] = target > this.lit ? [this.lit, target, true] : [target, this.lit, false];
    for (let i = from; i < to; i += 1) this.words[i].classList.toggle('is-lit', on);
    this.lit = target;
  }
}
