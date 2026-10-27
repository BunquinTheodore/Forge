const SPARK_COUNT = 14;
const IGNITED = 'Working cell formed';
const PARTIAL = 'Anything less is only conversation.';

/**
 * Working Cell rule toggles. Four switches (need, complementary capability, willingness,
 * possible action); only when all four are on does the cell ignite.
 */
export class WorkingCell {
  constructor(root, { listen }) {
    this.root = root;
    this.toggles = Array.from(root.querySelectorAll('.tog'));
    this.arcs = Array.from(root.querySelectorAll('.core__arc'));
    this.status = root.querySelector('[data-status]');
    this.count = root.querySelector('[data-count]');
    this.state = this.toggles.map(() => false);
    this.#buildSparks(root.querySelector('[data-sparks]'));

    this.toggles.forEach((btn, i) => listen(btn, 'click', () => this.toggle(i)));
  }

  #buildSparks(host) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < SPARK_COUNT; i++) {
      const s = document.createElement('i');
      s.className = 'core__spark';
      s.style.setProperty('--a', `${(360 / SPARK_COUNT) * i + (i % 2) * 9}deg`);
      s.style.setProperty('--d', `${(i % 3) * 60}ms`);
      s.style.setProperty('--l', `${0.7 + (i % 4) * 0.12}`);
      frag.appendChild(s);
    }
    host.appendChild(frag);
  }

  toggle(i) {
    this.state[i] = !this.state[i];
    this.render();
  }

  render() {
    let on = 0;
    this.state.forEach((v, i) => {
      if (v) on += 1;
      this.toggles[i].setAttribute('aria-checked', String(v));
      this.toggles[i].classList.toggle('is-on', v);
      this.arcs[i]?.classList.toggle('is-on', v);
    });
    const ignited = on === this.state.length;
    const was = this.root.classList.contains('is-ignited');
    this.root.classList.toggle('is-ignited', ignited);
    this.root.style.setProperty('--charge', String(on / this.state.length));
    this.count.textContent = ignited ? '' : `${on}/${this.state.length}`;
    const text = ignited ? IGNITED : PARTIAL;
    if (this.status.textContent !== text) this.status.textContent = text;
    if (ignited && !was) this.#restartBurst();
  }

  /** Restart the CSS spark burst each time the cell re-forms. */
  #restartBurst() {
    this.root.classList.remove('is-burst');
    // reading layout here is intentional and happens once per ignition, not per frame
    void this.root.offsetWidth;
    this.root.classList.add('is-burst');
  }
}
