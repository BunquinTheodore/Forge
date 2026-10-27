const DEG_PER_WIDTH = 220;   // dragging across the full globe turns it this many degrees
const KEY_STEP = 18;
const MAX_FLING = 360;       // deg/s
const AXIS_LOCK_PX = 6;

/**
 * Pointer and keyboard spin for the globe layer. Horizontal drags spin, vertical
 * gestures stay with the page (touch-action: pan-y), so touch scrolling is never trapped.
 */
export class GlobeDrag {
  constructor(section, el, controller) {
    this.el = el;
    this.controller = controller;
    this.pointerId = null;
    this.startX = 0;
    this.startY = 0;
    this.lastX = 0;
    this.lastT = 0;
    this.vel = 0;
    this.locked = false;

    section.listen(el, 'pointerdown', (e) => this.#down(e));
    section.listen(el, 'pointermove', (e) => this.#move(e));
    section.listen(el, 'pointerup', (e) => this.#up(e));
    section.listen(el, 'pointercancel', (e) => this.#up(e));
    section.listen(el, 'keydown', (e) => this.#key(e), { passive: false });
  }

  #down(e) {
    if (e.button !== undefined && e.button !== 0) return;
    this.pointerId = e.pointerId;
    this.startX = this.lastX = e.clientX;
    this.startY = e.clientY;
    this.lastT = e.timeStamp;
    this.vel = 0;
    this.locked = false;
  }

  #move(e) {
    if (e.pointerId !== this.pointerId) return;
    if (!this.locked) {
      const dx = Math.abs(e.clientX - this.startX);
      const dy = Math.abs(e.clientY - this.startY);
      if (dx < AXIS_LOCK_PX && dy < AXIS_LOCK_PX) return;
      if (dy > dx) { this.pointerId = null; return; }
      this.locked = true;
      this.el.setPointerCapture?.(e.pointerId);
      this.el.classList.add('is-dragging');
      this.controller.beginDrag();
    }
    const width = this.el.clientWidth || 1;
    const deg = ((e.clientX - this.lastX) / width) * DEG_PER_WIDTH;
    const dt = Math.max(1, e.timeStamp - this.lastT) / 1000;
    this.vel = this.vel * 0.6 + (deg / dt) * 0.4;
    this.lastX = e.clientX;
    this.lastT = e.timeStamp;
    this.controller.dragBy(deg);
  }

  #up(e) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (!this.locked) return;
    this.locked = false;
    this.el.classList.remove('is-dragging');
    const fling = Math.max(-MAX_FLING, Math.min(MAX_FLING, this.vel));
    this.controller.endDrag(fling);
  }

  #key(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    this.controller.dragBy(e.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP);
  }
}
