const CHARS_PER_SECOND = 78;

/** Types text into an element using a GSAP tween. Touches the DOM only when the visible length changes. */
export class Typewriter {
  constructor(el, gsap) {
    this.el = el;
    this.gsap = gsap;
    this.text = '';
    this.shown = -1;
    this.state = { n: 0 };
  }

  /** Returns a tween that types `text` from empty. Add it to a timeline. */
  type(text) {
    const { gsap } = this;
    return gsap.fromTo(this.state, { n: 0 }, {
      n: text.length,
      duration: Math.max(0.4, text.length / CHARS_PER_SECOND),
      ease: 'none',
      immediateRender: false,
      onStart: () => { this.text = text; this.shown = -1; },
      onUpdate: () => this.#paint(),
    });
  }

  set(text) {
    this.text = text;
    this.state.n = text.length;
    this.shown = -1;
    this.#paint();
  }

  #paint() {
    const n = Math.floor(this.state.n);
    if (n === this.shown) return;
    this.shown = n;
    this.el.textContent = this.text.slice(0, n);
  }
}
