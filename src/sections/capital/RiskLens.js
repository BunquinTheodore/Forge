const FOLLOW = 14;         // follow stiffness (per second)
const KEY_STEP = 0.06;    // keyboard step as a fraction of the panel size

/**
 * The risk lens: a circular lens over a blurred, noisy panel. Inside the lens the
 * same sheet is rendered sharp, so the structure (known / unknown / still to be
 * demonstrated) comes into focus wherever the lens sits.
 * Pure transforms: the lens moves by translate, its inner sheet counter-translates.
 * Fine pointers: follows the pointer. Touch: drag the lens or tap to place it. Keys: arrows.
 */
export class RiskLens {
  constructor(section) {
    this.section = section;
    this.panel = section.$('.capital__panel');
    this.lens = section.$('.capital__lens');
    this.inner = section.$('.capital__lens-inner');
    this.sheet = section.$('.capital__sheet');
    this.reveal = section.$('.capital__reveal');
    if (!this.panel || !this.lens || !this.inner || !this.sheet) return;

    this.ok = true;
    this.inner.append(this.sheet.cloneNode(true));
    this.pos = { x: 0.5, y: 0.5 };
    this.target = { x: 0.5, y: 0.5 };
    this.size = { w: 1, h: 1, lens: 1 };
    this.dragging = false;
    this.pointerId = null;
    this.dirty = true;
    this.#bind();
    this.measure();
  }

  #bind() {
    const s = this.section;
    if ('ResizeObserver' in window) {
      this.observer = new ResizeObserver(() => this.measure());
      this.observer.observe(this.panel);
    } else {
      s.listen(window, 'resize', () => this.measure());
    }
    s.listen(this.panel, 'pointermove', (e) => this.#onMove(e));
    s.listen(this.panel, 'pointerdown', (e) => this.#onDown(e));
    s.listen(this.panel, 'pointerup', (e) => this.#onUp(e));
    s.listen(this.panel, 'pointercancel', (e) => this.#onUp(e));
    s.listen(this.lens, 'keydown', (e) => this.#onKey(e), { passive: false });
    if (this.reveal) s.listen(this.reveal, 'click', () => this.#toggleClear());
  }

  measure() {
    if (!this.ok) return;
    const w = this.panel.clientWidth;
    const h = this.panel.clientHeight;
    this.size.w = Math.max(1, w);
    this.size.h = Math.max(1, h);
    this.size.lens = this.lens.offsetWidth || 160;
    this.inner.style.width = `${w}px`;
    this.inner.style.height = `${h}px`;
    this.dirty = true;
  }

  #setTargetFromEvent(e) {
    const r = this.panel.getBoundingClientRect();
    this.target.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    this.target.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  }

  #onMove(e) {
    if (e.pointerType === 'touch' && (!this.dragging || e.pointerId !== this.pointerId)) return;
    this.#setTargetFromEvent(e);
  }

  #onDown(e) {
    if (this.dragging) return;
    this.#setTargetFromEvent(e);
    if (e.pointerType !== 'touch') this.#announce();
    if (e.pointerType !== 'touch') return;
    if (e.target === this.lens || this.lens.contains(e.target)) {
      this.dragging = true;
      this.pointerId = e.pointerId;
      this.panel.setPointerCapture?.(e.pointerId);
    }
  }

  #onUp(e) {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
    if (this.panel.hasPointerCapture?.(e.pointerId)) this.panel.releasePointerCapture(e.pointerId);
    this.#announce();
  }

  #onKey(e) {
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    this.target.x = Math.min(1, Math.max(0, this.target.x + m[0] * KEY_STEP));
    this.target.y = Math.min(1, Math.max(0, this.target.y + m[1] * KEY_STEP));
    this.#announce();
  }

  #announce() {
    const col = ['Known', 'Unknown', 'Still to be demonstrated'][Math.min(2, Math.floor(this.target.x * 3))];
    this.lens.setAttribute('aria-valuenow', String(Math.round(this.target.x * 100)));
    this.lens.setAttribute('aria-valuetext', `Focused on ${col}`);
  }

  #toggleClear() {
    const on = !this.panel.classList.contains('is-clear');
    this.panel.classList.toggle('is-clear', on);
    this.reveal.setAttribute('aria-pressed', String(on));
    this.reveal.textContent = on ? 'Return to the lens' : 'Show everything in focus';
    const lensHadFocus = document.activeElement === this.lens;
    this.lens.tabIndex = on ? -1 : 0;
    if (on) this.lens.setAttribute('aria-hidden', 'true');
    else this.lens.removeAttribute('aria-hidden');
    if (on && lensHadFocus) this.reveal.focus();
  }

  destroy() {
    this.observer?.disconnect();
  }

  /** Per frame while the section is visible. */
  update(dt, snap) {
    if (!this.ok) return;
    const k = snap ? 1 : 1 - Math.exp(-dt * FOLLOW);
    const dx = this.target.x - this.pos.x;
    const dy = this.target.y - this.pos.y;
    if (!this.dirty && Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) return;
    this.pos.x += dx * k;
    this.pos.y += dy * k;
    this.dirty = false;
    const half = this.size.lens / 2;
    const x = this.pos.x * this.size.w - half;
    const y = this.pos.y * this.size.h - half;
    this.lens.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    this.inner.style.transform = `translate3d(${(-x).toFixed(1)}px,${(-y).toFixed(1)}px,0)`;
  }
}
