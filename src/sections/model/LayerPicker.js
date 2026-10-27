const ALL_LAYERS = 5;
const READ_N = ['04', '01', '02', '03', '04', '4/4'];
const NAMES = ['layers', 'Event revenue', 'Configuration services', 'Success economics', 'Capital vehicle', 'Capital logic'];

/**
 * Owns which layer is active. Scroll sets a base layer; hover, focus or tap "picks"
 * a layer that overrides it (lifted higher in 3D). Publishes to section.dataset
 * (layer: 0..5, lift: 0|1) for the GL act, and toggles classes for DOM and CSS stack.
 */
export class LayerPicker {
  constructor(root) {
    this.root = root;
    this.rows = Array.from(root.querySelectorAll('.layer'));
    this.buttons = this.rows.map((r) => r.querySelector('.layer__btn'));
    this.plates = Array.from(root.querySelectorAll('.plate'));
    this.readN = root.querySelector('[data-readout-n]');
    this.readT = root.querySelector('[data-readout-t]');
    this.scrollLayer = 0;
    this.picked = 0;
    this.sticky = false;
    this.current = -1;
  }

  setScroll(n) {
    this.scrollLayer = n;
    if (this.sticky) { this.sticky = false; this.picked = 0; }
    this.render();
  }

  /** Transient pick (hover / focus). */
  hover(n) {
    if (this.sticky) return;
    this.picked = n;
    this.render();
  }

  release() {
    if (this.sticky) return;
    this.picked = 0;
    this.render();
  }

  /** Tap / click / Enter toggles a sticky pick that stays until scroll moves on. */
  toggle(n) {
    const same = this.sticky && this.picked === n;
    this.sticky = !same;
    this.picked = same ? 0 : n;
    this.render();
  }

  render() {
    const layer = this.picked || this.scrollLayer;
    const lifted = this.picked > 0;
    const key = layer * 4 + (lifted ? 1 : 0) + (this.sticky ? 2 : 0);
    if (key === this.current) return;
    this.current = key;
    this.root.dataset.layer = String(layer);
    this.root.dataset.lift = lifted ? '1' : '0';

    this.rows.forEach((row, i) => {
      const on = layer === i + 1 || layer === ALL_LAYERS;
      row.classList.toggle('is-on', on);
      this.buttons[i].setAttribute('aria-pressed', String(this.sticky && this.picked === i + 1));
    });
    this.plates.forEach((p, i) => {
      p.classList.toggle('is-on', layer === i + 1 || layer === ALL_LAYERS);
      p.classList.toggle('is-picked', lifted && this.picked === i + 1);
    });
    if (this.readN) this.readN.textContent = READ_N[layer];
    if (this.readT) this.readT.textContent = NAMES[layer];
  }
}

export { ALL_LAYERS };
