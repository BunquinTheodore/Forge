const ORBIT_SPEED = 34;       // deg per second
const STEP_DEG = 90;

/**
 * The afternoon cycle: Form, Test, Reconfigure, Next step on a loop with an orbiting spark.
 * Purely ambient: the spark circles on its own and lights each step as it passes.
 * Reduced motion keeps the spark parked on the first step.
 */
export class WorkshopLoop {
  constructor(root, reduced) {
    this.reduced = reduced;
    this.orbit = root.querySelector('.loop__orbit');
    this.steps = Array.from(root.querySelectorAll('.programme__step'));
    this.angle = 0;
    this.active = -1;
    this.#setActive(0);
    this.#draw();
  }

  #setActive(i) {
    if (i === this.active) return;
    this.active = i;
    this.steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
  }

  update(dt) {
    if (this.reduced) return;
    this.angle = (this.angle + ORBIT_SPEED * dt) % 360;
    this.#setActive(Math.floor(((this.angle + STEP_DEG * 0.15) % 360) / STEP_DEG));
    this.#draw();
  }

  #draw() {
    this.orbit.style.transform = `rotate(${this.angle.toFixed(2)}deg)`;
  }
}
