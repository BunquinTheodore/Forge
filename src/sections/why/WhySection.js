import { BaseSection } from '../../core/BaseSection.js';
import { gsap } from '../../core/Scroll.js';
import { rise, lines } from '../../core/reveal.js';

const CYCLE_MS = 2600;

/**
 * WHY FORGE: a connection map. Hover or focus a participant to light its link to FORGE;
 * left alone, the map cycles through the four so it always reads as alive.
 */
export default class WhySection extends BaseSection {
  static id = 'why';

  init() {
    this.nodes = this.$$('[data-node]');
    this.links = new Map(this.$$('[data-for]').map((l) => [l.dataset.for, l]));
    this.index = -1;
    this.hovering = false;
    this.timer = 0;

    for (const node of this.nodes) {
      this.listen(node, 'pointerenter', () => this.#hold(node));
      this.listen(node, 'focus', () => this.#hold(node));
      this.listen(node, 'pointerleave', () => this.#release());
      this.listen(node, 'blur', () => this.#release());
    }
    this.#light(0);

    if (this.reducedMotion) return;
    this.gsap(() => {
      lines(this.$('.why__title'), this.el);
      rise(this.$$('.why__lead, .why__text, .why__cta'), this.$('.why__copy'), { delay: 0.2 });
      gsap.from(this.$$('.why__line'), {
        strokeDashoffset: 1, strokeDasharray: 1, duration: 1.2, stagger: 0.15, ease: 'power2.out',
        scrollTrigger: { trigger: this.$('.why__map'), start: 'top 78%', once: true },
      });
      gsap.from(this.$$('.why__node, .why__core'), {
        opacity: 0, scale: 0.85, duration: 0.8, stagger: 0.12, ease: 'back.out(1.8)',
        scrollTrigger: { trigger: this.$('.why__map'), start: 'top 78%', once: true },
      });
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

  #light(i) {
    this.index = i;
    this.nodes.forEach((n, k) => n.classList.toggle('is-on', k === i));
    const active = this.nodes[i]?.dataset.node;
    this.links.forEach((line, key) => line.classList.toggle('is-on', key === active));
  }

  destroy() {
    this.#stop();
    super.destroy();
  }
}
