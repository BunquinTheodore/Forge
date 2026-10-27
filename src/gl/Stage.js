import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, ACESFilmicToneMapping, SRGBColorSpace, MathUtils,
} from 'three';
import { ScrollTrigger } from '../core/Scroll.js';

const CAMERA_Z = 10;
const FOV = 35;
const SLOW_FRAME = 1 / 40;      // frames slower than this count against the governor
const GOVERNOR_WINDOW = 60;     // consecutive slow frames before downgrading quality
const PRELOAD_MARGIN = 2.0;     // queue an act when its section is within two viewports
const WARMUP_MARGIN = 1.0;      // acts awaited by warmup(): global ones and those within one viewport
const IDLE_TIMEOUT = 300;       // ms: max wait for an idle slot before loading the next queued act
const COMPILE_TIMEOUT = 4000;   // ms: never let a shader compile wait hold an act back longer

const idle = (timeout) => new Promise((r) => {
  if (window.requestIdleCallback) window.requestIdleCallback(() => r(), { timeout });
  else setTimeout(r, 16);
});

/** Act modules are discovered automatically: any src/sections/<id>/*Act.js file. */
const ACT_MODULES = import.meta.glob('../sections/*/*Act.js');

/**
 * Single WebGL renderer shared by every section act.
 * Handles lazy act loading, visibility, scroll progress, DPR and an adaptive quality governor.
 */
export class Stage {
  constructor(app, canvas) {
    this.app = app;
    this.device = app.device;
    this.canvas = canvas;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.velocity = 0;
    this.time = 0;
    this.slowFrames = 0;
    this.slots = [];
    this.queue = [];
    this.pumping = false;
    // Reused every frame for every act (no per-frame allocation). Acts must not keep a reference.
    this.state = {
      progress: 0, visibility: 0, pointer: this.pointer, velocity: 0, scrollY: 0, pageProgress: 0, tier: this.device.tier,
    };

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: this.device.tier === 'high',
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setClearColor(new Color('#080b0e'), 1);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.outputColorSpace = SRGBColorSpace;

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(FOV, this.width / this.height, 0.1, 200);
    this.camera.position.set(0, 0, CAMERA_Z);

    this.resize();
    this.#bindEvents();
    this.#collectSlots();
  }

  #bindEvents() {
    window.addEventListener('resize', () => this.resize(), { passive: true });
    window.addEventListener('pointermove', (e) => {
      this.pointer.tx = (e.clientX / this.width) * 2 - 1;
      this.pointer.ty = -((e.clientY / this.height) * 2 - 1);
    }, { passive: true });
    ScrollTrigger.addEventListener('refresh', () => this.#measure());
  }

