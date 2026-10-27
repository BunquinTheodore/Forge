import { BaseSection, gsap } from '../../core/BaseSection.js';
import { ZONES } from './zones.js';
import { ZonePicker } from './ZonePicker.js';

/**
 * ROOM: the FORGE environment, seven zones.
 * Entrance: the floor plan unfolds from a flat top-down drawing into an isometric room,
 * scrubbed by scroll (GL act does the same tilt in 3D; the CSS plan is the no-GL fallback).
 * Signature: legend, tiles and GL pins share one zone selection (section.dataset.zone).
 */
export default class RoomSection extends BaseSection {
  static id = 'room';

  init() {
    this.picker = new ZonePicker(this);
    this.#buildPins();
    this.picker.bind(this.$$('.room__zone, .room__tile, .room__pin'));
    this.#bindLegendKeys();
    this.picker.sync();
    if (this.reducedMotion) return;
    this.gsap(() => this.#animate());
  }

  /** Hit targets the GL act positions over each 3D block. Pointer only; the legend is the keyboard path. */
  #buildPins() {
    const layer = this.$('.room__pins');
    if (!layer) return;
    const frag = document.createDocumentFragment();
    for (const zone of ZONES) {
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'room__pin';
      pin.tabIndex = -1;
      pin.dataset.zone = zone.id;
      const label = document.createElement('span');
      label.className = 'room__pin-label';
      label.textContent = zone.name;
      pin.append(label);
      frag.append(pin);
    }
    layer.append(frag);
  }

  #bindLegendKeys() {
    const buttons = this.$$('.room__zone');
    this.listen(this.$('.room__legend'), 'keydown', (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      const step = keys[e.key];
      if (!step) return;
      const i = buttons.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      buttons[(i + step + buttons.length) % buttons.length].focus();
    }, { passive: false });
  }

  #animate() {
    const el = this.el;

    gsap.from(this.$$('.room__title .line > span'), {
      yPercent: 110, rotate: 3, duration: 1.1, ease: 'expo.out', stagger: 0.12,
      scrollTrigger: { refreshPriority: -10, trigger: el, start: 'top 75%' },
    });

    // Floor plan unfolds: flat drawing to isometric room, scrubbed.
    gsap.fromTo(this.$('.room__plan'),
      { rotateX: 0, rotateZ: 0, scale: 0.86 },
      {
        rotateX: 56, rotateZ: -42, scale: 1, ease: 'none',
        scrollTrigger: { refreshPriority: -10, trigger: this.$('.room__stage'), start: 'top 90%', end: 'center 50%', scrub: 0.6 },
      });

    gsap.from(this.$$('.room__tile'), {
      z: 120, opacity: 0, duration: 0.9, ease: 'back.out(1.6)', stagger: { each: 0.07, from: 'random' },
      clearProps: 'transform,opacity',
      scrollTrigger: { refreshPriority: -10, trigger: this.$('.room__stage'), start: 'top 70%' },
    });

    // Legend routes in like a signal travelling down a wire.
    gsap.from(this.$$('.room__legend li'), {
      x: (i) => 24 + i * 10, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06,
      scrollTrigger: { refreshPriority: -10, trigger: this.$('.room__legend'), start: 'top 80%' },
    });

    gsap.from(this.$$('.room__steps li'), {
      yPercent: 60, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.14,
      scrollTrigger: { refreshPriority: -10, trigger: this.$('.room__simple'), start: 'top 85%' },
    });

    // Background ember pool drifts and swells across the section.
    gsap.fromTo(this.$('.room__glow'), { yPercent: -20, scale: 0.7, opacity: 0.3 }, {
      yPercent: 25, scale: 1.25, opacity: 1, ease: 'none',
      scrollTrigger: { refreshPriority: -10, trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }
}

