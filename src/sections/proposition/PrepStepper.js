const KEY_STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Four step pre-forum preparation stepper.
 * Buttons toggle the active step (accordion on small screens, highlighted column on wide ones).
 * Steps before the active one are "done" and their connector segments fill in sequence.
 * Arrow keys, Home and End move between steps; Previous / Next buttons offer a touch alternative.
 */
export class PrepStepper {
  constructor(root, listen) {
    this.root = root;
    this.steps = Array.from(root.querySelectorAll('.prop__step'));
    this.buttons = this.steps.map((s) => s.querySelector('.prop__step-btn'));
    this.navButtons = Array.from(root.querySelectorAll('.prop__nav-btn'));
    this.position = root.querySelector('.prop__nav-n');
    this.active = 0;

    this.buttons.forEach((btn, i) => {
      listen(btn, 'click', () => this.set(i));
      listen(btn, 'keydown', (e) => this.#key(e, i), { passive: false });
    });
    this.navButtons.forEach((btn) => {
      listen(btn, 'click', () => this.set(this.active + Number(btn.dataset.dir)));
    });
    this.set(0);
  }

  get count() { return this.steps.length; }

  #key(e, i) {
    let next = null;
    if (e.key in KEY_STEP) next = i + KEY_STEP[e.key];
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = this.count - 1;
    if (next === null) return;
    e.preventDefault();
    const clamped = Math.max(0, Math.min(this.count - 1, next));
    this.set(clamped);
    this.buttons[clamped].focus();
  }

  /** Activate step i (clamped). Connector segments fill with a short cascade delay. */
  set(i) {
    const next = Math.max(0, Math.min(this.count - 1, i));
    const from = this.active;
    this.active = next;
    this.steps.forEach((step, k) => {
      const fill = step.querySelector('.prop__seg-fill');
      if (fill) {
        const order = next >= from ? k - from : from - k - 1;
        fill.style.transitionDelay = `${Math.max(0, order) * 0.12}s`;
      }
      step.classList.toggle('is-active', k === next);
      step.classList.toggle('is-done', k < next);
      this.buttons[k].setAttribute('aria-expanded', String(k === next));
      if (k === next) this.buttons[k].setAttribute('aria-current', 'step');
      else this.buttons[k].removeAttribute('aria-current');
    });
    if (this.position) this.position.textContent = String(next + 1);
    if (this.navButtons.length === 2) {
      this.navButtons[0].disabled = next === 0;
      this.navButtons[1].disabled = next === this.count - 1;
    }
  }
}
