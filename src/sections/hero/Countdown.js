const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const EVENT_LENGTH = 8 * HOUR; // 10:00 to 18:00

const pad = (n, width = 2) => String(n).padStart(width, '0');

/**
 * Live countdown to the forum. Reads the target from data-countdown (ISO 8601 with offset),
 * updates once a second while the tab is visible, and switches its label once the event starts.
 */
export class Countdown {
  constructor(root) {
    this.root = root;
    this.target = Date.parse(root.dataset.countdown);
    this.label = root.querySelector('[data-cd-label]');
    this.cells = new Map(Array.from(root.querySelectorAll('[data-unit]')).map((el) => [el.dataset.unit, el]));
    this.timer = 0;
    this.shown = {};
    this.onVisibility = () => (document.hidden ? this.stop() : this.start());
    if (Number.isNaN(this.target)) return;
    this.render();
    this.start();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  start() {
    this.stop();
    this.render();
    this.timer = setInterval(() => this.render(), SECOND);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
  }

  render() {
    const left = this.target - Date.now();
    const live = left <= 0;
    const rest = Math.max(0, left);
    this.set('days', pad(Math.floor(rest / DAY), 2));
    this.set('hours', pad(Math.floor((rest % DAY) / HOUR)));
    this.set('minutes', pad(Math.floor((rest % HOUR) / MINUTE)));
    this.set('seconds', pad(Math.floor((rest % MINUTE) / SECOND)));
    if (this.label) {
      if (!live) this.label.textContent = 'Countdown to the forum';
      else this.label.textContent = -left < EVENT_LENGTH ? 'FORGE PH 2027 is live today' : 'FORGE PH 2027 has taken place';
    }
    this.root.classList.toggle('is-live', live);
    this.root.setAttribute('aria-label', live ? 'FORGE PH 2027 has started' : `${this.shown.days} days, ${this.shown.hours} hours and ${this.shown.minutes} minutes until FORGE PH 2027`);
  }

  set(unit, text) {
    if (this.shown[unit] === text) return;
    this.shown[unit] = text;
    const el = this.cells.get(unit);
    if (!el) return;
    el.textContent = text;
    if (unit === 'seconds') {
      el.classList.remove('is-tick');
      void el.offsetWidth;
      el.classList.add('is-tick');
    }
  }

  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
