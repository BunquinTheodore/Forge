/**
 * Measures the globe anchor once per layout change (resize, ScrollTrigger refresh, body resize)
 * and derives its viewport rect from the scroll position every frame, so neither the section
 * nor the GL act forces a layout read inside the frame loop.
 *
 * Handles both layouts: the pinned flight deck (the pin is `position: sticky` inside a tall
 * track) and the stacked flow layout (plain document flow).
 */
export class GlobeGeometry {
  constructor(anchor, pin, track) {
    this.anchor = anchor;
    this.pin = pin;
    this.track = track;
    this.sticky = false;
    this.docTop = 0;       // flow: anchor top in document space
    this.trackTop = 0;     // sticky: track top in document space
    this.trackH = 0;
    this.pinH = 0;
    this.offInPin = 0;     // sticky: anchor top relative to the pin box
    this.vw = 1;
    this.vh = 1;
    this.valid = false;
    // Mutated in place every frame: no per-frame allocations.
    this.rect = { left: 0, top: 0, width: 0, height: 0 };
  }

  /** Layout read. Call only from resize/refresh style events, never per frame. */
  measure() {
    if (!this.anchor) return;
    const y = window.scrollY;
    const g = this.anchor.getBoundingClientRect();
    this.vw = Math.max(1, window.innerWidth);
    this.vh = Math.max(1, window.innerHeight);
    this.sticky = Boolean(this.pin && this.track) && getComputedStyle(this.pin).position === 'sticky';
    if (this.sticky) {
      const p = this.pin.getBoundingClientRect();
      const t = this.track.getBoundingClientRect();
      this.trackTop = t.top + y;
      this.trackH = t.height;
      this.pinH = p.height;
      this.offInPin = g.top - p.top;
    } else {
      this.docTop = g.top + y;
    }
    this.rect.left = g.left;
    this.rect.width = g.width;
    this.rect.height = g.height;
    this.valid = g.width > 0 && g.height > 0;
    this.compute(y);
  }

  /** Pure arithmetic: the anchor's viewport rect at scroll position `y`. */
  compute(y) {
    const r = this.rect;
    if (this.sticky) {
      const trackTopView = this.trackTop - y;
      const pinTop = Math.min(Math.max(trackTopView, 0), trackTopView + this.trackH - this.pinH);
      r.top = pinTop + this.offInPin;
    } else {
      r.top = this.docTop - y;
    }
    return r;
  }
}
