const ORBIT_SPEED = 34;       // deg per second while free running
const SEEK_RATE = 6;
const STEP_DEG = 90;

/**
 * The afternoon cycle: Form, Test, Reconfigure, Next step on a loop with an orbiting spark.
 * Free running, the spark lights each step as it passes. Hover, focus or tap a step to
 * hold the spark there. Tapping the held step again releases it (touch has no hover).
 */
export class WorkshopLoop {
  constructor(section, root, reduced) {
    this.root = root;
    this.reduced = reduced;
    this.orbit = root.querySelector('.loop__orbit');
    this.buttons = Array.from(root.querySelectorAll('.programme__step-btn'));
    this.descs = Array.from(root.querySelectorAll('.programme__step-desc'));
    this.angle = 0;
    this.drawn = -1;
    this.active = -1;
    this.hover = -1;
    this.pinned = -1;

    this.buttons.forEach((btn, i) => {
      section.listen(btn, 'pointerenter', (e) => { if (e.pointerType === 'mouse') this.hover = i; });
      section.listen(btn, 'pointerleave', (e) => { if (e.pointerType === 'mouse') this.hover = -1; });
      // Keyboard focus holds the spark; focus that comes from a tap or click does not.
      section.listen(btn, 'focus', () => { if (btn.matches(':focus-visible')) this.hover = i; });
      section.listen(btn, 'blur', () => { this.hover = -1; });
      section.listen(btn, 'click', () => { this.pinned = this.pinned === i ? -1 : i; this.#sync(); });
    });
    this.#setActive(0);
    this.#sync();
    this.#draw();
  }

  get held() {
    return this.hover >= 0 ? this.hover : this.pinned;
  }

  #sync() {
    this.buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === this.pinned)));
    this.root.classList.toggle('is-held', this.held >= 0);
  }

  #setActive(i) {
    if (i === this.active) return;
    this.active = i;
    this.root.dataset.step = String(i);
    this.buttons.forEach((b, k) => b.classList.toggle('is-active', k === i));
    this.descs.forEach((d, k) => { d.hidden = k !== i; });
  }

  update(dt) {
    const held = this.held;
    this.root.classList.toggle('is-held', held >= 0);
    if (held >= 0) {
      this.#seek(held * STEP_DEG, dt);
      this.#setActive(held);
    } else if (!this.reduced) {
      this.angle = (this.angle + ORBIT_SPEED * dt) % 360;
      this.#setActive(Math.floor(((this.angle + STEP_DEG * 0.15) % 360) / STEP_DEG));
    }
    if (Math.abs(this.angle - this.drawn) > 0.05) this.#draw();
  }

  /** Move forward (clockwise) to the target angle, the way the cycle flows. */
  #seek(target, dt) {
    let delta = (target - this.angle + 360) % 360;
    if (delta > 270) delta -= 360; // tiny backward correction instead of a full lap
    if (this.reduced) { this.angle = target; return; }
    this.angle = (this.angle + delta * (1 - Math.exp(-SEEK_RATE * dt)) + 360) % 360;
  }

  #draw() {
    this.drawn = this.angle;
    this.orbit.style.transform = `rotate(${this.angle.toFixed(2)}deg)`;
  }
}
