import { gsap } from '../../core/BaseSection.js';

const STEP = 60;               // degrees between cards on the ring
const DRAG_DEG_PER_PX = 0.32;  // ring rotation per pointer pixel
const DRAG_THRESHOLD = 6;      // px before a press becomes a drag
const SWIPE_RATIO = 0.22;      // fraction of card width that commits a swipe
const STACK_DEPTH = 3;         // visible cards behind the front one in stack mode
const RING_QUERY = '(min-width: 768px)';

const mod = (a, n) => ((a % n) + n) % n;

/**
 * Six role cards on a draggable CSS 3D ring (desktop) or a swipeable stack (narrow screens).
 * Emits onChange(index) when the front card changes and onTurn(angle) while it rotates.
 */
export class RoleRing {
  constructor(root, { listen, reducedMotion, onChange, onTurn }) {
    this.root = root;
    this.stage = root.querySelector('[data-ring-stage]');
    this.spin = root.querySelector('[data-ring-spin]');
    this.cards = Array.from(root.querySelectorAll('.role'));
    this.picks = this.cards.map((c) => c.querySelector('.role__pick'));
    this.n = this.cards.length;
    this.reducedMotion = reducedMotion;
    this.onChange = onChange;
    this.onTurn = onTurn;

    this.angle = 0;
    this.assembly = reducedMotion ? 1 : 0;
    this.index = 0;
    this.dragX = 0;
    this.radius = 260;
    this.pointer = null;
    this.moved = false;
    this.tween = null;
    this.mq = window.matchMedia(RING_QUERY);

    this.picks.forEach((btn, i) => { btn.tabIndex = i === 0 ? 0 : -1; });
    this.cards[0]?.classList.add('is-active');
    this.#bind(listen, root);
    this.#applyMode();
  }

  get isRing() { return this.mq.matches; }

