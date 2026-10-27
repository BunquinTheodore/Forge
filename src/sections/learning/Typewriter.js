const CHARS_PER_SECOND = 78;

/**
 * Types text into an element using a GSAP tween. Touches the DOM only when the visible length changes.
 * Optional `ghost` holds the full text invisibly so the caption box keeps its final size while typing,
 * and optional `caret` is moved inside `el`, after a dedicated text node, so it follows the typed text
 * through normal inline flow with no layout reads.
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
    this.node = document.createTextNode('');
    el.textContent = '';
    el.append(this.node);
    if (caret) el.append(caret);
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
    this.node.data = this.text.slice(0, n);
  }
}
