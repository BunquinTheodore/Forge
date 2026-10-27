/**
 * Agenda rows that expand to show their description. Several rows can be open at once.
 * Height animates with a CSS grid-rows transition; collapsed panels are made inert.
 */
export class AgendaAccordion {
  constructor(section, items, onToggle) {
    this.items = items.map((li, index) => ({
      li,
      index,
      btn: li.querySelector('.programme__toggle'),
      panel: li.querySelector('.programme__desc'),
    }));
    this.onToggle = onToggle;
    for (const item of this.items) {
      this.#apply(item, item.btn.getAttribute('aria-expanded') === 'true');
      section.listen(item.btn, 'click', () => this.toggle(item.index));
    }
  }

  toggle(index) {
    const item = this.items[index];
    const open = item.btn.getAttribute('aria-expanded') !== 'true';
    this.#apply(item, open);
    this.onToggle?.(index, open);
  }

  #apply(item, open) {
    item.btn.setAttribute('aria-expanded', String(open));
    item.li.classList.toggle('is-open', open);
    item.panel.inert = !open;
  }
}
