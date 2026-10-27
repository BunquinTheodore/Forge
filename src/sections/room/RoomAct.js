import { Group, Vector3, MathUtils } from 'three';
import { GLAct } from '../../gl/GLAct.js';
import { ZONES, FLOW, GRID } from './zones.js';
import { RoomBlocks } from './RoomBlocks.js';
import { FlowParticles } from './FlowParticles.js';

const TOP_DOWN = Math.PI / 2;
const ISO_TILT = 0.66;
const ISO_SPIN = 0.74;
const MEASURE_EVERY = 24;     // frames between DOM rect refreshes
const PROJ_K = 1 / (2 * Math.tan(MathUtils.degToRad(35 / 2)));

/**
 * ROOM act: an extruded floor plan of the seven FORGE zones.
 * Scroll tilts it from a top-down drawing into an isometric room; ember particles
 * travel the venture flow; the zone in section.dataset.zone glows. Positions the
 * DOM hit pins (.room__pin) over each block so pointer and GL stay in sync.
 */
export default class RoomAct extends GLAct {
  static order = 2;

  async init() {
    this.tilt = new Group();
    this.spin = new Group();
    this.content = new Group();
    this.group.add(this.tilt);
    this.tilt.add(this.spin);
    this.spin.add(this.content);

    this.blocks = new RoomBlocks(this);
    this.flow = new FlowParticles(this);
    this.content.add(...this.blocks.objects, this.flow.points);

    this.indexOf = new Map(ZONES.map((z, i) => [z.id, i]));
    this.base = new Float32Array(ZONES.map((z) => (FLOW.includes(z.id) ? 0.16 : 0.06)));
    this.anchors = ZONES.map((z) => new Vector3(
      z.c + z.w / 2 - GRID.cols / 2, z.lift + 0.08, z.r + z.h / 2 - GRID.rows / 2,
    ));
    this.tmp = new Vector3();
    this.pinX = new Float32Array(ZONES.length).fill(-1);
    this.pinY = new Float32Array(ZONES.length).fill(-1);

    this.stageEl = this.section.querySelector('.room__stage');
    this.box = { docTop: 0, left: 0, width: 1, height: 1 };
    this.frame = 0;
    this.flowTime = 0;
    this.reduced = this.device.reducedMotion;
    this.stage.camera.updateMatrixWorld();
    this.#collectPins();
    this.#measure();
  }

  #collectPins() {
    const pins = Array.from(this.section.querySelectorAll('.room__pin'));
    this.pins = ZONES.map((z) => pins.find((p) => p.dataset.zone === z.id) || null);
  }

  #measure() {
    if (!this.stageEl) return;
    const r = this.stageEl.getBoundingClientRect();
    this.box.docTop = r.top + window.scrollY;
    this.box.left = r.left;
    this.box.width = Math.max(1, r.width);
    this.box.height = Math.max(1, r.height);
  }

  resize() {
    this.#measure();
    this.frame = 0;
  }

  #layout(state) {
    const b = this.box;
    const top = b.docTop - state.scrollY;
    const stage = this.stage;
    const v = stage.viewSize(0);
    const cx = (b.left + b.width / 2) / stage.width - 0.5;
    const cy = (top + b.height / 2) / stage.height - 0.5;
    this.group.position.set(cx * v.width, -cy * v.height, 0);
    const w = (b.width / stage.width) * v.width;
    const h = (b.height / stage.height) * v.height;
    const s = Math.min(w / (GRID.cols + 2.2), h / (GRID.rows + 2.6));
    this.group.scale.setScalar(s);
    const dpr = stage.renderer.getPixelRatio();
    this.flow.setPixel(stage.height * dpr * PROJ_K * s);
  }

  #pose(state) {
    const t = this.reduced ? 1 : MathUtils.smoothstep(state.progress, 0.12, 0.42);
    const px = this.reduced ? 0 : state.pointer.x;
    const py = this.reduced ? 0 : state.pointer.y;
    this.tilt.rotation.x = MathUtils.lerp(TOP_DOWN, ISO_TILT, t) - py * 0.06;
    this.spin.rotation.y = MathUtils.lerp(0, ISO_SPIN, t) + px * 0.1;
  }

  #glow(dt) {
    const active = this.indexOf.get(this.section.dataset.zone) ?? -1;
    const g = this.blocks.glow;
    const k = 1 - Math.exp(-dt * 8);
    for (let i = 0; i < g.length; i += 1) {
      const target = i === active ? 1 : this.base[i];
      g[i] += (target - g[i]) * k;
    }
  }

  #placePins() {
    if (!this.pins[0]?.isConnected) this.#collectPins();
    this.group.updateMatrixWorld(true);
    const cam = this.stage.camera;
    const b = this.box;
    const sw = this.stage.width;
    const sh = this.stage.height;
    const top = b.docTop - this.lastScroll;
    for (let i = 0; i < this.pins.length; i += 1) {
      const pin = this.pins[i];
      if (!pin) continue;
      this.tmp.copy(this.anchors[i]).applyMatrix4(this.content.matrixWorld).project(cam);
      const x = (this.tmp.x * 0.5 + 0.5) * sw - b.left;
      const y = (-this.tmp.y * 0.5 + 0.5) * sh - top;
      if (Math.abs(x - this.pinX[i]) < 0.4 && Math.abs(y - this.pinY[i]) < 0.4) continue;
      this.pinX[i] = x;
      this.pinY[i] = y;
      pin.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    }
  }

  update(dt, time, state) {
    if (this.frame % MEASURE_EVERY === 0) this.#measure();
    this.frame += 1;
    this.lastScroll = state.scrollY;

    this.#layout(state);
    this.#pose(state);
    this.#glow(dt);

    if (!this.reduced) this.flowTime += dt;
    this.flow.update(this.flowTime);
    this.blocks.setTime(this.flowTime);

    const o = state.visibility;
    this.blocks.setOpacity(o);
    this.flow.setOpacity(o);

    this.#placePins();
    if (!this.live && o > 0.05) {
      this.live = true;
      this.section.classList.add('is-gl-live');
    }
  }

  dispose() {
    this.section.classList.remove('is-gl-live');
    super.dispose();
  }
}
