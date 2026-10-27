import { SplitFlap } from './SplitFlap.js';

const NS = 'http://www.w3.org/2000/svg';
const C = 100;
const FACE_R = 90;
const END_OF_MORNING = 725; // 12:05, closing the last 40 minute slot
const FOLLOW = 5;

const el = (name, attrs, parent) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent.appendChild(n);
  return n;
};
const polar = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [C + Math.sin(a) * r, C - Math.cos(a) * r];
};
const hourAngle = (min) => ((min / 60) % 12) * 30;
const pad = (n) => String(n).padStart(2, '0');
export const formatTime = (min) => `${pad(Math.floor(min / 60))}:${pad(Math.round(min % 60))}`;
const smooth = (x) => x * x * (3 - 2 * x);

/**
 * Analog clock scrubbed by scroll through the agenda. The hands rest on each
 * slot, then sweep to the next one; a digital readout flips like a departure board.
 */
export class AgendaClock {
  constructor(svg, readTime, readTitle, slots, reduced) {
    this.svg = svg;
    this.slots = slots;            // [{ min, title }]
    this.reduced = reduced;
    this.minutes = slots[0].min;
    this.target = this.minutes;
    this.drawn = -1;
    this.active = -1;
    this.timeFlap = new SplitFlap(readTime);
    this.titleEl = readTitle;
    this.#build();
    this.#draw();
  }

  #build() {
    const face = el('g', { class: 'clock__face' }, this.svg);
    el('circle', { cx: C, cy: C, r: FACE_R, class: 'clock__rim' }, face);
    const [sx, sy] = polar(hourAngle(this.slots[0].min), FACE_R - 13);
    const [ex, ey] = polar(hourAngle(END_OF_MORNING), FACE_R - 13);
    el('path', { d: `M${sx} ${sy}A${FACE_R - 13} ${FACE_R - 13} 0 0 1 ${ex} ${ey}`, class: 'clock__morning' }, face);
    for (let i = 0; i < 60; i += 1) {
      const hour = i % 5 === 0;
      const [x1, y1] = polar(i * 6, FACE_R - (hour ? 9 : 4));
      const [x2, y2] = polar(i * 6, FACE_R - 1);
      el('line', { x1, y1, x2, y2, class: hour ? 'clock__tick clock__tick--h' : 'clock__tick' }, face);
    }
    [9, 10, 11, 12].forEach((h) => {
      const [x, y] = polar(h * 30, FACE_R - 24);
      const t = el('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'clock__num' }, face);
      t.textContent = String(h);
    });
    this.marks = this.slots.map((s) => {
      const [x, y] = polar(hourAngle(s.min), FACE_R - 13);
      return el('circle', { cx: x, cy: y, r: 3.2, class: 'clock__mark' }, face);
    });
    this.hourHand = el('line', { x1: C, y1: C + 8, x2: C, y2: C - 44, class: 'clock__hand clock__hand--h' }, this.svg);
    this.minHand = el('line', { x1: C, y1: C + 12, x2: C, y2: C - 70, class: 'clock__hand clock__hand--m' }, this.svg);
    el('circle', { cx: C, cy: C, r: 4, class: 'clock__pin' }, this.svg);
  }

  /** p: 0..1 through the agenda list. */
  setProgress(p) {
    const n = this.slots.length;
    const x = Math.min(n - 0.0001, Math.max(0, p * n));
    const i = Math.floor(x);
    const from = this.slots[i].min;
    const to = i + 1 < n ? this.slots[i + 1].min : END_OF_MORNING;
    // Rest on the slot for the first half of its band, then travel.
    const travel = smooth(Math.min(1, Math.max(0, (x - i - 0.5) / 0.5)));
    this.target = this.reduced ? from : from + (to - from) * travel;
    this.setActive(i);
  }

  setActive(i, { animate = !this.reduced } = {}) {
    if (i === this.active) return;
    this.active = i;
    this.marks.forEach((m, k) => m.classList.toggle('is-on', k <= i));
    this.timeFlap.set(formatTime(this.slots[i].min), { animate, duration: 0.45 });
    this.titleEl.textContent = this.slots[i].title;
  }

  /** Jump the hands straight to a slot (accordion click). */
  focusSlot(i) {
    this.target = this.slots[i].min;
    this.setActive(i);
  }

  update(dt) {
    const k = this.reduced ? 1 : 1 - Math.exp(-FOLLOW * dt);
    this.minutes += (this.target - this.minutes) * k;
    if (Math.abs(this.minutes - this.drawn) < 0.02) return;
    this.#draw();
  }

  #draw() {
    this.drawn = this.minutes;
    this.hourHand.style.transform = `rotate(${hourAngle(this.minutes).toFixed(2)}deg)`;
    this.minHand.style.transform = `rotate(${((this.minutes % 60) * 6).toFixed(2)}deg)`;
  }

  destroy() {
    this.timeFlap.kill();
  }
}
