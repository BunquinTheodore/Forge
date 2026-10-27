const SWEEP = 270;          // degrees of arc the dial covers
const START = 135;          // degrees, measured clockwise from 3 o'clock (bottom left)
const ARC_UNITS = 400;      // matches pathLength on the circles
const TICKS = 11;
const STEP = 1;
const PAGE_STEP = 10;
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * One radial score dial. Accessible slider: drag, tap anywhere on the dial,
 * or use arrow / page / home / end keys. Emits onChange(value 0..100).
 */
export class Gauge {
  constructor(el, { onChange, listen }) {
    this.el = el;
    this.key = el.dataset.key;
    this.dial = el.querySelector('.gauge__dial');
    this.arc = el.querySelector('.gauge__arc');
    this.knob = el.querySelector('.gauge__knob');
    this.out = el.querySelector('.gauge__value');
    this.onChange = onChange;
    this.value = Number(el.dataset.value) || 0;
    this.dragging = false;
    this.#buildTicks(el.querySelector('.gauge__ticks'));
    this.#bind(listen);
    this.render();
  }

  #buildTicks(group) {
    if (!group) return;
    for (let i = 0; i < TICKS; i += 1) {
      const line = document.createElementNS(SVG_NS, 'line');
      const a = START + (SWEEP * i) / (TICKS - 1);
      line.setAttribute('x1', '50');
      line.setAttribute('x2', '50');
      line.setAttribute('y1', '2');
      line.setAttribute('y2', i % 5 === 0 ? '7' : '5');
      line.setAttribute('transform', `rotate(${a + 90} 50 50)`);
      group.appendChild(line);
    }
  }

  #bind(listen) {
    const d = this.dial;
    listen(d, 'pointerdown', (e) => this.#onDown(e), { passive: false });
    listen(d, 'pointermove', (e) => this.#onMove(e));
    listen(d, 'pointerup', (e) => this.#onUp(e));
    listen(d, 'pointercancel', (e) => this.#onUp(e));
    listen(d, 'keydown', (e) => this.#onKey(e), { passive: false });
  }

  #onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    this.dragging = true;
    this.el.classList.add('is-active');
    this.dial.setPointerCapture?.(e.pointerId);
    this.dial.focus({ preventScroll: true });
    this.#fromPointer(e);
  }

  #onMove(e) {
    if (this.dragging) this.#fromPointer(e);
  }

  #onUp(e) {
    if (!this.dragging) return;
    this.dragging = false;
    this.el.classList.remove('is-active');
    if (this.dial.hasPointerCapture?.(e.pointerId)) this.dial.releasePointerCapture(e.pointerId);
  }

  #fromPointer(e) {
    const r = this.dial.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    let a = (deg - START + 720) % 360;
    if (a > SWEEP) a = a < SWEEP + (360 - SWEEP) / 2 ? SWEEP : 0;
    this.set((a / SWEEP) * 100);
  }

  #onKey(e) {
    const map = {
      ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP,
      PageUp: PAGE_STEP, PageDown: -PAGE_STEP,
    };
    let next = null;
    if (e.key in map) next = this.value + map[e.key] * (e.shiftKey ? 5 : 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 100;
    if (next === null) return;
    e.preventDefault();
    this.set(next);
  }

  set(v, silent = false) {
    const next = Math.round(Math.min(100, Math.max(0, v)));
    if (next === this.value && !silent) return;
    this.value = next;
    this.render();
    if (!silent) this.onChange?.(this.key, next);
  }

  /** Visual only, used for the entrance sweep (does not change the stored value). */
  render(display = this.value) {
    const t = display / 100;
    this.arc.style.strokeDasharray = `${(t * SWEEP * ARC_UNITS) / 360} ${ARC_UNITS}`;
    this.knob.setAttribute('transform', `rotate(${START + t * SWEEP} 50 50)`);
    this.out.textContent = String(Math.round(display));
    this.dial.setAttribute('aria-valuenow', String(this.value));
    this.dial.setAttribute('aria-valuetext', `${this.value} out of 100`);
  }
}

