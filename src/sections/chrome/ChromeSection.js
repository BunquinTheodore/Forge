import { BaseSection, gsap } from '../../core/BaseSection.js';
import { goToChapter, chapterEl, focusChapter } from './chapters.js';
import { Header } from './Header.js';
import { Rail } from './Rail.js';
import { Menu } from './Menu.js';
import { Cursor } from './Cursor.js';

/**
 * Persistent page chrome: header, progress, chapter rail, menu, cursor and
 * the CSS ambient fallback. The matching GL layer lives in AmbientAct.js.
 */
export default class ChromeSection extends BaseSection {
  static id = 'chrome';

  init() {
    this.header = new Header(this);
    this.menu = new Menu(this, {
      onOpen: () => this.header.lock(true),
      onClose: () => this.header.lock(false),
    });
    this.rail = new Rail(this, (id) => this.menu.setActive(id));
    this.cursor = Cursor.supported() ? new Cursor(this) : null;

    this.listen(this.el, 'click', (e) => this.#onChapterClick(e), { passive: false });
    this.#intro();
  }

  #onChapterClick(e) {
    const trigger = e.target.closest('[data-chapter]');
    if (!trigger || e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
    const id = trigger.dataset.chapter;
    if (!chapterEl(id)) return;
    e.preventDefault();
    const byKeyboard = e.detail === 0;
    const go = () => {
      goToChapter(this.app, id);
      if (byKeyboard) focusChapter(id);
    };
    if (this.menu.isOpen) this.menu.close(go);
    else go();
  }

  /**
   * Entrance: the bar forges in when the splash hands over, then the rail
   * ticks are drawn out by the first viewport of scroll (scrubbed).
   */
  #intro() {
    if (this.reducedMotion) return;
    const bits = this.$$('.chrome__brand, .chrome__iccpi, .chrome__pill, .chrome__actions > *');
    this.gsap(() => {
      gsap.set(bits, { yPercent: -140, autoAlpha: 0 });
      this.app.on('ready', () => {
        gsap.to(bits, {
          yPercent: 0, autoAlpha: 1, duration: 1.1, ease: 'expo.out', stagger: 0.07, delay: 0.15,
        });
      });
      gsap.fromTo(this.$$('.chrome__rail-tick'), { scaleX: 0 }, {
        scaleX: 1,
        ease: 'none',
        stagger: 0.04,
        scrollTrigger: { trigger: document.body, start: 'top top', end: () => `+=${window.innerHeight}`, scrub: 0.6 },
      });
    });
  }

  destroy() {
    this.header?.destroy();
    this.rail?.destroy();
    this.menu?.destroy();
    this.cursor?.destroy();
    super.destroy();
  }
}
