/**
 * Accordion for the trust ledger. Click / tap / Enter pins a row open.
 * On fine pointers with hover, resting on a row previews it; leaving closes the preview
 * unless the row was pinned with a click.
 */
export class RoleLedger {
  constructor(section, rows) {
    this.section = section;
    this.rows = rows.map((el) => ({
      el,
      button: el.querySelector('.trust__toggle'),
      pinned: false,
    }));
    this.canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  init() {
    for (const row of this.rows) {
      if (!row.button) continue;
      this.section.listen(row.button, 'click', () => this.#onClick(row));
      if (this.canHover) {
        this.section.listen(row.el, 'pointerenter', (e) => this.#onEnter(row, e));
        this.section.listen(row.el, 'pointerleave', (e) => this.#onLeave(row, e));
      }
    }
    this.section.listen(this.section.el, 'keydown', (e) => this.#onKey(e), { passive: false });
  }

  #onClick(row) {
    const next = !row.pinned;
    row.pinned = next;
    this.#set(row, next);
  }

  #onEnter(row, e) {
    if (e.pointerType !== 'mouse') return;
    this.#set(row, true);
  }

  #onLeave(row, e) {
    if (e.pointerType !== 'mouse' || row.pinned) return;
    this.#set(row, false);
  }

  /** Arrow keys move between role buttons, Home / End jump to the ends. */
  #onKey(e) {
    const buttons = this.rows.map((r) => r.button);
    const i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    const last = buttons.length - 1;
    const moves = { ArrowDown: Math.min(i + 1, last), ArrowUp: Math.max(i - 1, 0), Home: 0, End: last };
    if (!(e.key in moves)) return;
    e.preventDefault();
    buttons[moves[e.key]].focus();
  }

  #set(row, open) {
    row.el.classList.toggle('is-open', open);
    row.button.setAttribute('aria-expanded', String(open));
  }
}
