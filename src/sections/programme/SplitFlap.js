import { gsap } from '../../core/BaseSection.js';

const DIGITS = '0123456789';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';

const glyphFor = (ch) => {
  if (DIGITS.includes(ch)) return DIGITS;
  if (UPPER.includes(ch)) return UPPER;
  if (LOWER.includes(ch)) return LOWER;
  return null;
};

/**
 * Departure-board text: characters spin through random glyphs and lock in left to right.
 * Keeps the element's accessible text stable via aria-label while it flips.
 */
export class SplitFlap {
  constructor(el) {
    this.el = el;
    this.tween = null;
  }

  set(text, { animate = true, duration = 0.6, delay = 0 } = {}) {
    this.tween?.kill();
    if (!animate) {
      this.el.textContent = text;
      return;
    }
    const state = { p: 0 };
    const chars = Array.from(text);
    const pools = chars.map(glyphFor);
    this.el.setAttribute('aria-label', text);
    this.tween = gsap.to(state, {
      p: 1,
      duration,
      delay,
      ease: 'none',
      onUpdate: () => {
        const settled = Math.floor(state.p * (chars.length + 2)) - 2;
        let out = '';
        for (let i = 0; i < chars.length; i += 1) {
          const pool = pools[i];
          out += i <= settled || !pool ? chars[i] : pool[(Math.random() * pool.length) | 0];
        }
        this.el.textContent = out;
      },
      onComplete: () => {
        this.el.textContent = text;
        this.el.removeAttribute('aria-label');
      },
    });
  }

  kill() {
    this.tween?.kill();
  }
}
