/**
 * The "core idea" comparison row: Accelerators / Venture studios / VCs / FORGE.
 * An accessible tablist (roving tabindex, arrow keys, Home/End) that morphs the SVG diagram
 * through a data-mode attribute and rewrites the one-line readout from the source sentence.
 */
const MODES = {
  acc: { who: 'Accelerators', what: 'improve startups.' },
  studio: { who: 'Venture studios', what: 'build startups.' },
  vc: { who: 'VCs', what: 'fund startups.' },
  forge: { who: 'FORGE', what: 'would design, finance and test the temporary configuration that changes the risk.' },
};

export class CompareTabs {
  /**
   * @param {HTMLElement} section  section root, receives data-mode for the GL act
   * @param {(target: EventTarget, type: string, fn: Function, opts?: object) => void} listen
   */
  constructor(section, listen) {
    this.section = section;
    this.tabs = Array.from(section.querySelectorAll('.thesis__tab'));
    this.panel = section.querySelector('.thesis__panel');
    this.diagram = section.querySelector('.thesis__diagram');
    this.who = section.querySelector('.thesis__verb-who');
    this.what = section.querySelector('.thesis__verb-what');
    this.readout = section.querySelector('[data-readout]');
    this.current = 'forge';

    this.tabs.forEach((tab, i) => {
      listen(tab, 'click', () => this.select(tab.dataset.mode, false));
      listen(tab, 'keydown', (e) => this.#onKey(e, i), { passive: false });
    });
  }

  #onKey(e, index) {
    const last = this.tabs.length - 1;
    const map = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: last };
    if (!(e.key in map)) return;
    e.preventDefault();
    let next = map[e.key];
    if (next > last) next = 0;
    if (next < 0) next = last;
    const tab = this.tabs[next];
    this.select(tab.dataset.mode, true);
  }

  select(mode, focus) {
    if (!MODES[mode]) return;
    this.current = mode;
    for (const tab of this.tabs) {
      const on = tab.dataset.mode === mode;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on) {
        this.panel.setAttribute('aria-labelledby', tab.id);
        if (focus) tab.focus();
      }
    }
    this.diagram.dataset.mode = mode;
    this.section.dataset.mode = mode;
    this.who.textContent = MODES[mode].who;
    this.what.textContent = MODES[mode].what;
    this.readout.classList.remove('is-swapping');
    // Restart the readout swap animation (CSS keyframes, opacity/transform only).
    void this.readout.offsetWidth;
    this.readout.classList.add('is-swapping');
  }
}
