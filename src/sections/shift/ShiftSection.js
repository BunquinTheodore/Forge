import { BaseSection, gsap } from '../../core/BaseSection.js';
import { ShiftRail } from './ShiftRail.js';
import { ConfigGraph } from './ConfigGraph.js';

const NAMES = ['Founder', 'Capability', 'Investor', 'Market'];

/**
 * SHIFT: FORGE changes the unit of value.
 * Entrance: pinned forged rail lighting the four stages (ShiftRail).
 * Signature: the configuration builder canvas (ConfigGraph) with a keyboard/touch button alternative.
 * Background: ember glows drift with scroll; ShiftAct adds orbit rings around the builder when GL is on.
 */
export default class ShiftSection extends BaseSection {
  static id = 'shift';

  init() {
    this.builder = this.$('.shift__builder');
    this.toggles = this.$$('.shift__toggle');
    this.announce = this.$('.shift__announce');
    this.countNum = this.$('.shift__count-n');
    this.graphOnScreen = false;

    this.gsap(() => {
      this.rail = new ShiftRail(this.el);
      if (this.reducedMotion) return;
      this.#background();
      this.#answer();
    });
    this.#initGraph();
  }

  #background() {
    const scroll = { trigger: this.el, start: 'top bottom', end: 'bottom top', scrub: 1 };
    gsap.fromTo('.shift__glow--a', { yPercent: -15, scale: 0.85 }, { yPercent: 35, scale: 1.15, ease: 'none', scrollTrigger: scroll });
    gsap.fromTo('.shift__glow--b', { yPercent: 25, xPercent: 10 }, { yPercent: -30, xPercent: -10, ease: 'none', scrollTrigger: { ...scroll } });
  }

  /** The verdict: the first sentence cools while the second is forged in from below. */
  #answer() {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: this.$('.shift__answer'), start: 'top 80%', end: 'top 30%', scrub: 0.8 },
    });
    tl.fromTo('.shift__verdict-a > span', { yPercent: 105 }, { yPercent: 0, ease: 'power3.out', duration: 0.4 }, 0)
      .fromTo('.shift__verdict-b > span', { yPercent: 105 }, { yPercent: 0, ease: 'power3.out', duration: 0.4 }, 0.35)
      .to('.shift__verdict-a > span', { opacity: 0.38, duration: 0.3 }, 0.6)
      .fromTo('.shift__bar', { scaleX: 0 }, { scaleX: 1, ease: 'power2.out', duration: 0.4 }, 0.55)
      .fromTo('.shift__note', { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.35 }, 0.7);
  }

  #initGraph() {
    const canvas = this.$('.shift__canvas');
    if (!canvas?.getContext) return;
    this.graph = new ConfigGraph(canvas, {
      reducedMotion: this.reducedMotion,
      onChange: (count, complete, index) => this.#onGraphChange(count, complete, index),
    });
    this.graph.bind((t, type, fn, opts) => this.listen(t, type, fn, opts));

    this.toggles.forEach((btn) => {
      const i = Number(btn.dataset.node);
      this.listen(btn, 'click', () => this.graph.toggle(i));
      this.listen(btn, 'focus', () => this.graph.setFocus(i));
      this.listen(btn, 'blur', () => this.graph.setFocus(-1));
    });
    this.listen(this.$('.shift__reset'), 'click', () => this.graph.reset());

    this.resizeObs = new ResizeObserver(() => this.graph.resize());
    this.resizeObs.observe(canvas);
    this.visObs = new IntersectionObserver(([entry]) => {
      this.graphOnScreen = entry.isIntersecting;
    }, { rootMargin: '80px 0px' });
    this.visObs.observe(canvas);
  }

  #onGraphChange(count, complete, index) {
    this.toggles.forEach((btn, i) => {
      btn.setAttribute('aria-pressed', String(this.graph.nodes[i].connected));
    });
    this.countNum.textContent = String(count);
    this.builder.dataset.complete = String(complete);
    let msg = `${count} of 4 connected.`;
    if (index !== undefined) msg = `${NAMES[index]} ${this.graph.nodes[index].connected ? 'connected' : 'released'}. ${msg}`;
    if (complete) msg += ' Configuration complete.';
    this.announce.textContent = msg;
  }

  update(dt) {
    if (this.graphOnScreen) this.graph?.update(dt);
  }

  destroy() {
    this.rail?.destroy();
    this.resizeObs?.disconnect();
    this.visObs?.disconnect();
    super.destroy();
  }
}
