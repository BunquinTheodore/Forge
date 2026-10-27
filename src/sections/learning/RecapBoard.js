import { Typewriter } from './Typewriter.js';

const MAX_TILT = 10;
const PILE_TOP = 40;      // px reserved for the pile label
const PILE_PAD = 12;
const PILE_ZONE = 0.58;   // chips use the upper part of the pile, the caption types below
const LIVE_START = 'Sorting sample notes into Capture, Structure, Surface possibilities and Return to people.';
const LIVE_DONE = 'Recap sorted into four columns.';

/** Deterministic pseudo random in 0..1 for chip i, so the pile looks composed rather than noisy. */
const hash = (i, salt) => {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * The Generative Recap demo. Note chips live in their final columns in the DOM
 * (so the no-JS and reduced-motion state is complete). With motion, they start
 * scattered across the pile and "Run recap" flies them home column by column
 * while a caption types out what each step does.
 */
export class RecapBoard {
  constructor(root, { gsap, reducedMotion, listen }) {
    this.root = root;
    this.gsap = gsap;
    this.reduced = reducedMotion;
    this.board = root.querySelector('.recap__board');
    this.pile = root.querySelector('.recap__pile');
    this.button = root.querySelector('.recap__run');
    this.live = root.querySelector('.recap__live');
    this.cols = Array.from(root.querySelectorAll('.recap__col'));
    this.chips = Array.from(root.querySelectorAll('.recap__chip'));
    this.typer = new Typewriter(root.querySelector('.recap__caption-text'), gsap, {
      ghost: root.querySelector('.recap__caption-ghost'),
      caret: root.querySelector('.recap__caret'),
    });
    this.pileLabel = root.querySelector('.recap__pile-k');
    this.pileText = {
      idle: this.pileLabel?.textContent ?? '',
      sorted: this.pileLabel?.dataset.sorted ?? '',
    };
    this.raf = 0;
    this.offsets = this.chips.map(() => ({ x: 0, y: 0, r: 0 }));
    this.scattered = false;
    this.hasRun = false;
    this.tl = null;

    listen(this.button, 'click', () => this.run());
    if (!this.reduced) this.#observe();
    else this.#settle();
  }

  #observe() {
    if (typeof ResizeObserver === 'undefined') return;
    this.ro = new ResizeObserver(() => {
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(() => { this.raf = 0; this.#remeasure(); });
    });
    this.ro.observe(this.board);
  }

  /** Compute, for every chip, the offset from its home slot to a spot in the pile. */
  #measure() {
    const { gsap } = this;
    gsap.set(this.chips, { x: 0, y: 0, rotate: 0 });
    const pr = this.pile.getBoundingClientRect();
    const rects = this.chips.map((c) => c.getBoundingClientRect());
    rects.forEach((r, i) => {
      const maxX = Math.max(0, pr.width - r.width);
      const maxY = Math.max(0, pr.height * PILE_ZONE - PILE_TOP - r.height);
      const tx = pr.left + PILE_PAD + hash(i, 1) * Math.max(0, maxX - PILE_PAD * 2);
      const ty = pr.top + PILE_TOP + hash(i, 2) * maxY;
      const o = this.offsets[i];
      o.x = tx - r.left;
      o.y = ty - r.top;
      o.r = (hash(i, 3) - 0.5) * 2 * MAX_TILT;
    });
  }

  /** Only a scattered pile depends on cached offsets; prepare() and run() measure fresh. */
  #remeasure() {
    if (!this.scattered || this.tl?.isActive()) return;
    this.#measure();
    if (this.scattered) this.#applyScatter();
  }

  #applyScatter() {
    this.chips.forEach((c, i) => {
      const o = this.offsets[i];
      this.gsap.set(c, { x: o.x, y: o.y, rotate: o.r });
    });
    this.root.classList.add('is-scattered');
    this.root.classList.remove('is-sorted');
    this.#labelPile(false);
    this.cols.forEach((c) => c.classList.remove('is-on'));
    this.scattered = true;
  }

  /** Initial state when the board first approaches the viewport. */
  prepare() {
    if (this.reduced || this.hasRun || this.scattered) return;
    this.#measure();
    this.#applyScatter();
  }

  #labelPile(sorted) {
    if (!this.pileLabel) return;
    this.pileLabel.textContent = sorted ? this.pileText.sorted : this.pileText.idle;
  }

  #settle() {
    this.root.classList.add('is-sorted');
    this.#labelPile(true);
    this.cols.forEach((c) => c.classList.add('is-on'));
    this.typer.set('Capture, structure, surface possibilities, return to people.');
  }

  #captionFor(col) {
    const k = col.querySelector('.recap__col-k')?.lastChild?.textContent.trim() ?? '';
    const p = col.querySelector('.recap__col-p')?.textContent.trim() ?? '';
    return `${k}. ${p}`;
  }

  run() {
    this.hasRun = true;
    this.button.textContent = 'Run recap again';
    if (this.reduced) {
      this.live.textContent = LIVE_DONE;
      this.#settle();
      return;
    }
    this.tl?.kill();
    this.live.textContent = LIVE_START;
    this.root.classList.add('is-running');
    const tl = this.gsap.timeline({ onComplete: () => this.#done() });
    this.tl = tl;
    this.#addScatter(tl);
    this.cols.forEach((col) => this.#addColumn(tl, col));
  }

  #addScatter(tl) {
    this.#measure();
    if (!this.scattered) {
      this.chips.forEach((c, i) => {
        const o = this.offsets[i];
        tl.to(c, { x: o.x, y: o.y, rotate: o.r, duration: 0.7, ease: 'power3.inOut' }, i * 0.015);
      });
      tl.add(() => this.#applyScatter());
      tl.to({}, { duration: 0.25 });
    } else {
      this.#applyScatter();
    }
    tl.add(() => { this.scattered = false; this.root.classList.remove('is-scattered'); });
  }

  #addColumn(tl, col) {
    const chips = Array.from(col.querySelectorAll('.recap__chip'));
    const label = `col${col.dataset.col}`;
    tl.addLabel(label);
    tl.add(() => col.classList.add('is-on'), label);
    tl.add(this.typer.type(this.#captionFor(col)), label);
    tl.to(chips, {
      x: 0, y: 0, rotate: 0, duration: 0.9, ease: 'expo.out', stagger: 0.09,
    }, `${label}+=0.1`);
    tl.to({}, { duration: 0.35 });
  }

  #done() {
    this.root.classList.remove('is-running');
    this.root.classList.add('is-sorted');
    this.#labelPile(true);
    this.live.textContent = LIVE_DONE;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.tl?.kill();
    this.ro?.disconnect();
  }
}
