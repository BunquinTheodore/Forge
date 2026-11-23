import { BaseSection } from '../../core/BaseSection.js';
import { gsap } from '../../core/Scroll.js';
import { rise, lines, onceVisible } from '../../core/reveal.js';

const CYCLE_MS = 3600;   // time each participant stays lit while the map plays on its own
const CORE = { x: 50, y: 50 };

/**
 * WHY FORGE: a connection map. A bright line draws from the lit participant into FORGE, a spark travels
 * along it and the core sends out a ring when it lands. Hover or focus a participant to light it;
 * left alone, the map cycles through the four, and stops while it is off screen.
 */
export default class WhySection extends BaseSection {
  static id = 'why';

  init() {
    this.nodes = this.$$('[data-node]');
    this.lit = new Map(this.$$('.why__line').map((l) => [l.dataset.for, l]));
    this.halos = new Map(this.$$('.why__halo').map((l) => [l.dataset.for, l]));
    this.spark = this.$('.why__spark');
    this.pulse = this.$('.why__pulse');
    this.index = -1;
    this.hovering = false;
    this.timer = 0;
    this.timeline = null;

    for (const node of this.nodes) {
      this.listen(node, 'pointerenter', () => this.#hold(node));
      this.listen(node, 'pointerleave', () => this.#release());
    }

    if (this.reducedMotion) { this.#light(0); return; }

    this.gsap(() => {
      lines(this.$('.why__title'), this.el);
      rise(this.$$('.why__lead, .why__text, .why__cta'), this.$('.why__copy'), { delay: 0.2 });
      rise(this.$$('.why__node, .why__core'), this.$('.why__map'), { y: 0, stagger: 0.1, duration: 0.8, start: 'top 80%' });
      onceVisible(this.$('.why__map'), 'top 78%', () => this.#light(0));
    });
  }

  onEnter() { this.#start(); }
  onLeave() { this.#stop(); }

  #start() {
    if (this.reducedMotion || this.timer || this.hovering) return;
    this.timer = setInterval(() => this.#light((this.index + 1) % this.nodes.length), CYCLE_MS);
  }

  #stop() {
    clearInterval(this.timer);
    this.timer = 0;
  }

  #hold(node) {
    this.hovering = true;
    this.#stop();
    this.#light(this.nodes.indexOf(node));
  }

  #release() {
    this.hovering = false;
    if (this.visible) this.#start();
  }

  /** Light participant i: labels and dots change at once, the connection plays as one short timeline. */
  #light(i) {
    if (i === this.index) return;
    const previous = this.nodes[this.index]?.dataset.node;
    this.index = i;
    const node = this.nodes[i];
    const key = node.dataset.node;
    this.nodes.forEach((n, k) => n.classList.toggle('is-on', k === i));

    if (this.reducedMotion) {
      this.lit.forEach((line, k) => line.classList.toggle('is-on', k === key));
      this.halos.forEach((line, k) => line.classList.toggle('is-on', k === key));
      return;
    }

    this.timeline?.kill();
    const line = this.lit.get(key);
    const halo = this.halos.get(key);
    const from = { x: Number(node.dataset.x), y: Number(node.dataset.y) };
    const tl = gsap.timeline();
    if (previous) {
      tl.to([this.lit.get(previous), this.halos.get(previous)], { opacity: 0, duration: 0.5, ease: 'power2.out' }, 0);
    }
    tl.set([line, halo], { strokeDashoffset: 1 }, 0)
      .to(line, { opacity: 1, duration: 0.15 }, 0)
      .to(halo, { opacity: 0.18, duration: 0.3 }, 0)
      .to([line, halo], { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 0)
      .fromTo(this.spark, { attr: { cx: from.x, cy: from.y }, opacity: 1 }, { attr: { cx: CORE.x, cy: CORE.y }, duration: 0.9, ease: 'power2.inOut' }, 0)
      .to(this.spark, { opacity: 0, duration: 0.2, ease: 'none' }, 0.8)
      .fromTo(this.pulse, { scale: 1, opacity: 0.7 }, { scale: 2.1, opacity: 0, duration: 1.1, ease: 'power2.out' }, 0.85);
    this.timeline = tl;
  }

  destroy() {
    this.#stop();
    this.timeline?.kill();
    super.destroy();
  }
}
