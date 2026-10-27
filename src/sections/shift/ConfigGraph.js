import { GraphPainter } from './GraphPainter.js';

const LABELS = ['FOUNDER', 'CAPABILITY', 'INVESTOR', 'MARKET'];
/** Resting positions (fraction of the canvas) and docking angles around the startup. */
const HOMES = [[0.15, 0.17], [0.85, 0.17], [0.15, 0.83], [0.85, 0.83]];
const SLOT_ANGLES = [-2.356, -0.785, 2.356, 0.785];
const MAX_DPR = 2;
const SNAP_FACTOR = 1.45;   // release within slotR * this to dock
const HIT_SLOP = 1.6;       // generous touch targets
const EASE_RATE = 9;

/**
 * Configuration builder: the startup sits at the centre, four parts can be dragged toward it.
 * Links glow as parts approach; docking connects them. Pointer, touch and programmatic (keyboard) control.
 */
export class ConfigGraph {
  constructor(canvas, { reducedMotion = false, onChange = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reducedMotion = reducedMotion;
    this.onChange = onChange;
    this.painter = new GraphPainter(this.ctx);
    this.geo = { w: 0, h: 0, cx: 0, cy: 0, m: 0, coreR: 0, slotR: 0, nodeR: 0 };
    this.nodes = LABELS.map((label, i) => ({
      label, index: i, x: 0, y: 0, tx: 0, ty: 0,
      connected: false, link: 0, lift: 0, reach: 1, seed: i * 0.21,
    }));
    this.drag = null;
    this.focus = -1;
    this.hovering = false;
    this.heat = 0;
    this.pulse = 0;
    this.time = 0;
    this.placed = false;
    this.dirty = true;
  }

  get count() {
    let n = 0;
    for (const node of this.nodes) if (node.connected) n += 1;
    return n;
  }

  /** Attach input listeners through the owner's listen() so they are removed on destroy. */
  bind(listen) {
    const c = this.canvas;
    listen(c, 'pointerdown', (e) => this.#down(e), { passive: false });
    listen(c, 'pointermove', (e) => this.#move(e));
    listen(c, 'pointerup', (e) => this.#up(e));
    listen(c, 'pointercancel', (e) => this.#up(e));
    listen(c, 'lostpointercapture', (e) => this.#up(e));
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = this.geo;
    const m = Math.min(w, h);
    g.w = w; g.h = h; g.cx = w / 2; g.cy = h / 2; g.m = m;
    g.coreR = Math.max(34, m * 0.11);
    g.slotR = m * 0.31;
    g.nodeR = Math.max(18, m * 0.055);
    this.painter.setScale(m);
    for (const n of this.nodes) this.#retarget(n, !this.placed);
    this.placed = true;
    this.dirty = true;
  }

  /** Programmatic toggle (keyboard buttons). */
  toggle(i) {
    const n = this.nodes[i];
    if (!n) return;
    this.#setConnected(n, !n.connected);
  }

  setFocus(i) {
    this.focus = i;
    this.dirty = true;
  }

  reset() {
    for (const n of this.nodes) {
      n.connected = false;
      this.#retarget(n, false);
    }
    this.pulse = 0;
    this.dirty = true;
    this.onChange(0, false);
  }

  #retarget(n, snap) {
    const g = this.geo;
    if (n.connected) {
      n.tx = g.cx + Math.cos(SLOT_ANGLES[n.index]) * g.slotR;
      n.ty = g.cy + Math.sin(SLOT_ANGLES[n.index]) * g.slotR;
    } else {
      n.tx = g.w * HOMES[n.index][0];
      n.ty = g.h * HOMES[n.index][1];
    }
    n.reach = Math.max(1, Math.hypot(g.w * HOMES[n.index][0] - g.cx, g.h * HOMES[n.index][1] - g.cy) - g.slotR);
    if (snap || this.reducedMotion) { n.x = n.tx; n.y = n.ty; }
  }

  #setConnected(n, value) {
    const was = this.count === 4;
    n.connected = value;
    this.#retarget(n, false);
    const count = this.count;
    if (count === 4 && !was) this.pulse = 0.001;
    this.dirty = true;
    this.onChange(count, count === 4, n.index);
  }

  #local(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  #hit(x, y) {
    const reach = this.geo.nodeR * HIT_SLOP;
    let best = null;
    let bestD = reach * reach;
    for (const n of this.nodes) {
      const dx = n.x - x;
      const dy = n.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  #down(e) {
    const p = this.#local(e);
    const n = this.#hit(p.x, p.y);
    if (!n) return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* capture is optional */ }
    this.drag = { node: n, id: e.pointerId, ox: n.x - p.x, oy: n.y - p.y };
    this.canvas.classList.add('is-dragging');
    this.dirty = true;
  }

  #move(e) {
    if (!this.drag || e.pointerId !== this.drag.id) {
      if (e.pointerType === 'mouse') this.#hover(e);
      return;
    }
    const p = this.#local(e);
    const g = this.geo;
    const n = this.drag.node;
    const pad = g.nodeR;
    n.x = Math.min(g.w - pad, Math.max(pad, p.x + this.drag.ox));
    n.y = Math.min(g.h - pad, Math.max(pad, p.y + this.drag.oy));
    n.tx = n.x; n.ty = n.y;
    this.dirty = true;
  }

  #hover(e) {
    const p = this.#local(e);
    const over = Boolean(this.#hit(p.x, p.y));
    if (over !== this.hovering) {
      this.hovering = over;
      this.canvas.style.cursor = over ? 'grab' : 'default';
    }
  }

  #up(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const n = this.drag.node;
    this.drag = null;
    this.canvas.classList.remove('is-dragging');
    const g = this.geo;
    const d = Math.hypot(n.x - g.cx, n.y - g.cy);
    const dock = d < g.slotR * SNAP_FACTOR;
    if (dock !== n.connected) this.#setConnected(n, dock);
    else this.#retarget(n, false);
  }

  /** Per-frame step. Called only while the canvas is on screen. */
  update(dt) {
    if (!this.placed) return;
    this.time += dt;
    const k = this.reducedMotion ? 1 : 1 - Math.exp(-dt * EASE_RATE);
    const animating = this.#step(dt, k);
    if (!animating && !this.dirty && this.reducedMotion) return;
    this.dirty = false;
    this.#draw();
  }

  #step(dt, k) {
    const g = this.geo;
    let moving = false;
    let heat = 0;
    for (const n of this.nodes) {
      const dragged = this.drag?.node === n;
      if (!dragged) {
        n.x += (n.tx - n.x) * k;
        n.y += (n.ty - n.y) * k;
        if (Math.abs(n.tx - n.x) + Math.abs(n.ty - n.y) > 0.3) moving = true;
      }
      const d = Math.hypot(n.x - g.cx, n.y - g.cy);
      const near = 1 - (d - g.slotR) / n.reach;
      const target = n.connected ? 1 : Math.max(0, Math.min(0.85, near));
      n.link += (target - n.link) * k;
      n.lift += ((dragged ? 1 : 0) - n.lift) * k;
      if (n.connected) heat += 0.25;
    }
    this.heat += (heat - this.heat) * k;
    if (this.pulse > 0) {
      this.pulse = this.reducedMotion ? 0 : this.pulse + dt * 0.7;
      if (this.pulse >= 1) this.pulse = 0;
      moving = true;
    }
    return moving;
  }

  #draw() {
    const g = this.geo;
    const p = this.painter;
    const motion = !this.reducedMotion;
    p.clear(g.w, g.h);
    p.orbit(g, motion ? this.time : 0, 1);
    for (const n of this.nodes) p.link(g, n, this.time, motion);
    p.core(g, this.heat, this.pulse);
    for (const n of this.nodes) p.node(g, n, this.focus === n.index);
  }
}
