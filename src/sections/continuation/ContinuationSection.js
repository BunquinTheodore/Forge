import { BaseSection, gsap } from '../../core/BaseSection.js';
import { DayClock } from './DayClock.js';
import { ContinuationScenes } from './ContinuationScenes.js';
import { TriggerOrder } from './TriggerOrder.js';

const FILM_QUERY = '(min-width: 900px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)';
const FLOW_QUERY = '(max-width: 899px), (max-height: 699px)';
const JUMP_DURATION = 1.4;
const NAV_KEYS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * CONTINUATION: the forum does not end on October 29.
 * Signature interaction: every milestone (card or ruler tick) jumps the film to its day.
 */
export default class ContinuationSection extends BaseSection {
  static id = 'continuation';

  init() {
    this.clock = new DayClock(this.el);
    this.scenes = new ContinuationScenes(this, this.clock);
    this.buttons = this.$$('.ms__btn');
    this.#watchGL();
    this.#bindNav();

    if (this.reducedMotion) {
      this.clock.setAxis('y');
      this.clock.complete();
      this.scenes.setHeat(0.7);
      return;
    }
    this.el.classList.add('is-live');
    this.gsap(() => {
      this.mm = gsap.matchMedia();
      this.mm.add(FILM_QUERY, () => this.#withOrder(this.scenes.buildFilm()));
      this.mm.add(FLOW_QUERY, () => this.#withOrder(this.scenes.buildFlow()));
    });
  }

  /** Keep triggers in page order whenever a breakpoint rebuilds the scenes. */
  #withOrder(cleanup) {
    if (this.app.isReady) TriggerOrder.apply(false);
    return cleanup;
  }

  #watchGL() {
    const mark = () => this.el.classList.add('has-gl');
    if (this.app.stage) mark();
    else this.app.on('gl', mark);
  }

  #bindNav() {
    this.listen(this.el, 'click', (e) => {
      const btn = e.target.closest('[data-jump]');
      if (btn) this.jump(Number(btn.dataset.jump));
    });
    this.listen(this.el.querySelector('.cont__ms'), 'keydown', (e) => this.#onKey(e), { passive: false });
  }

  #onKey(e) {
    const dir = NAV_KEYS[e.key];
    const idx = this.buttons.indexOf(document.activeElement);
    if (!dir || idx < 0) return;
    e.preventDefault();
    const next = Math.min(this.buttons.length - 1, Math.max(0, idx + dir));
    this.buttons[next].focus({ preventScroll: true });
    this.jump(next);
  }

  /** Scroll so milestone i is lit, then mark it as the current step. */
  jump(i) {
    const target = this.scenes.jumpTarget(i);
    const card = this.clock.items[i];
    const lenis = this.scroll.lenis;
    if (target !== null) {
      if (lenis) lenis.scrollTo(target, { duration: JUMP_DURATION });
      else window.scrollTo(0, target);
    } else if (!this.reducedMotion && lenis) {
      lenis.scrollTo(card, { offset: -window.innerHeight * 0.6, duration: JUMP_DURATION });
    } else {
      card.scrollIntoView({ block: 'center' });
    }
    this.clock.pick(i);
  }

  onEnter() { this.el.classList.add('is-visible'); }
  onLeave() { this.el.classList.remove('is-visible'); }

  destroy() {
    this.mm?.revert();
    super.destroy();
  }
}
