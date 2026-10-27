import { BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Color, MathUtils } from 'three';
import { GLAct } from '../../gl/GLAct.js';
import { CLOUD, SPARK } from './chasmShaders.js';

/**
 * ProblemAct: two particle clouds (opportunity, cool steel / investability, ember) on either side
 * of a dark chasm. Sparse sparks try to cross and die midway. The chasm opens with scroll and
 * narrows as the visitor closes the bridge (section data-bridge, 0..1); sparks then make it across.
 * Two draw calls in total.
 */
const BASE_CLOUD = 2600;
const BASE_SPARKS = 180;
const SMOOTH = 3;

export default class ProblemAct extends GLAct {
  static order = 2;

  async init() {
    this.bridge = 0;
    this.still = this.device.reducedMotion;
    const dpr = Math.min(window.devicePixelRatio || 1, this.device.maxDpr);

    this.shared = {
      uTime: { value: 0 }, uOpen: { value: 0.5 }, uBridge: { value: 0 },
      uHalfW: { value: 5 }, uHalfH: { value: 3 },
    };
    this.cloudMat = this.#material(CLOUD, {
      uSize: { value: 3.2 * dpr }, uOpacity: { value: 0 },
      uCool: { value: new Color('#aeb7c4') }, uWarm: { value: new Color('#e85b22') }, uHot: { value: new Color('#ffb36b') },
    });
    this.sparkMat = this.#material(SPARK, {
      uSize: { value: 4.5 * dpr }, uOpacity: { value: 0 }, uColor: { value: new Color('#ff7a2f') },
    });

    this.cloud = this.#points(this.#cloudGeometry(), this.cloudMat);
    this.sparks = this.#points(this.#sparkGeometry(), this.sparkMat);
  }

  #material(src, uniforms) {
    return this.track(new ShaderMaterial({
      vertexShader: src.vertex,
      fragmentShader: src.fragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { ...this.shared, ...uniforms },
    }));
  }

  #points(geo, mat) {
    const pts = new Points(geo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
    return pts;
  }

  #cloudGeometry() {
    const count = Math.max(400, Math.round(BASE_CLOUD * this.detail));
    const seeds = new Float32Array(count * 4);
    const side = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      for (let k = 0; k < 4; k += 1) seeds[i * 4 + k] = Math.random();
      side[i] = i % 2 === 0 ? -1 : 1;
    }
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    geo.setAttribute('aSide', new BufferAttribute(side, 1));
    return geo;
  }

  #sparkGeometry() {
    const count = Math.max(40, Math.round(BASE_SPARKS * this.detail));
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < seeds.length; i += 1) seeds[i] = Math.random();
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 3));
    return geo;
  }

  resize() {
    const view = this.stage.viewSize(0);
    this.shared.uHalfW.value = view.width / 2;
    this.shared.uHalfH.value = view.height / 2;
  }

  update(dt, time, state) {
    const target = Number(this.section.dataset.bridge) || 0;
    const k = 1 - Math.exp(-dt * SMOOTH);
    this.bridge += (target - this.bridge) * k;

    // The chasm opens as the section scrolls in, and narrows (slightly) as the bridge closes.
    const scrollOpen = MathUtils.smoothstep(state.progress, 0.12, 0.45);
    const u = this.shared;
    u.uOpen.value = (0.25 + scrollOpen * 0.75) * (1 - this.bridge * 0.7);
    u.uBridge.value = this.bridge;
    u.uTime.value = this.still ? 0 : time;

    const o = state.visibility;
    this.cloudMat.uniforms.uOpacity.value = o;
    this.sparkMat.uniforms.uOpacity.value = o * (0.6 + this.bridge * 0.4);

    const g = this.group;
    g.position.y = (0.5 - state.progress) * 1.2;
    g.rotation.y = state.pointer.x * 0.12;
    g.rotation.x = state.pointer.y * -0.06;
  }
}
