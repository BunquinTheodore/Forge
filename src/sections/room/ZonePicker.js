import { ZONES } from './zones.js';

/**
 * Shared zone selection for the room section.
 * Legend buttons, fallback tiles and GL pins all route through here; the active zone
 * is written to section.dataset.zone so RoomAct can highlight the matching block.
 * Hover / focus previews a zone, click or tap pins it.
 */
export class ZonePicker {
  constructor(section) {
    this.section = section;
    this.el = section.el;
    this.selected = this.el.dataset.zone || ZONES[0].id;
    this.preview = null;
    this.byId = new Map(ZONES.map((z) => [z.id, z]));
    this.readK = section.$('.room__readout-k');
    this.readV = section.$('.room__readout-v');
  }

  /** Wire every element carrying data-zone inside `root`. */
  bind(elements) {
    const s = this.section;
    for (const node of elements) {
      const id = node.dataset.zone;
      s.listen(node, 'pointerenter', (e) => { if (e.pointerType !== 'touch') this.show(id); });
      s.listen(node, 'pointerleave', (e) => { if (e.pointerType !== 'touch') this.show(null); });
      s.listen(node, 'focus', () => this.show(id));
      s.listen(node, 'blur', () => this.show(null));
      s.listen(node, 'click', () => this.select(id));
    }
  }

  select(id) {
    if (!this.byId.has(id)) return;
    this.selected = id;
    this.preview = null;
    this.#render();
  }

  show(id) {
    this.preview = id && this.byId.has(id) ? id : null;
    this.#render();
  }

  get active() { return this.preview || this.selected; }

  #render() {
    const id = this.active;
    if (this.el.dataset.zone === id && !this.dirty) { this.#syncPressed(); return; }
    this.el.dataset.zone = id;
    const zone = this.byId.get(id);
    if (this.readK) this.readK.textContent = zone.name;
    if (this.readV) this.readV.textContent = zone.note;
    for (const node of this.el.querySelectorAll('[data-zone]')) {
      if (node === this.el) continue;
      node.classList.toggle('is-on', node.dataset.zone === id);
    }
    this.#syncPressed();
  }

  #syncPressed() {
    for (const btn of this.el.querySelectorAll('.room__zone')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.zone === this.selected));
    }
  }

  /** First paint: apply classes without waiting for an interaction. */
  sync() {
    this.dirty = true;
    this.#render();
    this.dirty = false;
  }
}
