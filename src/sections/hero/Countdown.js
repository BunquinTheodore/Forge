const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Live countdown to the event start. Ticks only when asked (from the section's update loop,
 * which runs only while the hero is visible) and writes to the DOM only when a digit changes.
 * After the start time it switches to a static "the forum opened" line.
 */
export class Countdown {
  constructor(root) {
    this.root = root;
    this.target = Date.parse(root.dataset.target);
    this.units = {
      d: root.querySelector('[data-unit="d"]'),
      h: root.querySelector('[data-unit="h"]'),
      m: root.querySelector('[data-unit="m"]'),
      s: root.querySelector('[data-unit="s"]'),
    };
    this.label = root.querySelector('[data-count-label]');
    this.done = root.querySelector('[data-count-done]');
    this.timer = root.querySelector('[role="timer"]');
    this.last = { d: '', h: '', m: '', s: '' };
    this.live = false;
    this.acc = 1;
    this.render();
  }

  /** Call every frame; renders at most once per second. */
  tick(dt) {
    if (this.live) return;
    this.acc += dt;
    if (this.acc < 1) return;
    this.acc = 0;
    this.render();
  }

  render() {
    if (Number.isNaN(this.target)) return;
    const left = this.target - Date.now();
    if (left <= 0) { this.#goLive(); return; }
    this.#set('d', Math.floor(left / DAY));
    this.#set('h', Math.floor((left % DAY) / HOUR));
    this.#set('m', Math.floor((left % HOUR) / MINUTE));
    this.#set('s', Math.floor((left % MINUTE) / SECOND));
    this.timer.setAttribute('aria-label', `${this.last.d} days, ${this.last.h} hours, ${this.last.m} minutes until the forum opens`);
  }

  #set(key, value) {
    const text = String(value).padStart(2, '0');
    if (this.last[key] === text) return;
    this.last[key] = text;
    this.units[key].textContent = text;
  }

  #goLive() {
    this.live = true;
    this.root.classList.add('is-live');
    if (this.label) this.label.hidden = true;
    if (this.done) this.done.hidden = false;
  }
}
