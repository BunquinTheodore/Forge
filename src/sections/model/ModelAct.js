import {
  BoxGeometry, BufferGeometry, BufferAttribute, Color, Group, Mesh, Points, ShaderMaterial, Vector2,
  AdditiveBlending, NormalBlending, DoubleSide,
} from 'three';
import { GLAct } from '../../gl/GLAct.js';
import { plateVertex, plateFragment, sparkVertex, sparkFragment } from './plateShaders.js';

const PLATES = 4;
const ALL = 5;
const HALF = new Vector2(0.5, 0.32);
const FOV_TAN = 0.6306;          // 2 * tan(35deg / 2)
const COMPACT_WIDTH = 900;       // below this the CSS stack is used
const SPARKS = 220;
const MEASURE_EVERY = 30;        // frames between DOM rect refreshes (catches late layout shifts)

const cssColor = (name, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new Color(v || fallback);
};
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Four forged glass/metal plates aligned to .model__stage. They drop in, separate and
 * rotate with scroll; the active layer (section.dataset.layer) glows, a picked one lifts.
 */
export default class ModelAct extends GLAct {
  static order = 3;

  async init() {
    this.stageEl = this.section.querySelector('.model__stage');
    this.time = 0;
    this.view = this.stage.viewSize(0);
    this.heat = new Float32Array(PLATES);
    this.lift = new Float32Array(PLATES);
    this.sparkY = 0;
    this.frame = 0;
    this.box = {
      ok: false, left: 0, width: 1, height: 1, naturalTop: 0, stickyTop: null, limitBottom: 0,
    };
    this.colors = {
      uSteel: { value: cssColor('--steel', '#293342') },
      uSteelHi: { value: cssColor('--mute', '#7f8996') },
      uEmber: { value: cssColor('--ember', '#e85b22') },
      uGlow: { value: cssColor('--ember-glow', '#ffb36b') },
    };
    this.stack = new Group();
    this.group.add(this.stack);
    this.#buildPlates();
    this.#buildSparks();
  }

