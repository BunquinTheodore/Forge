const SAMPLES = 120;
const MID_X = 600;           // viewBox x of the interval column centre
const DESKTOP = '(min-width: 900px)';
const DOT_OFFSET = 34;      // px from a stage's top to the centre of its rail dot (see learning.css)

/**
 * The FORGE 01 to FORGE 02 loop. On wide screens an SVG path draws itself
 * with scroll, a spark travels along it and each stage lights as it is reached.
 * On narrow screens a vertical rail fills instead (transform only).
 */
export class LoopPath {
  constructor(root, { gsap, reducedMotion }) {
    this.root = root;
    this.gsap = gsap;
    this.reduced = reducedMotion;
    this.path = root.querySelector('.learning__path-line');
    this.spark = root.querySelector('.learning__spark');
    this.nodes = Array.from(root.querySelectorAll('.learning__node'));
    this.stages = Array.from(root.querySelectorAll('.learning__stage'));
    this.railFill = root.querySelector('.learning__rail-fill');
    this.len = this.path?.getTotalLength?.() || 0;
    this.midT = this.#findMid();
    this.marks = [0.02, this.midT, 0.97];
    this.railMarks = [0, 0.5, 1];
    this.#placeMidNode();
  }

  /** Path parameter (0..1) where the curve crosses the interval column for the last time. */
  #findMid() {
    if (!this.len) return 0.5;
    let best = 0.5;
    let bestD = Infinity;
    for (let i = 0; i <= SAMPLES; i += 1) {
      const t = 0.3 + (0.4 * i) / SAMPLES;
      const p = this.path.getPointAtLength(t * this.len);
      const d = Math.abs(p.x - MID_X) + Math.abs(p.y - 150) * 0.5;
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  #placeMidNode() {
    const mid = this.nodes[1];
    if (!mid || !this.len) return;
    const p = this.path.getPointAtLength(this.midT * this.len);
    mid.setAttribute('cx', p.x.toFixed(1));
    mid.setAttribute('cy', p.y.toFixed(1));
  }

  #moveSpark(t) {
    if (!this.len || !this.spark) return;
    const p = this.path.getPointAtLength(t * this.len);
    this.spark.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
  }

  /** Marks the stages reached at path progress t. */
  #light(t, marks = this.marks) {
    for (let i = 0; i < marks.length; i += 1) {
      const on = t >= marks[i];
      this.stages[i]?.classList.toggle('is-lit', on);
      this.nodes[i]?.classList.toggle('is-lit', on);
    }
  }

  /** Rail progress at which the fill reaches each stage's dot (read at refresh time only). */
  #measureRail() {
    const rail = this.railFill?.parentElement;
    if (!rail) return;
    const h = rail.offsetHeight || 1;
    this.railMarks = this.stages.map((st) => {
      const dot = st.offsetTop + DOT_OFFSET - rail.offsetTop;
      return Math.min(1, Math.max(0, dot / h));
    });
  }

  build() {
    if (this.reduced) { this.#final(); return; }
    const { gsap } = this;
    const mm = gsap.matchMedia();
    mm.add(DESKTOP, () => this.#desktop());
    mm.add(`not all and ${DESKTOP}`, () => this.#mobile());
    this.mm = mm;
  }

  #final() {
    if (this.path) this.path.style.strokeDashoffset = '0';
    this.#moveSpark(1);
    this.#light(1);
  }

  #desktop() {
    const { gsap } = this;
    const state = { t: 0 };
    const apply = () => {
      this.path.style.strokeDashoffset = String(1 - state.t);
      this.#moveSpark(state.t);
      this.#light(state.t);
    };
    apply();
    gsap.to(state, {
      t: 1, ease: 'none', onUpdate: apply,
      scrollTrigger: { trigger: this.root, start: 'top 78%', end: 'bottom 45%', scrub: 0.6 },
    });
  }

  #mobile() {
    const { gsap } = this;
    const state = { t: 0 };
    const apply = () => {
      this.railFill.style.transform = `scaleY(${state.t})`;
      this.#light(state.t, this.railMarks);
    };
    this.#measureRail();
    apply();
    gsap.to(state, {
      t: 1, ease: 'none', onUpdate: apply,
      scrollTrigger: {
        trigger: this.root, start: 'top 75%', end: 'bottom 60%', scrub: 0.5,
        onRefresh: () => { this.#measureRail(); apply(); },
      },
    });
    return () => { this.railFill.style.transform = ''; };
  }

  destroy() { this.mm?.revert(); }
}
