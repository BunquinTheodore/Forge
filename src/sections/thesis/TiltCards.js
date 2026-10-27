/**
 * 3D tilt + ember edge light that follows the pointer on the four thesis cards.
 * Writes CSS custom properties only (--rx, --ry, --mx, --my, --lit); the CSS turns them into
 * a transform and a masked radial border glow. Touch: a tap lights the edge where the finger is,
 * without tilting (tilt is reserved for fine pointers). Reduced motion: light only, no tilt.
 */
const MAX_TILT = 7; // degrees

export class TiltCards {
  constructor(cards, listen, { reducedMotion = false } = {}) {
    this.cards = cards;
    this.reducedMotion = reducedMotion;
    this.frame = 0;
    this.pending = null;
    this.lit = null;
    this.flush = () => this.#apply();

    for (const card of cards) {
      listen(card, 'pointermove', (e) => this.#queue(card, e));
      listen(card, 'pointerdown', (e) => this.#queue(card, e));
      // On touch, pointerleave fires right after the tap: keep the light until another card is tapped.
      listen(card, 'pointerleave', (e) => { if (e.pointerType === 'mouse') this.#reset(card); });
    }
  }

  #queue(card, e) {
    const r = card.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
    const tilt = e.pointerType === 'mouse' && !this.reducedMotion;
    if (this.lit && this.lit !== card) this.#reset(this.lit);
    this.lit = card;
    this.pending = { card, x, y, tilt };
    if (!this.frame) this.frame = requestAnimationFrame(this.flush);
  }

  #apply() {
    this.frame = 0;
    const p = this.pending;
    if (!p) return;
    const s = p.card.style;
    s.setProperty('--mx', `${(p.x * 100).toFixed(1)}%`);
    s.setProperty('--my', `${(p.y * 100).toFixed(1)}%`);
    s.setProperty('--ry', p.tilt ? `${((p.x - 0.5) * 2 * MAX_TILT).toFixed(2)}deg` : '0deg');
    s.setProperty('--rx', p.tilt ? `${((0.5 - p.y) * 2 * MAX_TILT).toFixed(2)}deg` : '0deg');
    s.setProperty('--lit', '1');
  }

  #reset(card) {
    if (this.pending?.card === card) this.pending = null;
    if (this.lit === card) this.lit = null;
    const s = card.style;
    s.setProperty('--rx', '0deg');
    s.setProperty('--ry', '0deg');
    s.setProperty('--lit', '0');
  }

  destroy() {
    if (this.frame) cancelAnimationFrame(this.frame);
  }
}