  #collectSlots() {
    for (const [path, loader] of Object.entries(ACT_MODULES)) {
      const id = path.split('/').at(-2);
      const el = document.querySelector(`[data-section="${id}"]`);
      this.slots.push({ id, el, loader, act: null, loading: false, queued: false, top: 0, height: 0, visibility: 0 });
    }
    this.#measure();
  }

  #measure() {
    const y = window.scrollY;
    for (const s of this.slots) {
      if (!s.el) continue;
      const r = s.el.getBoundingClientRect();
      s.top = r.top + y;
      s.height = r.height;
    }
  }

  async #load(slot) {
    slot.loading = true;
    try {
      const mod = await slot.loader();
      const ActClass = mod.default;
      const act = new ActClass(this, slot.el);
      await act.init();
      act.resize(this.width, this.height);
      await this.#compile(act);
      act.ready = true;
      act.group.renderOrder = ActClass.order;
      this.scene.add(act.group);
      slot.act = act;
      slot.global = Boolean(ActClass.global);
    } catch (err) {
      console.error(`[Stage] act "${slot.id}" failed to load`, err);
    }
  }

  /**
   * Compile the act's shaders before it is added to the scene, in an idle slot instead of on the
   * frame where it first appears (non-blocking with KHR_parallel_shader_compile).
   */
  async #compile(act) {
    if (!this.renderer.compileAsync) return;
    try {
      const job = this.renderer.compileAsync(act.group, this.camera, this.scene);
      await Promise.race([job, new Promise((r) => setTimeout(r, COMPILE_TIMEOUT))]);
    } catch (err) {
      console.warn('[Stage] shader precompile skipped', err);
    }
  }

  /** Queue an act for loading. Queued acts load one at a time, in idle slots, nearest first. */
  #enqueue(slot) {
    if (slot.act || slot.loading || slot.queued) return;
    slot.queued = true;
    this.queue.push(slot);
    this.#pump();
  }

  async #pump() {
    if (this.pumping) return;
    this.pumping = true;
    while (this.queue.length) {
      await idle(IDLE_TIMEOUT);
      const y = this.app.scroll.y;
      this.queue.sort((a, b) => this.#distance(a, y) - this.#distance(b, y));
      const slot = this.queue.shift();
      slot.queued = false;
      if (!slot.act && !slot.loading) await this.#load(slot);
    }
    this.pumping = false;
  }

  /** Ensure global acts and the acts near the first viewport are loaded, one after another. */
  async warmup() {
    const y = window.scrollY;
    const first = this.slots.filter((s) => !s.el || this.#distance(s, y) < WARMUP_MARGIN);
    for (const slot of first) {
      await this.#load(slot);
      await idle(IDLE_TIMEOUT);
    }
  }

  #distance(slot, y) {
    if (!slot.el) return 0;
    const vh = this.height;
    if (y + vh < slot.top) return (slot.top - (y + vh)) / vh;
    if (y > slot.top + slot.height) return (y - (slot.top + slot.height)) / vh;
    return 0;
  }

  resize() {
    // Clamp: a 0-size window (minimised or embedded) would give an Infinity aspect and NaN in acts.
    this.width = Math.max(1, window.innerWidth);
    this.height = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.device.maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.#measure();
    for (const s of this.slots) s.act?.resize(this.width, this.height);
  }

  /** World-space size of the visible frustum at depth z (z measured like a world position). */
  viewSize(z = 0) {
    const dist = CAMERA_Z - z;
    const h = 2 * Math.tan(MathUtils.degToRad(FOV / 2)) * dist;
    return { width: h * this.camera.aspect, height: h };
  }

  /** Convert a DOMRect (viewport px) to a world-space box {x, y, w, h} centred at depth z. */
  rectToWorld(rect, z = 0) {
    const v = this.viewSize(z);
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return {
      x: (cx / this.width - 0.5) * v.width,
      y: -(cy / this.height - 0.5) * v.height,
      w: (rect.width / this.width) * v.width,
      h: (rect.height / this.height) * v.height,
    };
  }

  #govern(dt) {
    if (dt > SLOW_FRAME && dt < 0.25) this.slowFrames += 1;
    else this.slowFrames = Math.max(0, this.slowFrames - 2);
    if (this.slowFrames < GOVERNOR_WINDOW || this.device.tier === 'low') return;
    this.slowFrames = 0;
    const tier = this.device.downgrade();
    this.resize();
    for (const s of this.slots) s.act?.onTierChange(tier);
  }

  render(dt) {
    if (document.hidden) return;
    this.time += dt;
    this.#govern(dt);

    const k = 1 - Math.exp(-dt * 6);
    this.pointer.x += (this.pointer.tx - this.pointer.x) * k;
    this.pointer.y += (this.pointer.ty - this.pointer.y) * k;
    this.velocity += (this.app.scroll.velocity - this.velocity) * k;

    const y = this.app.scroll.y;
    const vh = this.height;
    const state = this.state;
    state.velocity = this.velocity;
    state.scrollY = y;
    state.pageProgress = this.app.scroll.progress;
    state.tier = this.device.tier;
    for (const s of this.slots) {
      if (!s.act && !s.loading && this.#distance(s, y) < PRELOAD_MARGIN) this.#enqueue(s);
      const act = s.act;
      if (!act) continue;

      let progress = 1;
      let target = 1;
      if (!s.global && s.el) {
        progress = MathUtils.clamp((y + vh - s.top) / (s.height + vh), 0, 1);
        const overlap = Math.min(y + vh - s.top, s.top + s.height - y);
        target = MathUtils.clamp(overlap / (vh * 0.45), 0, 1);
      }
      s.visibility += (target - s.visibility) * Math.min(1, k * 1.6);
      if (s.visibility < 0.002 && target === 0) s.visibility = 0;

      act.group.visible = s.visibility > 0;
      if (!act.group.visible) continue;
      state.progress = progress;
      state.visibility = s.visibility;
      act.update(dt, this.time, state);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    for (const s of this.slots) s.act?.dispose();
    this.renderer.dispose();
  }
}
