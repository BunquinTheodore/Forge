import { gsap } from '../../core/BaseSection.js';

const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const INTERACTIVE = 'a[href], button, [role="button"], summary, label, select, [data-cursor]';
const TEXT_FIELDS = 'input, textarea, [contenteditable="true"]';
const HTML_ON = 'chrome-cursor-on';
const FOLLOW = 0.2;     // ring easing per 60fps frame
const SETTLE = 0.08;    // px, stop writing transforms below this distance

/**
 * Ring + dot cursor for fine pointers only. The native cursor is hidden only
 * while the ring is visible; over text fields the native caret comes back.
 * Elements with data-cursor="label" show that label inside the grown ring.
 */
export class Cursor {
  static supported() {
    return window.matchMedia(FINE_POINTER).matches;
  }

  constructor(section) {
    this.section = section;
    this.root = section.$('.chrome__cursor');
    this.ring = section.$('.chrome__cursor-ring');
    this.dot = section.$('.chrome__cursor-dot');
    this.label = section.$('.chrome__cursor-label');
    this.x = 0; this.y = 0; this.rx = 0; this.ry = 0;
    this.visible = false;
    this.overText = false;
    this.moving = false;
    this.labelText = '';
    this.follow = section.reducedMotion ? 1 : FOLLOW;
    this.tick = (time, deltaMs) => this.#frame(deltaMs);

    section.listen(window, 'pointermove', (e) => this.#move(e));
    section.listen(document, 'pointerover', (e) => this.#over(e.target));
    section.listen(document.documentElement, 'pointerleave', () => this.#setVisible(false));
    section.listen(window, 'blur', () => this.#setVisible(false));
    section.listen(window, 'pointerdown', () => this.root.classList.add('is-down'));
    section.listen(window, 'pointerup', () => this.root.classList.remove('is-down'));
    gsap.ticker.add(this.tick);
  }

  #move(e) {
    if (e.pointerType !== 'mouse') { this.#setVisible(false); return; }
    this.x = e.clientX;
    this.y = e.clientY;
    if (!this.visible) {
      this.rx = this.x;
      this.ry = this.y;
      this.#setVisible(true);
    }
    this.moving = true;
  }

  #over(target) {
    if (!(target instanceof Element)) return;
    this.overText = Boolean(target.closest(TEXT_FIELDS));
    const hit = this.overText ? null : target.closest(INTERACTIVE);
    const text = hit?.closest('[data-cursor]')?.dataset.cursor || '';
    this.root.classList.toggle('is-hover', Boolean(hit));
    this.root.classList.toggle('is-text', this.overText);
    if (text !== this.labelText) {
      this.labelText = text;
      this.label.textContent = text;
    }
    this.root.classList.toggle('has-label', Boolean(text));
    this.#syncNative();
  }

  #setVisible(on) {
    if (this.visible === on) return;
    this.visible = on;
    this.root.classList.toggle('is-visible', on);
    this.#syncNative();
  }

  #syncNative() {
    document.documentElement.classList.toggle(HTML_ON, this.visible && !this.overText);
  }

  #frame(deltaMs) {
    if (!this.visible || !this.moving) return;
    const k = this.follow >= 1 ? 1 : 1 - (1 - this.follow) ** (deltaMs / 16.67);
    this.rx += (this.x - this.rx) * k;
    this.ry += (this.y - this.ry) * k;
    this.dot.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    this.ring.style.transform = `translate3d(${this.rx.toFixed(2)}px, ${this.ry.toFixed(2)}px, 0)`;
    if (Math.abs(this.x - this.rx) < SETTLE && Math.abs(this.y - this.ry) < SETTLE) this.moving = false;
  }

  destroy() {
    gsap.ticker.remove(this.tick);
    document.documentElement.classList.remove(HTML_ON);
  }
}
