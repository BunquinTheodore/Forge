import { BaseSection, gsap } from '../../core/BaseSection.js';
import { WordSplit } from '../../core/WordSplit.js';

/** Visual brightness of a word before the scroll heat-up reaches it. */
const MIN_LIT = 0.35;

/**
 * THESIS. Deck pages 1 and 2.
 * Entrance: the serif thesis statement heats up word by word as it is scrubbed through the viewport
 * (dim steel to cream), and "the configuration" / "investable." ignite in ember.
 * GL: ThesisAct reads data-point (the card nearest the viewport centre) from the section.
 */
export default class ThesisSection extends BaseSection {
  static id = 'thesis';

  init() {
    const statement = this.$('[data-heat]');
    this.split = new WordSplit(statement, 'w');
    statement.classList.add('is-split');

    this.cards = this.$$('.thesis__card');

    this.#trackPoints();

    if (this.reducedMotion) return;
    this.gsap(() => {
      this.#heatUp(statement);
      this.#titleIn();
      this.#cardsIn();
      this.#fallbackSpin();
    });
  }

  #heatUp(statement) {
    const words = this.split.words;
    const keys = this.split.keys;
    // Dim through a CSS alpha mask (--lit), never the text's own opacity, so the real text keeps
    // full contrast for assistive tech and contrast audits while the visual heat-up stays intact.
    statement.classList.add('is-heating');
    gsap.set(words, { '--lit': MIN_LIT });
    gsap.set(keys, { '--glow': 0 });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: statement, start: 'top 82%', end: 'bottom 38%', scrub: 0.6 },
    });
    tl.to(words, { '--lit': 1, ease: 'none', stagger: { each: 0.08 }, duration: 0.3 }, 0);
    keys.forEach((key) => {
      const at = (words.indexOf(key) * 0.08) + 0.2;
      tl.to(key, { '--glow': 1, ease: 'power2.out', duration: 0.4 }, at);
    });
  }

  #titleIn() {
    const title = this.$('.thesis__title');
    gsap.from(title, {
      scaleX: 1.18,
      opacity: 0,
      transformOrigin: '0% 50%',
      ease: 'expo.out',
      duration: 1.4,
      scrollTrigger: { trigger: title, start: 'top 88%', once: true },
    });
  }

  #cardsIn() {
    // Cards are struck in like stamped plates: they drop from a slight 3D angle and settle.
    gsap.from(this.cards, {
      rotateX: -38,
      y: 46,
      opacity: 0,
      transformPerspective: 900,
      transformOrigin: '50% 0%',
      ease: 'power3.out',
      duration: 1.1,
      stagger: 0.12,
      clearProps: 'transform',
      scrollTrigger: { trigger: this.$('.thesis__points'), start: 'top 85%', once: true },
    });
  }

  #fallbackSpin() {
    const core = this.$('.thesis__fallback-facets');
    if (!core) return;
    gsap.to(core, {
      rotation: 120,
      transformOrigin: '50% 50%',
      ease: 'none',
      scrollTrigger: { trigger: this.el, start: 'top bottom', end: 'bottom top', scrub: 1 },
    });
  }

  /** Mark the card nearest the viewport centre as active and expose it to the GL act. */
  #trackPoints() {
    this.gsap(() => {
      this.cards.forEach((card, i) => {
        gsap.timeline({
          scrollTrigger: {
            trigger: card,
            start: 'top 62%',
            end: 'bottom 38%',
            onToggle: (self) => { if (self.isActive) this.#setPoint(i); },
          },
        });
      });
    });
  }

  #setPoint(i) {
    this.el.dataset.point = String(i);
    this.cards.forEach((c, j) => c.classList.toggle('is-active', j === i));
  }

  destroy() {
    super.destroy();
    this.$('[data-heat]')?.classList.remove('is-heating');
  }
}
