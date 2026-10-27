import { BaseSection, gsap } from '../../core/BaseSection.js';
import { goToChapter, chapterEl, focusChapter } from '../chrome/chapters.js';
import { MoltenWordmark } from './MoltenWordmark.js';

/**
 * Footer: presenter, event facts, chapter nav, governance line, back to top,
 * and the molten FORGE wordmark (signature interaction, see MoltenWordmark.js).
 * Entrance: the fact rows are cut in by a heat wipe, the wordmark letters are
 * forged upward one by one and the molten level pours in as the page ends.
 */
export default class FooterSection extends BaseSection {
  static id = 'footer';

  init() {
    this.wordmark = new MoltenWordmark(this, this.$('.footer__mark'));
    this.listen(this.el, 'click', (e) => this.#onClick(e), { passive: false });
    this.listen(this.$('.footer__totop'), 'click', (e) => this.#toTop(e));

    if (this.reducedMotion) {
      this.wordmark.setLevel(0.3);
      return;
    }
    this.gsap(() => {
      this.#wipeFacts();
      this.#forgeLetters();
      this.#furnace();
    });
  }

  #onClick(e) {
    const link = e.target.closest('a[data-chapter]');
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = link.dataset.chapter;
    if (!chapterEl(id)) return;
    e.preventDefault();
    goToChapter(this.app, id);
    if (e.detail === 0) focusChapter(id);
  }

  #toTop(e) {
    const first = chapterEl('hero');
    if (first) {
      goToChapter(this.app, 'hero');
      if (e.detail === 0) focusChapter('hero');
    } else {
      this.scroll.to(document.body);
    }
  }

  #wipeFacts() {
    gsap.fromTo(this.$$('.footer__fact, .footer__tag .line > span'), {
      clipPath: 'inset(0% 100% 0% 0%)',
    }, {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.08,
      scrollTrigger: { trigger: this.$('.footer__wrap'), start: 'top 82%', once: true },
    });
  }

  #forgeLetters() {
    const mark = this.$('.footer__mark');
    gsap.fromTo(this.wordmark.letters, { yPercent: 70, rotateX: -60, autoAlpha: 0.15 }, {
      yPercent: 0,
      rotateX: 0,
      autoAlpha: 1,
      ease: 'power2.out',
      stagger: 0.12,
      scrollTrigger: { trigger: mark, start: 'top bottom', end: 'bottom bottom', scrub: 0.8 },
    });
    const pour = { level: 0 };
    gsap.to(pour, {
      level: 0.3,
      ease: 'none',
      onUpdate: () => this.wordmark.setLevel(pour.level),
      scrollTrigger: { trigger: mark, start: 'top 90%', end: 'bottom bottom', scrub: true },
    });
  }

  #furnace() {
    gsap.fromTo(this.$('.footer__furnace'), { autoAlpha: 0, scaleY: 0.4 }, {
      autoAlpha: 1,
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: this.el, start: 'top bottom', end: 'bottom bottom', scrub: true },
    });
  }

  update(dt) {
    this.wordmark.update(dt);
  }
}
