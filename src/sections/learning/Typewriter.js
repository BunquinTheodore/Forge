const CHARS_PER_SECOND = 78;

/**
 * Types text into an element using a GSAP tween. Touches the DOM only when the visible length changes.
 * Optional `ghost` holds the full text invisibly so the caption box keeps its final size while typing,
 * and optional `caret` is moved with a transform to the end of the typed text (no layout shift).
 */
export class Typewriter {
  constructor(el, gsap, { ghost = null, caret = null } = {}) {
    this.el = el;
    this.gsap = gsap;
    this.ghost = ghost;
    this.caret = caret;
    this.text = '';
    this.shown = -1;
    this.state = { n: 0 };
    this.range = typeof document !== 'undefined' ? document.createRange() : null;
  }

  /** Returns a tween that types `text` from empty. Add it to a timeline. */
  type(text) {
    const { gsap } = this;
    return gsap.fromTo(this.state, { n: 0 }, {
      n: text.length,
      duration: Math.max(0.4, text.length / CHARS_PER_SECOND),
      ease: 'none',
      immediateRender: false,
      onStart: () => this.#begin(text),
      onUpdate: () => this.#paint(),
    });
  }

  set(text) {
    this.#begin(text);
    this.state.n = text.length;
    this.#paint();
  }

  #begin(text) {
    this.text = text;
    this.shown = -1;
    if (this.ghost) this.ghost.textContent = text;
  }

  #paint() {
    const n = Math.floor(this.state.n);
    if (n === this.shown) return;
    this.shown = n;
    this.el.textContent = this.text.slice(0, n);
    this.#placeCaret();
  }

  /** Moves the caret to the right edge of the last typed line box. */
  #placeCaret() {
    const { caret, el, range } = this;
    const box = caret?.offsetParent;
    if (!caret || !range || !box) return;
    let x = 0;
    let y = 0;
    if (el.firstChild) {
      range.selectNodeContents(el);
      const rects = range.getClientRects();
      const last = rects[rects.length - 1];
      if (last) {
        const origin = box.getBoundingClientRect();
        x = last.right - origin.left;
        y = last.top - origin.top + (last.height - caret.offsetHeight) / 2;
      }
    }
    caret.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }
}
