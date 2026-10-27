const BASE_COUNT = 460;
const BANDS = 4;
const CLUSTERS_PER_BAND = 4;
const STIFFNESS = 14;
const DAMPING = 7;
const POINTER_RADIUS = 150;
const POINTER_RING = 0.42;     // points settle on a ring at this fraction of the radius
const POINTER_FORCE = 2600;
const MAX_DPR = 2;
const REST_EPSILON = 0.05;     // px: below this offset and per-frame travel the field sleeps

/** Small deterministic PRNG so the field looks the same on every visit. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t) => t * t * (3 - 2 * t);

/**
 * A 2D "dataset": hundreds of points that begin scattered and organise into
 * four strata (one per score) as `order` rises. The pointer acts like a magnet,
 * gathering nearby points into a ring. All buffers are preallocated.
 */
export class DataField {
  constructor(canvas, { detail = 1, reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reduced = reducedMotion;
    this.n = Math.round(BASE_COUNT * detail);
    this.order = 0;
    this.tension = 0.5;
    this.w = 0;
    this.h = 0;
    this.px = -1e5;
    this.py = -1e5;
    this.pointerOn = false;
    this.placed = false;
    this.dirty = true;
    this.awake = true;
    this.#alloc();
    this.#readColors();
  }

  #alloc() {
    const n = this.n;
    this.sx = new Float32Array(n);
    this.sy = new Float32Array(n);
    this.tx = new Float32Array(n);
    this.ty = new Float32Array(n);
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.size = new Float32Array(n);
    this.band = new Uint8Array(n);
    this.hot = new Uint8Array(n);

    const rand = mulberry32(908);
    const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
    const centers = [];
    for (let b = 0; b < BANDS; b += 1) {
      for (let c = 0; c < CLUSTERS_PER_BAND; c += 1) {
        centers.push(0.08 + (c + 0.2 + rand() * 0.6) * (0.84 / CLUSTERS_PER_BAND));
      }
    }
    for (let i = 0; i < n; i += 1) {
      const b = i % BANDS;
      const c = Math.floor(rand() * CLUSTERS_PER_BAND);
      this.band[i] = b;
      this.sx[i] = rand();
      this.sy[i] = rand();
      this.tx[i] = centers[b * CLUSTERS_PER_BAND + c] + gauss() * 0.05;
      this.ty[i] = 0.2 + b * 0.2 + gauss() * 0.022;
      this.size[i] = 1.3 + rand() * 1.8;
      this.hot[i] = rand() < 0.12 + b * 0.05 ? 1 : 0;
    }
  }

  #readColors() {
    const css = getComputedStyle(document.documentElement);
    const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    this.cEmber = get('--ember', 'orange');
    this.cGlow = get('--ember-glow', 'orange');
    this.cFog = get('--fog', 'gray');
    this.cLine = get('--line-strong', 'gray');
  }

  resize(w, h) {
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.placed || this.reduced) this.#snap();
    this.dirty = true;
    this.awake = true;
  }

  #snap() {
    const k = this.#mix();
    for (let i = 0; i < this.n; i += 1) {
      this.x[i] = (this.sx[i] + (this.tx[i] - this.sx[i]) * k) * this.w;
      this.y[i] = (this.sy[i] + (this.ty[i] - this.sy[i]) * k) * this.h;
      this.vx[i] = 0;
      this.vy[i] = 0;
    }
    this.placed = true;
  }

  #mix() {
    return smooth(Math.min(1, Math.max(0, this.order))) * (0.45 + 0.55 * this.tension);
  }

  setOrder(v) { this.#setParam('order', v); }
  setTension(v) { this.#setParam('tension', v); }

  #setParam(name, v) {
    if (this[name] === v) return;
    this[name] = v;
    this.dirty = true;
    this.awake = true;
    if (this.reduced) this.#snap();
  }

  setPointer(x, y) {
    if (this.reduced) return;
    this.px = x;
    this.py = y;
    this.pointerOn = true;
    this.awake = true;
  }

  clearPointer() { this.pointerOn = false; this.px = -1e5; this.py = -1e5; this.awake = true; }

  /** Integrates the springs. Skipped once the field has settled and nothing has changed. */
  step(dt) {
    if (this.reduced || !this.w || !this.awake) return;
    const k = this.#mix();
    const damp = Math.exp(-DAMPING * dt);
    const r = POINTER_RADIUS;
    const r2 = r * r;
    let motion = 0;
    for (let i = 0; i < this.n; i += 1) {
      const hx = (this.sx[i] + (this.tx[i] - this.sx[i]) * k) * this.w;
      const hy = (this.sy[i] + (this.ty[i] - this.sy[i]) * k) * this.h;
      const ox = hx - this.x[i];
      const oy = hy - this.y[i];
      const m = Math.max(Math.abs(ox), Math.abs(oy), Math.abs(this.vx[i]) * dt, Math.abs(this.vy[i]) * dt);
      if (m > motion) motion = m;
      let ax = ox * STIFFNESS;
      let ay = oy * STIFFNESS;
      if (this.pointerOn) {
        const dx = this.x[i] - this.px;
        const dy = this.y[i] - this.py;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2 && d2 > 1) {
          const d = Math.sqrt(d2);
          const f = ((d / r - POINTER_RING) * (1 - d / r) * POINTER_FORCE) / d;
          ax -= dx * f;
          ay -= dy * f;
        }
      }
      this.vx[i] = (this.vx[i] + ax * dt) * damp;
      this.vy[i] = (this.vy[i] + ay * dt) * damp;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
    }
    this.dirty = true;
    // Sleep once every point is within a fraction of a pixel of home and barely moving.
    if (!this.pointerOn && motion < REST_EPSILON) this.awake = false;
  }

  draw() {
    if (!this.dirty || !this.w) return;
    this.dirty = false;
    const { ctx } = this;
    const k = this.#mix();
    ctx.clearRect(0, 0, this.w, this.h);
    this.#drawStrata(ctx, k);
    this.#drawPoints(ctx, 0, this.cFog, 0.38 + 0.12 * k);
    this.#drawPoints(ctx, 1, this.cEmber, 0.55 + 0.4 * k);
  }

  #drawStrata(ctx, k) {
    if (k < 0.05) return;
    ctx.globalAlpha = k * 0.3;
    ctx.strokeStyle = this.cLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let b = 0; b < BANDS; b += 1) {
      const y = Math.round((0.2 + b * 0.2) * this.h) + 0.5;
      ctx.moveTo(this.w * 0.04, y);
      ctx.lineTo(this.w * 0.96, y);
    }
    ctx.stroke();
  }

  #drawPoints(ctx, hot, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < this.n; i += 1) {
      if (this.hot[i] !== hot) continue;
      const s = hot ? this.size[i] + 0.6 : this.size[i];
      ctx.rect(this.x[i] - s / 2, this.y[i] - s / 2, s, s);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
