const PX_PER_SECOND = 48;

/**
 * Infinite principles marquee. Duplicates the chip list once (hidden from assistive tech),
 * runs a CSS transform animation, pauses on hover / focus (CSS), via the pause button,
 * and while the section is off screen. Static and wrapped under reduced motion.
 */
export class PrincipleMarquee {
  constructor(section, root) {
    this.section = section;
    this.root = root;
    this.track = root?.querySelector('.trust__track');
    this.list = root?.querySelector('.trust__chips');
    this.button = section.$('.trust__pause');
    this.userPaused = false;
    this.visible = false;
  }

  init() {
    if (!this.track || !this.list || this.section.reducedMotion) return;
    const clone = this.list.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    this.track.appendChild(clone);
    this.#measure();
    this.section.listen(window, 'resize', () => this.#measure());

    if (this.button) {
      this.button.hidden = false;
      this.section.listen(this.button, 'click', () => this.#toggle());
    }
    this.track.classList.add('is-running');
    this.#sync();
  }

  /** Constant speed regardless of chip width or font size. */
  #measure() {
    const width = this.list.getBoundingClientRect().width;
    const seconds = Math.max(18, width / PX_PER_SECOND);
    this.track.style.setProperty('--marquee-dur', `${seconds.toFixed(1)}s`);
  }

  #toggle() {
    this.userPaused = !this.userPaused;
    this.button.setAttribute('aria-pressed', String(this.userPaused));
    this.button.textContent = this.userPaused ? 'Play' : 'Pause';
    this.#sync();
  }

  setVisible(visible) {
    this.visible = visible;
    this.#sync();
  }

  #sync() {
    if (!this.track) return;
    this.track.classList.toggle('is-paused', this.userPaused || !this.visible);
  }
}
