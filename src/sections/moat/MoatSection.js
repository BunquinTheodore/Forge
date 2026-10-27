import { BaseSection, gsap, ScrollTrigger } from '../../core/BaseSection.js';
import { Gauge } from './Gauge.js';
import { DataField } from './DataField.js';

const STATES = [
  [35, 'Investor conditions unchanged'],
  [65, 'Investor conditions shifting'],
  [101, 'Ready for the next capital step'],
];
const ANNOUNCE_DELAY = 400;

/**
 * MOAT. Four draggable score dials feed an illustrative "investability" readout,
 * while a 2D dataset canvas organises itself into strata with scroll and score.
 */
export default class MoatSection extends BaseSection {
  static id = 'moat';

  init() {
    this.values = {};
    this.readoutV = this.$('.moat__readout-v');
    this.meter = this.$('.moat__meter-fill');
    this.stateEl = this.$('.moat__readout-state');
    this.liveEl = this.$('.moat__readout-live');
    this.gauges = this.$$('.gauge').map((el) => new Gauge(el, {
      listen: (t, type, fn, opts) => this.listen(t, type, fn, opts),
      onChange: (key, v) => this.#onScore(key, v),
    }));
    this.gauges.forEach((g) => { this.values[g.key] = g.value; });

    this.#initField();
    this.#updateReadout();
    this.#splitScatter();
    this.#entrance();
  }

  #initField() {
    const canvas = this.$('.moat__canvas');
    if (!canvas?.getContext) return;
    this.field = new DataField(canvas, { detail: this.device.detail ?? 1, reducedMotion: this.reducedMotion });
    this.field.setOrder(this.reducedMotion ? 1 : 0);
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        this.field.resize(width, height);
        if (this.reducedMotion) this.field.draw();
      });
      this.ro.observe(canvas);
    }
    if (!this.reducedMotion && !this.device.coarsePointer) {
      this.listen(this.el, 'pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        this.field.setPointer(e.clientX - r.left, e.clientY - r.top);
      });
      this.listen(this.el, 'pointerleave', () => this.field.clearPointer());
    }
  }

  #onScore(key, v) {
    this.values[key] = v;
    this.#updateReadout();
    this.#announce();
  }

  /** Debounced summary for screen readers, so a drag is announced once it pauses. */
  #announce() {
    if (!this.liveEl) return;
    clearTimeout(this.announceTimer);
    this.announceTimer = setTimeout(() => {
      this.liveEl.textContent = `Illustrative investability ${this.#score()} out of 100. ${this.stateEl.textContent}.`;
    }, ANNOUNCE_DELAY);
  }

  /** Geometric mean: one weak score drags the whole result down. Illustrative only. */
  #score() {
    const vals = Object.values(this.values);
    if (!vals.length) return 0;
    const logSum = vals.reduce((s, v) => s + Math.log(Math.max(1, v) / 100), 0);
    return Math.round(Math.exp(logSum / vals.length) * 100);
  }

  #updateReadout() {
    const s = this.#score();
    this.readoutV.textContent = String(s);
    this.meter.style.transform = `scaleX(${s / 100})`;
    const label = STATES.find(([max]) => s < max)[1];
    if (this.stateEl.textContent !== label) this.stateEl.textContent = label;
    this.el.style.setProperty('--moat-heat', String(s / 100));
    this.field?.setTension(s / 100);
    if (this.reducedMotion) this.field?.draw();
  }

  /** Wrap each word of the subline so it can assemble from scattered positions. */
  #splitScatter() {
    const p = this.$('[data-scatter]');
    if (!p) return;
    const text = p.textContent.trim();
    const words = text.split(/\s+/);
    p.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    p.appendChild(sr);
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'moat__word';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = w;
      p.appendChild(span);
      if (i < words.length - 1) p.appendChild(document.createTextNode(' '));
    });
    this.words = this.$$('.moat__word');
  }

  #entrance() {
    if (this.reducedMotion) return;
    this.gsap(() => {
      gsap.from(this.$$('.moat__title .line > span'), {
        yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.12,
        scrollTrigger: { trigger: this.$('.moat__title'), start: 'top 82%' },
      });
      this.#scatterWords();
      this.#sweepGauges();
      gsap.from(this.$$('.moat__readout, .moat__intel'), {
        opacity: 0, x: (i) => (i ? -40 : 40), duration: 1, ease: 'power3.out', stagger: 0.15,
        scrollTrigger: { trigger: this.$('.moat__instrument'), start: 'top 70%' },
      });
      ScrollTrigger.create({
        trigger: this.el, start: 'top bottom', end: 'bottom top',
        onUpdate: (st) => this.field?.setOrder(Math.min(1, Math.max(0, (st.progress - 0.12) / 0.4))),
      });
    });
  }

  #scatterWords() {
    if (!this.words?.length) return;
    const rand = (n) => gsap.utils.random(-n, n);
    gsap.fromTo(this.words, {
      x: () => rand(140), y: () => rand(70), rotate: () => rand(14), opacity: 0,
    }, {
      x: 0, y: 0, rotate: 0, opacity: 1, ease: 'power2.out', stagger: { each: 0.04, from: 'random' },
      scrollTrigger: { trigger: this.$('[data-scatter]'), start: 'top 95%', end: 'top 55%', scrub: 0.8 },
    });
  }

  /** Dials sweep up from zero to their starting values the first time they appear. */
  #sweepGauges() {
    const proxy = { t: 0 };
    this.gauges.forEach((g) => g.render(0));
    gsap.to(proxy, {
      t: 1, duration: 1.6, ease: 'power3.out',
      scrollTrigger: { trigger: this.$('.moat__gauges'), start: 'top 80%', once: true },
      onUpdate: () => this.gauges.forEach((g) => { if (!g.dragging) g.render(g.value * proxy.t); }),
      onComplete: () => this.gauges.forEach((g) => g.render()),
    });
  }

  update(dt) {
    if (!this.field) return;
    this.field.step(dt);
    this.field.draw();
  }

  destroy() {
    this.ro?.disconnect();
    clearTimeout(this.announceTimer);
    super.destroy();
  }
}
