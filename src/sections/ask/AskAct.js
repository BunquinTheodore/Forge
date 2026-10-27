import {
  BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, AdditiveBlending,
  PlaneGeometry, Mesh, Vector2, Vector3, MathUtils,
} from 'three';
import { GLAct } from '../../gl/GLAct.js';
import { ScrollTrigger } from '../../core/Scroll.js';
import { SPARK_VERT, SPARK_FRAG, CORE_VERT, CORE_FRAG } from './ForgeShaders.js';

const MAX_SPARKS = 2400;
const CORE_Z = -1.5;
const POINTER_PULL = 0.18;

const smooth = (a, b, x) => {
  const t = MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Ask finale: drifting ember sparks that converge into a glowing forge core.
 * The core heats up as the visitor scrolls through the public promise toward the CTA,
 * leans toward the pointer, and sparks scatter away from it.
 */
export default class AskAct extends GLAct {
  static order = 5;

  async init() {
    this.finale = this.section.querySelector('.ask__finale');
    this.cta = this.section.querySelector('.ask__send--final');
    this.ctaY = 0;
    this.finaleTop = 0;
    this.finaleHeight = 1;
    this.heat = 0;
    this.clock = 0;
    this.core = new Vector3(0, 0, CORE_Z);
    this.pointerWorld = new Vector2();
    this.baseDetail = this.detail;
    this.count = Math.round(MAX_SPARKS * this.detail);

    this.#buildSparks();
    this.#buildCore();
    this.onRefresh = () => this.#measure();
    ScrollTrigger.addEventListener('refresh', this.onRefresh);
    this.#measure();
  }

  #buildSparks() {
    const n = this.count;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = Math.random() * 2 - 1;
      pos[i * 3 + 1] = Math.random() * 2 - 1;
      pos[i * 3 + 2] = Math.random() * 2 - 1;
      seed[i * 4] = Math.random();
      seed[i * 4 + 1] = Math.random();
      seed[i * 4 + 2] = 1.2 + Math.random() * Math.random() * 4.5;
      seed[i * 4 + 3] = 0.15 + Math.pow(Math.random(), 1.6) * 2.6;
    }
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new Float32BufferAttribute(seed, 4));
    this.sparkMat = this.track(new ShaderMaterial({
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      uniforms: {
        uTime: { value: 0 }, uConverge: { value: 0 }, uHeat: { value: 0 }, uOpacity: { value: 0 },
        uPixel: { value: 1 }, uSpread: { value: new Vector2(8, 5) }, uPointer: { value: new Vector2(99, 99) },
        uCore: { value: this.core },
      },
      transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    }));
    this.sparks = new Points(geo, this.sparkMat);
    this.sparks.frustumCulled = false;
    this.sparkGeo = geo;
    this.group.add(this.sparks);
  }

  #buildCore() {
    const geo = this.track(new PlaneGeometry(1, 1));
    this.coreMat = this.track(new ShaderMaterial({
      vertexShader: CORE_VERT,
      fragmentShader: CORE_FRAG,
      uniforms: { uTime: { value: 0 }, uHeat: { value: 0 }, uOpacity: { value: 0 } },
      transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    }));
    this.coreMesh = new Mesh(geo, this.coreMat);
    this.coreMesh.renderOrder = -1;
    this.group.add(this.coreMesh);
  }

  #measure() {
    if (!this.finale) return;
    const r = this.finale.getBoundingClientRect();
    this.finaleTop = r.top + window.scrollY;
    this.finaleHeight = Math.max(1, r.height);
    if (this.cta) {
      const c = this.cta.getBoundingClientRect();
      this.ctaY = c.top + c.height / 2 + window.scrollY;
    }
  }

  resize(width, height) {
    const v = this.stage.viewSize(CORE_Z);
    this.view = v;
    this.wide = width / height > 1.1 && width >= 768;
    this.sparkMat.uniforms.uSpread.value.set(v.width * 0.6, v.height * 0.6);
    this.sparkMat.uniforms.uPixel.value = this.stage.renderer.getPixelRatio() * height / 80;
    this.#measure();
  }

  onTierChange() {
    const visible = Math.round(this.count * (this.detail / this.baseDetail));
    this.sparkGeo.setDrawRange(0, Math.min(this.count, visible));
  }

  update(dt, time, state) {
    if (!this.device.reducedMotion) this.clock += dt;
    const vh = this.stage.height;
    const f = MathUtils.clamp((state.scrollY + vh - this.finaleTop) / this.finaleHeight, 0, 1);
    const targetHeat = 0.06 + 0.94 * smooth(0.08, 0.92, f);
    this.heat += (targetHeat - this.heat) * Math.min(1, dt * 3);

    const v = this.view;
    const settle = smooth(0.62, 0.9, f);
    const baseX = this.wide ? v.width * 0.24 * (1 - settle) : 0;
    const px = state.pointer.x * v.width * 0.5;
    const py = state.pointer.y * v.height * 0.5;
    // settle onto the final CTA: its document Y is measured on refresh, no per-frame DOM reads
    const ctaScreen = MathUtils.clamp((this.ctaY - state.scrollY) / vh, 0, 1);
    const baseY = -(ctaScreen - 0.5) * v.height * settle;
    this.core.set(baseX + (px - baseX) * POINTER_PULL, baseY + (py - baseY) * POINTER_PULL, CORE_Z);
    if (this.device.coarsePointer) this.pointerWorld.set(99, 99);
    else this.pointerWorld.set(px, py);

    const coreSize = v.height * (0.55 + 0.55 * this.heat) * (this.wide ? 1 : 0.8);
    this.coreMesh.position.copy(this.core);
    this.coreMesh.scale.set(coreSize, coreSize, 1);

    const opacity = state.visibility;
    const su = this.sparkMat.uniforms;
    su.uTime.value = this.clock;
    su.uConverge.value = smooth(0.02, 0.6, f);
    su.uHeat.value = this.heat;
    su.uOpacity.value = opacity;
    su.uPointer.value.copy(this.pointerWorld);

    const cu = this.coreMat.uniforms;
    cu.uTime.value = this.clock;
    cu.uHeat.value = this.heat;
    cu.uOpacity.value = opacity;
  }

  dispose() {
    ScrollTrigger.removeEventListener('refresh', this.onRefresh);
    super.dispose();
  }
}
