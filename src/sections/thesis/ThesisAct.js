import {
  BufferGeometry, BufferAttribute, EdgesGeometry, IcosahedronGeometry, SphereGeometry, PlaneGeometry,
  LineSegments, Mesh, Points, ShaderMaterial, AdditiveBlending, Color, MathUtils,
} from 'three';
import { GLAct } from '../../gl/GLAct.js';
import { WIRE, CORE, GLOW, SPARKS } from './coreShaders.js';

/**
 * ThesisAct: the forged "configuration core".
 * A faceted icosahedron wireframe around a molten inner core, with a shell of orbiting sparks.
 * As the four thesis points scroll by (section data-point) the wireframe breaks apart and
 * reassembles into a new configuration: faceted, sequenced, measured (geodesic), corridor (stretched).
 */
const POINT_STATES = [
  { round: 0.0, stretch: 0.0, scale: 1.0, core: 0.8 },
  { round: 0.2, stretch: 0.0, scale: 1.08, core: 1.05 },
  { round: 1.0, stretch: 0.0, scale: 1.0, core: 0.95 },
  { round: 0.5, stretch: 0.5, scale: 0.94, core: 1.2 },
];
const RADIUS = 1.6;
const BASE_SPARKS = 420;
const SMOOTH = 2.6;

export default class ThesisAct extends GLAct {
  static order = 2;

  async init() {
    this.point = 0;
    this.pointSmooth = 0;
    this.layout = { x: 0, y: 0, s: 1, o: 1 };
    this.still = this.device.reducedMotion;

    this.#buildWire();
    this.#buildCore();
    this.#buildSparks();
  }

  #buildWire() {
    const ico = this.track(new IcosahedronGeometry(RADIUS, 1));
    const edges = this.track(new EdgesGeometry(ico, 1));
    const pos = edges.getAttribute('position');
    const count = pos.count;
    const mid = new Float32Array(count * 3);
    const rand = new Float32Array(count);
    for (let i = 0; i < count; i += 2) {
      const r = Math.random();
      for (let k = 0; k < 3; k += 1) {
        const m = (pos.array[i * 3 + k] + pos.array[(i + 1) * 3 + k]) * 0.5;
        mid[i * 3 + k] = m;
        mid[(i + 1) * 3 + k] = m;
      }
      rand[i] = r;
      rand[i + 1] = r;
    }
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', pos);
    geo.setAttribute('aMid', new BufferAttribute(mid, 3));
    geo.setAttribute('aRand', new BufferAttribute(rand, 1));

