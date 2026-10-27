import {
  BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Color, Mesh, PlaneGeometry, Vector2,
} from 'three';
import { GLAct } from '../../gl/GLAct.js';
import { emberVertex, emberFragment, horizonVertex, horizonFragment } from './emberShaders.js';

const BASE_COUNT = 2600;
const FOV_TAN = 0.6306;        // 2 * tan(35deg / 2)
const ERUPT_FROM = 0.55;
const ERUPT_TO = 0.95;
const RUN_SHARE = 0.7;        // matches ContinuationScenes RUN
const FLOW_HORIZON = -0.3;     // horizon as a fraction of view height when the ruler is vertical

const cssColor = (name, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new Color(v || fallback);
};

/**
 * Ember field under a horizon. The horizon tracks the 90-day ruler (the ground line);
 * as the film nears D+90 the embers erupt upward through it.
 */
export default class ContinuationAct extends GLAct {
  static order = 2;

  async init() {
    this.baseDetail = this.detail;
    this.count = Math.round(BASE_COUNT * this.detail);
    this.ruler = this.section.querySelector('.cont__ruler');
    this.ground = this.section.querySelector('.cont__og');
    this.heat = 0;
    this.erupt = 0;
    this.horizon = 0;
    this.view = this.stage.viewSize(0);
    this.time = 0;

    const colors = {
      uDeep: { value: cssColor('--ember-deep', '#a8340f') },
      uEmber: { value: cssColor('--ember', '#e85b22') },
      uGlow: { value: cssColor('--ember-glow', '#ffb36b') },
    };
    this.#buildEmbers(colors);
    this.#buildHorizon(colors);
  }

  #buildEmbers(colors) {
    const n = this.count;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * 1.15;
      pos[i * 3 + 1] = Math.random() ** 1.6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
      seed[i * 4] = Math.random();
      seed[i * 4 + 1] = 0.5 + Math.random() * 0.9;
      seed[i * 4 + 2] = 0.025 + Math.random() ** 3 * 0.07;
      seed[i * 4 + 3] = Math.random() * 100;
    }
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new BufferAttribute(seed, 4));
    this.geo = geo;

    this.emberMat = this.track(new ShaderMaterial({
      vertexShader: emberVertex,
      fragmentShader: emberFragment,
      uniforms: {
        ...colors,
        uTime: { value: 0 }, uErupt: { value: 0 }, uHeat: { value: 0 }, uVis: { value: 0 },
        uHorizon: { value: 0 }, uDepth: { value: 1 }, uHeight: { value: 4 }, uScale: { value: 1 }, uWidth: { value: 1 },
        uPointer: { value: new Vector2() },
      },
      transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    }));
    this.points = new Points(geo, this.emberMat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  #buildHorizon(colors) {
    const geo = this.track(new PlaneGeometry(1, 1));
    this.horizonMat = this.track(new ShaderMaterial({
      vertexShader: horizonVertex,
      fragmentShader: horizonFragment,
      uniforms: {
        uEmber: colors.uEmber, uGlow: colors.uGlow,
        uHeat: { value: 0 }, uErupt: { value: 0 }, uVis: { value: 0 }, uTime: { value: 0 },
      },
      transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    }));
    this.horizonMesh = new Mesh(geo, this.horizonMat);
    this.horizonMesh.frustumCulled = false;
    this.group.add(this.horizonMesh);
  }

  resize(width, height) {
    if (!this.points) return;
    this.view = this.stage.viewSize(0);
    const dpr = this.stage.renderer.getPixelRatio();
    const u = this.emberMat.uniforms;
    u.uScale.value = (height * dpr) / FOV_TAN;
    u.uDepth.value = this.view.height * 0.22;
    u.uHeight.value = this.view.height * 0.95;
    u.uWidth.value = this.view.width;
    this.horizonMesh.scale.set(this.view.width * 1.1, this.view.height * 0.5, 1);
    this.width = width;
  }

  onTierChange() {
    this.geo?.setDrawRange(0, Math.round(this.count * (this.detail / this.baseDetail)));
    this.resize(this.stage.width, this.stage.height);
  }

  #targetHorizon() {
    const h = this.stage.height;
    if (!this.section.classList.contains('is-film')) {
      // Flow mode: sit on OVERGROUND's ground line so the glow never lies behind the copy below it.
      if (!this.ground) return FLOW_HORIZON * this.view.height;
      const bottom = this.ground.getBoundingClientRect().bottom;
      const cy = Math.min(Math.max(bottom, 0), h * (0.5 - FLOW_HORIZON));
      return -(cy / h - 0.5) * this.view.height;
    }
    const r = this.ruler.getBoundingClientRect();
    const cy = r.top + r.height / 2;
    return -(cy / h - 0.5) * this.view.height;
  }

  update(dt, time, state) {
    if (!this.device.reducedMotion) this.time += dt;
    const heat = Number(this.section.dataset.heat) || 0;
    const k = Math.min(1, dt * 3);
    this.heat += (heat - this.heat) * k;
    const e = Math.min(1, Math.max(0, (this.heat - ERUPT_FROM) / (ERUPT_TO - ERUPT_FROM)));
    this.erupt += (e * e * (3 - 2 * e) - this.erupt) * k;
    this.horizon += (this.#targetHorizon() - this.horizon) * Math.min(1, dt * 8);

    const u = this.emberMat.uniforms;
    u.uTime.value = this.time;
    u.uHeat.value = this.heat;
    u.uErupt.value = this.erupt;
    u.uVis.value = state.visibility;
    u.uHorizon.value = this.horizon;
    u.uPointer.value.set(state.pointer.x, state.pointer.y);

    const h = this.horizonMat.uniforms;
    h.uHeat.value = Math.min(1, this.heat / RUN_SHARE);
    h.uErupt.value = this.erupt;
    h.uVis.value = state.visibility;
    h.uTime.value = this.time;
    this.horizonMesh.position.y = this.horizon;
  }
}
