import { gsap, ScrollTrigger } from './Scroll.js';

/**
 * Base class for every page section (chapter).
 *
 * Subclass contract (one file per section: src/sections/<id>/<Name>Section.js):
 *   static id = '<id>'          must match data-section="<id>" on the root element
 *   init()                      build ScrollTriggers / timelines inside this.gsap(() => { ... })
 *   onEnter() / onLeave()       optional, called when the section enters/leaves the viewport
 *   update(dt, time)            optional, called every frame ONLY while visible (interactive canvases)
 *   destroy()                   call super.destroy() if overridden
 *
 * Use this.listen() for DOM events so they are removed automatically,
 * and this.$ / this.$$ for scoped queries.
 */
export class BaseSection {
  static id = '';

  constructor(app, el) {
    this.app = app;
    this.el = el;
    this.device = app.device;
    this.scroll = app.scroll;
    this.visible = false;
    this.reducedMotion = app.device.reducedMotion;
    this.#abort = new AbortController();
    this.#ctx = gsap.context(() => {}, el);
  }

  #abort;
  #ctx;

  get id() { return this.constructor.id; }

  $(sel) { return this.el.querySelector(sel); }
  $$(sel) { return Array.from(this.el.querySelectorAll(sel)); }

  /** Run GSAP code scoped to this section so destroy() reverts it. */
  gsap(fn) { this.#ctx.add(fn); }

  listen(target, type, fn, opts = {}) {
    target.addEventListener(type, fn, { passive: true, ...opts, signal: this.#abort.signal });
  }

  /** Pointer position relative to an element, normalised to -1..1. */
  static pointerIn(el, e) {
    const r = el.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: ((e.clientY - r.top) / r.height) * 2 - 1,
    };
  }

  init() {}
  onEnter() {}
  onLeave() {}
  update() {}

  destroy() {
    this.#abort.abort();
    this.#ctx.revert();
  }
}

export { gsap, ScrollTrigger };