    this.wireMat = this.track(new ShaderMaterial({
      vertexShader: WIRE.vertex,
      fragmentShader: WIRE.fragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uExplode: { value: 0 }, uRound: { value: 0 }, uStretch: { value: 0 }, uRadius: { value: RADIUS },
        uSteel: { value: new Color('#7f8996') }, uEmber: { value: new Color('#ff7a2f') },
        uHeat: { value: 1 }, uOpacity: { value: 0 },
      },
    }));
    this.wire = new LineSegments(geo, this.wireMat);
    this.group.add(this.wire);
  }

  #buildCore() {
    const seg = this.detail >= 1 ? 40 : 24;
    this.coreMat = this.track(new ShaderMaterial({
      vertexShader: CORE.vertex,
      fragmentShader: CORE.fragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uEmber: { value: new Color('#e85b22') }, uHot: { value: new Color('#ffb36b') },
        uPower: { value: 1 }, uOpacity: { value: 0 }, uTime: { value: 0 },
      },
    }));
    this.core = new Mesh(this.track(new SphereGeometry(0.52, seg, Math.round(seg / 2))), this.coreMat);
    this.group.add(this.core);

    this.glowMat = this.track(new ShaderMaterial({
      vertexShader: GLOW.vertex,
      fragmentShader: GLOW.fragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uEmber: { value: new Color('#e85b22') }, uOpacity: { value: 0 } },
    }));
    this.glow = new Mesh(this.track(new PlaneGeometry(4.2, 4.2)), this.glowMat);
    this.group.add(this.glow);
  }

  #buildSparks() {
    const count = Math.max(60, Math.round(BASE_SPARKS * this.detail));
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < seeds.length; i += 1) seeds[i] = Math.random();
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 3));
    this.sparkMat = this.track(new ShaderMaterial({
      vertexShader: SPARKS.vertex,
      fragmentShader: SPARKS.fragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uSize: { value: 5 * Math.min(window.devicePixelRatio || 1, this.device.maxDpr) },
        uSpread: { value: 1 }, uColor: { value: new Color('#ffb36b') }, uOpacity: { value: 0 },
      },
    }));
    this.sparks = new Points(geo, this.sparkMat);
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks);
  }

  resize(width, height) {
    const view = this.stage.viewSize(0);
    const wide = width / height >= 1.05 && width >= 900;
    const fit = Math.min(view.width, view.height);
    this.layout.x = wide ? view.width * 0.3 : 0;
    this.layout.y = wide ? view.height * 0.04 : view.height * 0.12;
    this.layout.s = wide ? fit * 0.165 : fit * 0.14;
    this.layout.o = wide ? 1 : 0.55;
    this.sparkMat.uniforms.uSize.value = 5 * Math.min(window.devicePixelRatio || 1, this.device.maxDpr);
  }

  #readSection() {
    const p = Number(this.section.dataset.point);
    if (p >= 0 && p < POINT_STATES.length) this.point = p;
  }

  update(dt, time, state) {
    this.#readSection();
    const k = 1 - Math.exp(-dt * SMOOTH);
    this.pointSmooth += (this.point - this.pointSmooth) * k;

    const i0 = Math.floor(this.pointSmooth);
    const i1 = Math.min(i0 + 1, POINT_STATES.length - 1);
    const f = this.pointSmooth - i0;
    const a = POINT_STATES[i0];
    const b = POINT_STATES[i1];
    const travel = Math.min(Math.abs(this.point - this.pointSmooth), 1);
    const t = this.still ? 0 : time;

    const wu = this.wireMat.uniforms;
    wu.uRound.value = MathUtils.lerp(a.round, b.round, f);
    wu.uStretch.value = MathUtils.lerp(a.stretch, b.stretch, f);
    wu.uExplode.value = Math.sin(travel * Math.PI * 0.5) * 1.1 + Math.abs(state.velocity) * 0.004;
    wu.uHeat.value = 1;

    const o = state.visibility * this.layout.o;
    wu.uOpacity.value = o * 0.9;
    const power = MathUtils.lerp(a.core, b.core, f);
    this.coreMat.uniforms.uPower.value = power;
    this.coreMat.uniforms.uOpacity.value = o;
    this.coreMat.uniforms.uTime.value = t;
    this.glowMat.uniforms.uOpacity.value = o * 0.55 * power;
    this.sparkMat.uniforms.uOpacity.value = o;
    this.sparkMat.uniforms.uTime.value = t;
    this.sparkMat.uniforms.uSpread.value = 1 + travel * 0.8;

    this.#place(state, t, MathUtils.lerp(a.scale, b.scale, f));
  }

  #place(state, t, scale) {
    const g = this.group;
    const L = this.layout;
    g.position.set(L.x, L.y + (0.5 - state.progress) * 1.6, 0);
    g.scale.setScalar(L.s * scale);
    this.wire.rotation.y = t * 0.12 + state.progress * 3.2 + state.pointer.x * 0.35;
    this.wire.rotation.x = 0.35 + state.pointer.y * -0.25 + state.progress * 0.6;
    this.core.rotation.copy(this.wire.rotation);
    this.sparks.rotation.x = 0.3 + state.pointer.y * -0.15;
    this.glow.position.z = -0.6;
  }
}