  #bind(listen, root) {
    listen(this.mq, 'change', () => this.#applyMode());
    listen(window, 'resize', () => this.#measure());
    listen(this.stage, 'pointerdown', (e) => this.#down(e));
    listen(window, 'pointermove', (e) => this.#move(e));
    listen(window, 'pointerup', (e) => this.#up(e));
    listen(window, 'pointercancel', (e) => this.#up(e));
    listen(this.stage, 'keydown', (e) => this.#key(e), { passive: false });
    this.picks.forEach((btn, i) => listen(btn, 'click', () => {
      if (!this.moved) this.go(i);
    }));
    listen(root.querySelector('[data-ring-prev]'), 'click', () => this.go(this.index - 1));
    listen(root.querySelector('[data-ring-next]'), 'click', () => this.go(this.index + 1));
  }

  #applyMode() {
    this.root.classList.toggle('is-ring', this.isRing);
    this.root.classList.toggle('is-stack', !this.isRing);
    this.tween?.kill();
    this.angle = -this.index * STEP;
    this.dragX = 0;
    this.#measure();
  }

  #measure() {
    const w = this.cards[0]?.offsetWidth || 260;
    this.cardWidth = w;
    this.radius = w * 0.98;
    this.render();
  }

  /** 0..1 scroll-driven assembly of the ring (collapsed, tilted stack to open ring). */
  setAssembly(p) {
    this.assembly = p;
    if (this.isRing) this.render();
  }

  go(target) {
    const next = mod(target, this.n);
    if (this.isRing) {
      // rotate the shortest way round to the requested card
      const delta = mod(-next * STEP - this.angle + 180, 360) - 180;
      this.#rotateTo(this.angle + delta);
    } else {
      this.#setIndex(next);
      this.render();
    }
  }

  #rotateTo(angle) {
    this.tween?.kill();
    const done = () => { this.angle = angle; this.render(); };
    if (this.reducedMotion) { done(); return; }
    this.tween = gsap.to(this, { angle, duration: 0.9, ease: 'power3.out', onUpdate: () => this.render(), onComplete: done });
  }

  #setIndex(i) {
    if (i === this.index) return;
    this.index = i;
    this.picks.forEach((btn, k) => {
      const on = k === i;
      btn.setAttribute('aria-pressed', String(on));
      btn.tabIndex = on ? 0 : -1;
      this.cards[k].classList.toggle('is-active', on);
    });
    if (this.stage.contains(document.activeElement)) this.picks[i].focus({ preventScroll: true });
    this.onChange?.(i);
  }

  render() {
    if (this.isRing) this.#renderRing();
    else this.#renderStack();
  }

  #renderRing() {
    const a = this.assembly;
    const tilt = (1 - a) * 58;
    const r = this.radius * (0.08 + 0.92 * a);
    this.spin.style.transform = `translateZ(${-r}px) rotateX(${-tilt}deg) rotateY(${this.angle}deg)`;
    for (let i = 0; i < this.n; i++) {
      const theta = i * STEP;
      const facing = Math.cos(((theta + this.angle) * Math.PI) / 180);
      const vis = Math.min(1, Math.max(0, (facing + 0.35) / 1.1));
      const card = this.cards[i];
      card.style.transform = `rotateY(${theta}deg) translateZ(${r}px)`;
      card.style.opacity = (0.12 + 0.88 * vis) * (0.25 + 0.75 * a);
      card.style.zIndex = String(Math.round(facing * 10) + 10);
    }
    this.#setIndex(mod(Math.round(-this.angle / STEP), this.n));
    this.onTurn?.(this.angle);
  }

  #renderStack() {
    this.spin.style.transform = '';
    for (let i = 0; i < this.n; i++) {
      const k = mod(i - this.index, this.n);
      const card = this.cards[i];
      const front = k === 0;
      const x = front ? this.dragX : 0;
      const rot = front ? this.dragX * 0.04 : 0;
      card.style.transform = `translate3d(${x}px, ${k * 14}px, 0) rotate(${rot}deg) scale(${1 - k * 0.05})`;
      card.style.opacity = k > STACK_DEPTH ? 0 : 1 - k * 0.22;
      card.style.zIndex = String(this.n - k);
    }
    this.onTurn?.(-this.index * STEP);
  }

  #down(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.tween?.kill();
    this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, v: 0, angle: this.angle };
    this.moved = false;
  }

  #move(e) {
    const p = this.pointer;
    if (!p || e.pointerId !== p.id) return;
    const dx = e.clientX - p.x;
    if (!this.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      if (Math.abs(e.clientY - p.y) > Math.abs(dx)) { this.pointer = null; return; } // vertical scroll wins
      this.moved = true;
      this.root.classList.add('is-dragging');
    }
    p.v = e.clientX - p.lastX;
    p.lastX = e.clientX;
    if (this.isRing) this.angle = p.angle + dx * DRAG_DEG_PER_PX;
    else this.dragX = dx;
    this.render();
  }

  #up(e) {
    const p = this.pointer;
    if (!p || e.pointerId !== p.id) return;
    this.pointer = null;
    this.root.classList.remove('is-dragging');
    if (!this.moved) return;
    if (this.isRing) {
      const fling = this.angle + p.v * DRAG_DEG_PER_PX * 10;
      this.#rotateTo(Math.round(fling / STEP) * STEP);
    } else {
      const commit = Math.abs(this.dragX) > this.cardWidth * SWIPE_RATIO;
      const dir = this.dragX < 0 ? 1 : -1;
      this.dragX = 0;
      if (commit) this.#setIndex(mod(this.index + dir, this.n));
      this.render();
    }
    // let the click that follows a drag be ignored, then reset
    setTimeout(() => { this.moved = false; }, 0);
  }

  #key(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); this.go(this.index + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); this.go(this.index - 1); }
    else if (e.key === 'Home') { e.preventDefault(); this.go(0); }
    else if (e.key === 'End') { e.preventDefault(); this.go(this.n - 1); }
  }
}
