import { Group, Mesh, Points, TorusGeometry, BufferGeometry, BufferAttribute, ShaderMaterial, AdditiveBlending, Color, MathUtils } from 'three';
import { GLAct } from '../../gl/GLAct.js';
import { RING_VERT, RING_FRAG, SPARK_VERT, SPARK_FRAG } from './ringShaders.js';

const RINGS = [
  { radius: 1, tilt: [1.15, 0.2, 0], speed: 0.12 },     // smart capital
  { radius: 0.82, tilt: [0.3, 1.1, 0.4], speed: -0.09 }, // risk intelligence
  { radius: 0.64, tilt: [-0.6, 0.5, 1.2], speed: 0.15 }, // risk sharing
];
const SPARKS_PER_RING = 90;
const MEASURE_EVERY = 30;
const PROJ_K = 1 / (2 * Math.tan(MathUtils.degToRad(35 / 2)));

/**
 * CAPITAL act: three slowly orbiting forged rings, one per capital
 * (smart capital, risk intelligence, risk sharing). Scroll turns the gyroscope,
 * section.dataset.capital heats the matching ring. Anchored to .capital__orbit.
 */
export default class CapitalAct extends GLAct {
  static order = 2;

  async init() {
    this.anchor = this.section.querySelector('.capital__orbit');
    this.box = { docTop: 0, left: 0, width: 1, height: 1 };
    this.frame = 0;
    this.clock = 0;
    this.reduced = this.device.reducedMotion;
    this.heat = new Float32Array(RINGS.length);
    this.rings = RINGS.map((cfg, i) => this.#buildRing(cfg, i));
    this.#measure();
  }

  #buildRing(cfg, i) {
    const pivot = new Group();
    pivot.rotation.set(cfg.tilt[0], cfg.tilt[1], cfg.tilt[2]);
    const seg = Math.round(MathUtils.lerp(90, 200, this.detail));
    const geo = this.track(new TorusGeometry(cfg.radius, 0.022 + i * 0.004, 12, seg));
    const mat = this.track(new ShaderMaterial({
      vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uHeat: { value: 0 }, uOpacity: { value: 0 }, uSeed: { value: i * 7.13 },
        uSteel: { value: new Color('#3a4656') }, uEmber: { value: new Color('#e85b22') }, uHot: { value: new Color('#ffb36b') },
      },
    }));
    const mesh = new Mesh(geo, mat);
    const spin = new Group();
    spin.add(mesh, this.#buildSparks(cfg, mat.uniforms));
    pivot.add(spin);
    this.group.add(pivot);
    return { cfg, pivot, spin, mat };
  }

  #buildSparks(cfg, ringUniforms) {
    const n = Math.max(20, Math.round(SPARKS_PER_RING * this.detail));
    const angle = new Float32Array(n);
    const seed = new Float32Array(n);
    for (let k = 0; k < n; k += 1) { angle[k] = Math.random() * Math.PI * 2; seed[k] = Math.random(); }
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aAngle', new BufferAttribute(angle, 1));
    geo.setAttribute('aSeed', new BufferAttribute(seed, 1));
    const mat = this.track(new ShaderMaterial({
      vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: ringUniforms.uTime, uHeat: ringUniforms.uHeat, uOpacity: ringUniforms.uOpacity,
        uRadius: { value: cfg.radius }, uPixel: { value: 600 },
        uEmber: ringUniforms.uEmber, uHot: ringUniforms.uHot,
      },
    }));
    const pts = new Points(geo, mat);
    pts.frustumCulled = false;
    this.sparkMats = this.sparkMats || [];
    this.sparkMats.push(mat);
    return pts;
  }

  #measure() {
    if (!this.anchor) return;
    const r = this.anchor.getBoundingClientRect();
    this.box.docTop = r.top + window.scrollY;
    this.box.left = r.left;
    this.box.width = Math.max(1, r.width);
    this.box.height = Math.max(1, r.height);
  }

  resize() { this.#measure(); this.frame = 0; }

  #layout(state) {
    const b = this.box;
    const stage = this.stage;
    const z = -1.5;
    const v = stage.viewSize(z);
    const cx = (b.left + b.width / 2) / stage.width - 0.5;
    const cy = (b.docTop - state.scrollY + b.height / 2) / stage.height - 0.5;
    const s = ((b.width / stage.width) * v.width) * 0.36;
    this.group.position.set(cx * v.width + state.pointer.x * 0.15, -cy * v.height + state.pointer.y * 0.1, z);
    this.group.scale.setScalar(s);
    const px = stage.height * stage.renderer.getPixelRatio() * PROJ_K * s;
    for (const m of this.sparkMats) m.uniforms.uPixel.value = px;
  }

  update(dt, time, state) {
    if (this.frame % MEASURE_EVERY === 0) this.#measure();
    this.frame += 1;
    if (!this.reduced) this.clock += dt;
    this.#layout(state);

    const active = this.section.dataset.capital;
    const activeIdx = active === undefined ? -1 : Number(active);
    const k = 1 - Math.exp(-dt * 5);
    const turn = this.reduced ? 0 : state.progress * Math.PI * 1.2;
    this.group.rotation.z = turn * 0.25;

    for (let i = 0; i < this.rings.length; i += 1) {
      const ring = this.rings[i];
      const target = activeIdx === i ? 1 : activeIdx === -1 ? 0.2 : 0.06;
      this.heat[i] += (target - this.heat[i]) * k;
      ring.spin.rotation.z = this.clock * ring.cfg.speed + turn * (i % 2 ? -1 : 1);
      ring.pivot.rotation.y = ring.cfg.tilt[1] + turn * 0.3;
      const u = ring.mat.uniforms;
      u.uTime.value = this.clock;
      u.uHeat.value = this.heat[i];
      u.uOpacity.value = state.visibility * (0.45 + this.heat[i] * 0.55);
    }

    if (!this.live && state.visibility > 0.05) {
      this.live = true;
      this.section.classList.add('is-gl-live');
    }
  }

  dispose() {
    this.section.classList.remove('is-gl-live');
    super.dispose();
  }
}