  #buildPlates() {
    const geo = this.track(new BoxGeometry(1, 0.05, HALF.y * 2, 1, 1, 1));
    this.plates = [];
    for (let i = 0; i < PLATES; i += 1) {
      const mat = this.track(new ShaderMaterial({
        vertexShader: plateVertex,
        fragmentShader: plateFragment,
        uniforms: {
          ...this.colors,
          uActive: { value: 0 }, uVis: { value: 0 }, uTime: { value: 0 }, uHalf: { value: HALF },
        },
        transparent: true, depthWrite: false, side: DoubleSide, blending: NormalBlending,
      }));
      const mesh = new Mesh(geo, mat);
      mesh.renderOrder = i;
      this.stack.add(mesh);
      this.plates.push(mesh);
    }
  }

  #buildSparks() {
    const n = Math.max(40, Math.round(SPARKS * this.detail));
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * 0.9;
      pos[i * 3 + 1] = 0.03;
      pos[i * 3 + 2] = (Math.random() - 0.5) * HALF.y * 1.8;
      seed[i * 3] = Math.random();
      seed[i * 3 + 1] = 0.4 + Math.random();
      seed[i * 3 + 2] = 0.006 + Math.random() * 0.014;
    }
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new BufferAttribute(seed, 3));
    this.sparkMat = this.track(new ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: sparkFragment,
      uniforms: {
        uEmber: this.colors.uEmber, uGlow: this.colors.uGlow,
        uTime: { value: 0 }, uScale: { value: 1 }, uRise: { value: 0.45 }, uAmount: { value: 0 },
      },
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    }));
    this.sparks = new Points(geo, this.sparkMat);
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = PLATES + 1;
    this.stack.add(this.sparks);
  }

  resize(width, height) {
    this.view = this.stage.viewSize(0);
    this.pxScale = (height * this.stage.renderer.getPixelRatio()) / FOV_TAN;
    this.frame = 0;
    this.#measure();
  }

  /**
   * Cache the stage geometry in document space. The stage is position: sticky inside
   * .model__aside on desktop, so its viewport top is reconstructed per frame from the
   * natural top, the sticky offset and the aside bottom, with no layout reads.
   */
  #measure() {
    const b = this.box;
    if (!this.stageEl || this.stage.width < COMPACT_WIDTH) { b.ok = false; return; }
    const aside = this.stageEl.parentElement;
    const scroll = window.scrollY;
    const a = aside.getBoundingClientRect();
    const r = this.stageEl.getBoundingClientRect();
    const cs = getComputedStyle(this.stageEl);
    const sticky = cs.position === 'sticky' ? parseFloat(cs.top) : NaN;
    // offsetTop of a stuck element includes the sticky shift, so derive the unstuck offset.
    const prev = this.stageEl.previousElementSibling;
    const offset = prev
      ? prev.offsetTop + prev.offsetHeight
      : parseFloat(getComputedStyle(aside).paddingTop) || 0;
    b.left = r.left;
    b.width = r.width;
    b.height = r.height;
    b.naturalTop = a.top + scroll + offset + (parseFloat(cs.marginTop) || 0);
    b.stickyTop = Number.isFinite(sticky) ? sticky : null;
    b.limitBottom = a.bottom + scroll;
    b.ok = r.width > 0;
  }

  #viewportTop(scrollY) {
    const b = this.box;
    const natural = b.naturalTop - scrollY;
    if (b.stickyTop === null) return natural;
    const capped = Math.min(b.stickyTop, b.limitBottom - scrollY - b.height);
    return Math.max(natural, capped);
  }

  /** Align the stack with the DOM stage. Returns false when it should not draw. */
  #place(scrollY) {
    if (this.stage.width < COMPACT_WIDTH) return false;
    if (this.frame % MEASURE_EVERY === 0) this.#measure();
    this.frame += 1;
    const b = this.box;
    if (!b.ok) return false;
    const top = this.#viewportTop(scrollY);
    const W = this.stage.width;
    const H = this.stage.height;
    if (top + b.height < 0 || top > H) return false;
    const v = this.view;
    this.stack.position.x = ((b.left + b.width / 2) / W - 0.5) * v.width;
    this.stack.position.y = -((top + b.height / 2) / H - 0.5) * v.height;
    const s = Math.min((b.width / W) * v.width * 0.56, (b.height / H) * v.height * 0.46);
    this.stack.scale.setScalar(s);
    this.scale = s;
    return true;
  }

  update(dt, time, state) {
    if (!this.#place(state.scrollY)) { this.group.visible = false; return; }
    if (!this.device.reducedMotion) this.time += dt;
    const p = state.progress;
    const enter = smooth(0.04, 0.24, p);
    const spread = smooth(0.14, 0.45, p);
    const layer = Number(this.section.dataset.layer) || 0;
    const lifted = this.section.dataset.lift === '1';
    const k = Math.min(1, dt * 6);

    this.stack.rotation.x = 0.5 - state.pointer.y * 0.12;
    this.stack.rotation.y = -0.75 + p * 1.15 + state.pointer.x * 0.3;
    const gap = 0.07 + 0.2 * spread;
    let top = -1;
    let amount = 0;
    for (let i = 0; i < PLATES; i += 1) {
      const on = layer === i + 1 || layer === ALL;
      this.heat[i] += ((on ? 1 : 0) - this.heat[i]) * k;
      this.lift[i] += ((lifted && layer === i + 1 ? 1 : 0) - this.lift[i]) * k;
      if (on) { top = i; amount = Math.max(amount, this.heat[i]); }
      this.#posePlate(i, gap, spread, enter, state.visibility);
    }
    this.#poseSparks(top, amount * enter * state.visibility, k);
  }

  #posePlate(i, gap, spread, enter, vis) {
    const m = this.plates[i];
    const drop = (1 - enter) * (1.4 + i * 0.5);
    m.position.y = (i - 1.5) * gap + this.heat[i] * 0.05 + this.lift[i] * 0.16 + drop;
    m.rotation.y = (i - 1.5) * 0.16 * spread + this.lift[i] * 0.3;
    m.rotation.z = this.lift[i] * 0.07;
    const u = m.material.uniforms;
    u.uActive.value = this.heat[i];
    u.uVis.value = vis * enter;
    u.uTime.value = this.time;
  }

  #poseSparks(top, amount, k) {
    if (top >= 0) this.sparkY += (this.plates[top].position.y - this.sparkY) * k;
    this.sparks.position.y = this.sparkY;
    if (top >= 0) this.sparks.rotation.y = this.plates[top].rotation.y;
    const u = this.sparkMat.uniforms;
    u.uTime.value = this.time;
    u.uAmount.value = amount;
    u.uScale.value = this.pxScale * this.scale;
  }
}
