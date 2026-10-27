/**
 * Draggable bridge slider (pointer, touch and keyboard).
 * The handle is a role="slider" button. Pointer drags anywhere on the track, arrow keys step 5%,
 * PageUp/PageDown step 20%, Home/End jump. Calls onChange(value 0..1) whenever the value moves.
 */
const STEP = 0.05;
const PAGE = 0.2;

export class Bridge {
  constructor(track, handle, listen, onChange) {
    this.track = track;
    this.handle = handle;
    this.onChange = onChange;
    this.value = 0;
    this.touched = false;
    this.dragging = false;
    this.pointerId = null;

    listen(track, 'pointerdown', (e) => this.#down(e), { passive: false });
    listen(track, 'pointermove', (e) => this.#move(e));
    listen(track, 'pointerup', (e) => this.#up(e));
    listen(track, 'pointercancel', (e) => this.#up(e));
    listen(handle, 'keydown', (e) => this.#key(e), { passive: false });
  }

  #down(e) {
    if (e.button > 0) return;
    e.preventDefault();
    this.dragging = true;
    this.pointerId = e.pointerId;
    this.track.setPointerCapture?.(e.pointerId);
    this.track.classList.add('is-dragging');
    this.handle.focus({ preventScroll: true });
    this.#fromPointer(e);
  }

  #move(e) {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    this.#fromPointer(e);
  }

  #up(e) {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.track.releasePointerCapture?.(e.pointerId);
    this.track.classList.remove('is-dragging');
  }

  #fromPointer(e) {
    const r = this.track.getBoundingClientRect();
    const inset = this.handle.offsetWidth / 2;
    const usable = Math.max(1, r.width - inset * 2);
    this.set((e.clientX - r.left - inset) / usable, true);
  }

  #key(e) {
    const map = {
      ArrowRight: this.value + STEP, ArrowUp: this.value + STEP,
      ArrowLeft: this.value - STEP, ArrowDown: this.value - STEP,
      PageUp: this.value + PAGE, PageDown: this.value - PAGE,
      Home: 0, End: 1,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    this.set(map[e.key], true);
  }

  /** Set the value (clamped). fromUser marks the bridge as touched so auto-close never overrides the visitor. */
  set(v, fromUser = false) {
    const value = Math.min(1, Math.max(0, v));
    if (fromUser) this.touched = true;
    if (Math.abs(value - this.value) < 1e-4 && value !== 0 && value !== 1) return;
    this.value = value;
    const pct = Math.round(value * 100);
    this.handle.setAttribute('aria-valuenow', String(pct));
    let text = `Gap ${100 - pct}% open`;
    if (pct === 0) text = 'Gap open';
    else if (pct === 100) text = 'Gap closed';
    this.handle.setAttribute('aria-valuetext', text);
    this.onChange(value);
  }
}
