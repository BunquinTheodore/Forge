import { gsap } from '../../core/BaseSection.js';

const OPEN_DURATION = 0.95;
const CLOSE_DURATION = 0.6;

/**
 * Full screen chapter menu: clip-path circle reveal from the toggle,
 * staggered lines, focus trap, Escape to close, aria-expanded on the toggle.
 * Hovering or focusing a chapter swaps the giant molten preview number.
 */
export class Menu {
  constructor(section, { onOpen, onClose } = {}) {
    this.section = section;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.el = section.$('.chrome__menu');
    this.toggle = section.$('.chrome__toggle');
    this.closeBtn = section.$('.chrome__close');
    this.links = section.$$('.chrome__link');
    this.lines = section.$$('.chrome__link-in');
    this.side = section.$('.chrome__menu-side');
    this.previewNum = section.$('.chrome__preview-num');
    this.isOpen = false;
    this.activeNum = '01';
    this.tween = null;
    this.origin = { x: 0, y: 0, r: 0 };

    section.listen(this.toggle, 'click', () => (this.isOpen ? this.close() : this.open()));
    section.listen(this.closeBtn, 'click', () => this.close());
    section.listen(document, 'keydown', (e) => this.#onKey(e), { passive: false });
    this.links.forEach((a) => {
      section.listen(a, 'pointerenter', () => this.#preview(a.dataset.num));
      section.listen(a, 'focus', () => this.#preview(a.dataset.num));
    });
    section.listen(this.el, 'pointerleave', () => this.#preview(this.activeNum));
    // Menu links are real page navigations: if the page is restored from the back/forward cache, never show it open.
    section.listen(window, 'pageshow', (e) => { if (e.persisted && this.isOpen) this.close(); });
    this.markCurrentPage();
  }

  /** Mark the link for the page being viewed (pages other than the homepage have no chapter rail). */
  markCurrentPage() {
    const slash = (p) => p.replace(/index\.html$/, '').replace(/\/?$/, '/');
    const path = slash(location.pathname);
    const here = this.links.find((a) => !a.hash && slash(new URL(a.href, location.href).pathname) === path);
    if (!here) return;
    here.setAttribute('aria-current', 'page');
    this.activeNum = here.dataset.num;
    this.previewNum.textContent = this.activeNum;
  }

  /** Homepage chapters: the menu keeps the forum link current (its chapters have their own rail numbers). */
  setActive() {
    const current = this.links.find((a) => a.dataset.chapter === 'hero');
    if (!current || !document.querySelector('[data-section="hero"]')) return;
    this.links.forEach((a) => {
      if (a === current) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    this.activeNum = current.dataset.num;
    if (!this.isOpen) this.previewNum.textContent = this.activeNum;
  }

  #measureOrigin() {
    const r = this.toggle.getBoundingClientRect();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    this.origin = { x, y, r: Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) + 24 };
  }

  #clip(radius) {
    const { x, y } = this.origin;
    return `circle(${radius}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.lastFocus = document.activeElement;
    this.#measureOrigin();
    this.el.hidden = false;
    this.toggle.setAttribute('aria-expanded', 'true');
    this.section.el.classList.add('is-menu-open');
    this.section.scroll.stop();
    this.previewNum.textContent = this.activeNum;
    this.onOpen?.();
    this.closeBtn.focus({ preventScroll: true });

    this.tween?.kill();
    if (this.section.reducedMotion) {
      gsap.set(this.el, { clipPath: 'none' });
      return;
    }
    this.tween = gsap.timeline({ defaults: { overwrite: true } })
      .fromTo(this.el, { clipPath: this.#clip(0) }, {
        clipPath: this.#clip(this.origin.r), duration: OPEN_DURATION, ease: 'expo.inOut',
      })
      .fromTo(this.lines, { yPercent: 115 }, {
        yPercent: 0, duration: 0.85, ease: 'expo.out', stagger: 0.028,
      }, 0.32)
      .fromTo(this.side, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.5)
      .set(this.el, { clipPath: 'none' }, OPEN_DURATION);
  }

  /** Close the menu; `after` runs once it is fully hidden (used to scroll to a chapter). */
  close(after) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.toggle.setAttribute('aria-expanded', 'false');
    const done = () => {
      this.el.hidden = true;
      this.section.el.classList.remove('is-menu-open');
      this.section.scroll.start();
      this.onClose?.();
      if (after) after();
      else this.toggle.focus({ preventScroll: true });
    };

    this.tween?.kill();
    if (this.section.reducedMotion) { done(); return; }
    this.#measureOrigin();
    this.tween = gsap.fromTo(this.el, { clipPath: this.#clip(this.origin.r) }, {
      clipPath: this.#clip(0), duration: CLOSE_DURATION, ease: 'expo.inOut', onComplete: done,
    });
  }

  #preview(num) {
    if (!num || this.previewNum.textContent === num) return;
    this.previewNum.textContent = num;
    if (this.section.reducedMotion) return;
    gsap.fromTo(this.previewNum, { yPercent: 18, autoAlpha: 0 }, {
      yPercent: 0, autoAlpha: 1, duration: 0.55, ease: 'expo.out', overwrite: true,
    });
  }

  #focusables() {
    return [this.closeBtn, ...this.el.querySelectorAll('a[href]')];
  }

  #onKey(e) {
    if (!this.isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = this.#focusables();
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (!this.el.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }

  destroy() {
    this.tween?.kill();
    if (this.isOpen) this.section.scroll.start();
  }
}
