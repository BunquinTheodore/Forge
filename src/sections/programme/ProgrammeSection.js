import { BaseSection, gsap, ScrollTrigger } from '../../core/BaseSection.js';
import { AgendaClock } from './AgendaClock.js';
import { AgendaAccordion } from './AgendaAccordion.js';
import { WorkshopLoop } from './WorkshopLoop.js';
import { SplitFlap } from './SplitFlap.js';

const NS = 'http://www.w3.org/2000/svg';
const DIAL_TICKS = 120;

/**
 * PROGRAMME: cream paper sheet in the programme document style.
 * Entrance: the sheet is laid down (scales flat) and every time flips in like a departures board.
 * Signature: a scroll-scrubbed analog clock that walks the morning agenda; an orbiting workshop loop.
 */
export default class ProgrammeSection extends BaseSection {
  static id = 'programme';

  init() {
    this.items = this.$$('.programme__slot');
    const slots = this.items.map((li) => ({
      min: Number(li.dataset.min),
      title: li.querySelector('.programme__name').textContent.trim(),
    }));
    this.clock = new AgendaClock(
      this.$('.programme__clock-svg'),
      this.$('.programme__now'),
      this.$('.programme__now-title'),
      slots,
      this.reducedMotion,
    );
    this.accordion = new AgendaAccordion(this, this.items, (i, open) => { if (open) this.clock.focusSlot(i); });
    this.loop = new WorkshopLoop(this, this.$('.programme__loop'), this.reducedMotion);
    this.flaps = this.$$('[data-flap]').map((el) => new SplitFlap(el));
    this.#buildDial();
    this.clock.setActive(0, { animate: false });
    this.gsap(() => this.#scrollWork());
  }

  /** Background: a huge faint dial ring that turns with the page. */
  #buildDial() {
    const svg = this.$('.programme__dial');
    for (let i = 0; i < DIAL_TICKS; i += 1) {
      const a = (i / DIAL_TICKS) * Math.PI * 2;
      const long = i % 10 === 0;
      const r1 = long ? 80 : 88;
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', (100 + Math.sin(a) * r1).toFixed(2));
      line.setAttribute('y1', (100 - Math.cos(a) * r1).toFixed(2));
      line.setAttribute('x2', (100 + Math.sin(a) * 96).toFixed(2));
      line.setAttribute('y2', (100 - Math.cos(a) * 96).toFixed(2));
      if (long) line.setAttribute('class', 'is-long');
      svg.appendChild(line);
    }
  }

  #scrollWork() {
    const list = this.$('.programme__agenda');
    ScrollTrigger.create({
      trigger: list,
      start: 'top 62%',
      end: 'bottom 62%',
      onUpdate: (self) => this.#onAgenda(self.progress),
      onRefresh: (self) => this.#onAgenda(self.progress),
    });
    if (this.reducedMotion) return;

    this.#entrance();
    gsap.fromTo(this.$('.programme__rail-fill'), { scaleY: 0 }, {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: list, start: 'top 62%', end: 'bottom 62%', scrub: true },
    });
    gsap.fromTo(this.$('.programme__dial'), { rotate: -40 }, {
      rotate: 50, ease: 'none',
      scrollTrigger: { trigger: this.el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }

  #onAgenda(p) {
    this.clock.setProgress(p);
    const active = this.clock.active;
    this.items.forEach((li, i) => li.classList.toggle('is-active', i === active));
  }

  /** The sheet lands flat, rules typeset across, times flip. */
  #entrance() {
    gsap.fromTo(this.$('.programme__sheet'), { scaleX: 0.92, y: 60 }, {
      scaleX: 1, y: 0, ease: 'none',
      scrollTrigger: { trigger: this.el, start: 'top bottom', end: 'top 15%', scrub: 0.5 },
    });
    gsap.fromTo(this.$('.programme__spine'), { scaleY: 0 }, {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: this.el, start: 'top 85%', end: 'top 10%', scrub: 0.5 },
    });
    gsap.fromTo(this.$$('.programme__slot'), { '--rule': 0 }, {
      '--rule': 1, ease: 'power2.out', duration: 1.1, stagger: 0.09,
      scrollTrigger: { trigger: this.$('.programme__agenda'), start: 'top 82%', once: true },
    });
    ScrollTrigger.create({
      trigger: this.$('.programme__head'),
      start: 'top 78%',
      once: true,
      onEnter: () => this.#flipAll(),
    });
    this.#loopEntrance();
  }

  #flipAll() {
    this.flaps.forEach((flap, i) => {
      flap.set(flap.el.textContent, { duration: i === 0 ? 1 : 0.6, delay: i === 0 ? 0 : 0.25 + i * 0.09 });
    });
  }

  /** Loop draws itself around once as it arrives. */
  #loopEntrance() {
    const track = this.$('.loop__track');
    const steps = this.$$('.programme__step-btn');
    const tl = gsap.timeline({
      scrollTrigger: { trigger: this.$('.programme__loop'), start: 'top 80%', end: 'top 35%', scrub: 0.6 },
    });
    tl.fromTo(track, { strokeDashoffset: 754 }, { strokeDashoffset: 0, ease: 'none', duration: 1 }, 0)
      .fromTo(steps, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, stagger: 0.18, duration: 0.3, ease: 'back.out(2)' }, 0.1);
  }

  update(dt) {
    this.clock.update(dt);
    this.loop.update(dt);
  }

  destroy() {
    this.clock.destroy();
    this.flaps.forEach((f) => f.kill());
    super.destroy();
  }
}
