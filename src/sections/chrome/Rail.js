import { CHAPTERS, chapterEl } from './chapters.js';

const TICK_PITCH = 24; // px, must match --rail-pitch in chrome.css
const LABEL_HOLD_MS = 1800; // how long the chapter label stays after a change
const SWAP_FRAMES = [
  { opacity: 0, transform: 'translate3d(10px, 0, 0)' },
  { opacity: 1, transform: 'translate3d(0, 0, 0)' },
];
const SWAP_TIMING = { duration: 460, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' };

/**
 * Right edge chapter indicator: one tick per chapter present on the page,
 * the active chapter's number and name, click or keyboard to jump.
 * Also the single source of truth for "which chapter is active".
 */
export class Rail {
  constructor(section, onActive) {
    this.section = section;
    this.onActive = onActive;
    this.list = section.$('.chrome__rail-list');
    this.label = section.$('.chrome__rail-label');
    this.num = section.$('.chrome__rail-num');
    this.name = section.$('.chrome__rail-name');
    this.chapters = CHAPTERS.filter((c) => chapterEl(c.id));
    this.buttons = new Map();
    this.inView = new Set();
    this.activeId = '';

    this.#build();
    this.#observe();
    if (this.chapters.length) this.setActive(this.chapters[0].id);
  }

  #build() {
    const frag = document.createDocumentFragment();
    this.chapters.forEach((c) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chrome__rail-btn';
      btn.dataset.chapter = c.id;
      btn.setAttribute('aria-label', `${c.num} ${c.name}`);
      btn.innerHTML = '<span class="chrome__rail-tick"></span>';
      li.appendChild(btn);
      frag.appendChild(li);
      this.buttons.set(c.id, btn);
    });
    this.list.appendChild(frag);
    this.section.el.style.setProperty('--rail-count', String(this.chapters.length));
  }

  #observe() {
    if (!('IntersectionObserver' in window)) return;
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = e.target.dataset.section || e.target.id;
        if (e.isIntersecting) this.inView.add(id);
        else this.inView.delete(id);
      }
      const current = this.chapters.find((c) => this.inView.has(c.id));
      if (current) this.setActive(current.id);
    }, { rootMargin: '-45% 0px -54% 0px' });
    this.chapters.forEach((c) => this.io.observe(chapterEl(c.id)));

    // Step aside while the footer takes the stage (its wordmark spans edge to edge).
    const footer = document.querySelector('[data-section="footer"]');
    if (!footer) return;
    this.footerIo = new IntersectionObserver(([entry]) => {
      this.section.el.classList.toggle('is-at-footer', entry.isIntersecting);
    }, { rootMargin: '0px 0px -40% 0px' });
    this.footerIo.observe(footer);
  }

  setActive(id) {
    if (id === this.activeId) return;
    const index = this.chapters.findIndex((c) => c.id === id);
    if (index < 0) return;
    this.buttons.get(this.activeId)?.removeAttribute('aria-current');
    this.buttons.get(id)?.setAttribute('aria-current', 'location');
    this.activeId = id;

    const chapter = this.chapters[index];
    this.num.textContent = chapter.num;
    this.name.textContent = chapter.name;
    this.label.style.transform = `translate3d(0, ${index * TICK_PITCH}px, 0)`;
    if (!this.section.reducedMotion && this.name.animate) {
      this.name.animate(SWAP_FRAMES, SWAP_TIMING);
    }
    this.#flashLabel();
    this.onActive?.(id);
  }

  #flashLabel() {
    const root = this.section.el;
    root.classList.add('is-rail-flash');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => root.classList.remove('is-rail-flash'), LABEL_HOLD_MS);
  }

  destroy() {
    clearTimeout(this.flashTimer);
    this.io?.disconnect();
    this.footerIo?.disconnect();
  }
}
