import {
  BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Color, MathUtils,
} from 'three';
import { GLAct } from '../../gl/GLAct.js';
import { pageHeat } from './heat.js';
import { DUST_VERTEX, DUST_FRAGMENT, STREAK_VERTEX, STREAK_FRAGMENT } from './ambientShaders.js';

const DUST_BASE = 1500;
const STREAK_BASE = 16;
const NEAR_Z = 2.5;
const FAR_Z = -9;
const FOV = 35;
const VEL_RANGE = 38;        // px/frame of scroll velocity that counts as "fast"
const INTRO_SECONDS = 1.8;
const POINTER_DRIFT = 0.18;  // world units of parallax on pointer move

/**
 * Persistent page-wide atmosphere: depth-layered ember dust plus a few slow
 * light streaks. Two Points draws. Streaks stretch with scroll velocity and the
 * colour temperature follows page progress (see heat.js).
 */
export default class AmbientAct extends GLAct {
  static global = true;
  static order = -10;

  async init() {
    const css = getComputedStyle(document.documentElement);
    const token = (name, fallback) => new Color(css.getPropertyValue(name).trim() || fallback);
    this.uniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uVel: { value: 0 },
      uHeat: { value: 0.4 },
      uOpacity: { value: 0 },
      uPR: { value: this.stage.renderer.getPixelRatio() },
      uAspect: { value: this.stage.width / this.stage.height },
      uTanHalf: { value: Math.tan(MathUtils.degToRad(FOV / 2)) },
      uCool: { value: token('--fog', '#aeb7c4').lerp(new Color('#4f7fb0'), 0.55) },
      uWarm: { value: token('--ember', '#e85b22') },
      uHot: { value: token('--ember-glow', '#ffb36b') },
      uSize: { value: 5.5 },
      uLength: { value: 150 },
    };
    this.time = 0;
    this.vel = 0;
    this.intro = 0;
    this.baseDetail = this.detail;
    this.timeScale = this.device.reducedMotion ? 0 : 1;

    this.dust = this.#buildDust(Math.round(DUST_BASE * this.detail));
    this.streaks = this.#buildStreaks(Math.round(STREAK_BASE * Math.max(0.5, this.detail)));
    this.group.add(this.dust, this.streaks);
  }

  #material(vertexShader, fragmentShader) {
    return this.track(new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    }));
  }

  #buildDust(count) {
    const pos = new Float32Array(count * 3);
    const rand = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const depth = Math.random() ** 1.6; // more particles far away
      pos[i * 3] = Math.random() * 2 - 1;
      pos[i * 3 + 1] = Math.random() * 2 - 1;
      pos[i * 3 + 2] = MathUtils.lerp(FAR_Z, NEAR_Z, depth);
      rand[i * 4] = Math.random();
      rand[i * 4 + 1] = Math.random();
      rand[i * 4 + 2] = Math.random();
      rand[i * 4 + 3] = Math.random();
    }
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aRand', new BufferAttribute(rand, 4));
    const points = new Points(geo, this.#material(DUST_VERTEX, DUST_FRAGMENT));
    points.frustumCulled = false;
    points.renderOrder = -10;
    return points;
  }

  #buildStreaks(count) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = Math.random() * 2.4 - 1.2;
      pos[i * 3 + 2] = MathUtils.lerp(FAR_Z * 0.7, NEAR_Z * 0.4, Math.random());
      seed[i * 4] = Math.random();
      seed[i * 4 + 1] = MathUtils.lerp(0.12, 0.42, Math.random()); // rising to the right, like the poster ribbon
      seed[i * 4 + 2] = Math.random();
      seed[i * 4 + 3] = Math.random();
    }
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new BufferAttribute(seed, 4));
    const points = new Points(geo, this.#material(STREAK_VERTEX, STREAK_FRAGMENT));
    points.frustumCulled = false;
    points.renderOrder = -9;
    return points;
  }

  resize(width, height) {
    if (!this.uniforms) return;
    this.uniforms.uAspect.value = width / height;
    this.uniforms.uPR.value = this.stage.renderer.getPixelRatio();
  }

  onTierChange() {
    const ratio = Math.min(1, this.detail / this.baseDetail);
    const dustCount = this.dust.geometry.attributes.position.count;
    this.dust.geometry.setDrawRange(0, Math.round(dustCount * ratio));
    this.uniforms.uPR.value = this.stage.renderer.getPixelRatio();
  }

  update(dt, time, state) {
    const u = this.uniforms;
    this.time += dt * this.timeScale;
    this.intro = Math.min(1, this.intro + dt / INTRO_SECONDS);

    const targetVel = this.timeScale ? Math.min(1, Math.abs(state.velocity) / VEL_RANGE) : 0;
    this.vel += (targetVel - this.vel) * Math.min(1, dt * 5);

    u.uTime.value = this.time;
    u.uVel.value = this.vel;
    u.uScroll.value = state.scrollY / this.stage.height;
    u.uHeat.value += (pageHeat(state.pageProgress) - u.uHeat.value) * Math.min(1, dt * 2);
    u.uOpacity.value = state.visibility * this.intro * this.intro;

    if (this.timeScale) {
      this.group.position.x = state.pointer.x * POINTER_DRIFT;
      this.group.position.y = state.pointer.y * POINTER_DRIFT * 0.6;
    }
  }
}
