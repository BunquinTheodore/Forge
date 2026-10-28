import { MathUtils } from 'three';
import { GLAct } from '../../gl/GLAct.js';
import { Ribbon } from './gl/Ribbon.js';
import { Sparks } from './gl/Sparks.js';
import { Network } from './gl/Network.js';
import { readPalette } from './gl/palette.js';

const FOV = 35;
const SPARKS_MAX = 1500;
const NODES_MAX = 44;
const PORTRAIT_ASPECT = 0.9;
const FRAME_SPRING = 4;
const SCROLL_SPRING = 5;
const REDUCED_TIME = 6.5;    // frozen moment used for reduced motion

/**
 * The hero's signature 3D piece: a molten forged ribbon (several twisted strands with
 * ember cracks), sparks lifting off it and the glowing network from the poster.
 * Purely passive: scrolling the sticky hero twists, unravels and pulls the ribbon toward the camera.
 */
export default class HeroAct extends GLAct {
  static order = 1;

  async init() {
    const palette = readPalette();
    const d = this.detail;
    this.reduced = this.device.reducedMotion;
    this.clock = this.reduced ? REDUCED_TIME : 0;
    this.scrollS = 0;
    this.stream = 0;
    this.frame = { x: 0, y: 0, z: 0, scale: 1, rotY: 0 };
    this.measured = { top: 0, range: 1 };

    this.shared = {
      uTime: { value: this.clock },
      uOpacity: { value: 0 },
      uTwist: { value: 0 },
      uUnravel: { value: 0 },
    };

    this.ribbon = new Ribbon({
      strands: d >= 1 ? 6 : 5, segments: Math.round(220 * d + 60), palette, shared: this.shared, lowDetail: d < 1,
    });
    this.sparks = new Sparks({ count: Math.round(SPARKS_MAX * d), ribbon: this.ribbon, palette, shared: this.shared });
    this.network = new Network({ nodes: Math.round(NODES_MAX * d + 8), palette, shared: this.shared });
    this.track(...this.ribbon.disposables, ...this.sparks.disposables, ...this.network.disposables);

    this.group.add(this.ribbon.body, this.ribbon.glow, this.network.lines, this.network.nodes, this.sparks.points);
  }

  resize(width, height) {
    const portrait = width / height < PORTRAIT_ASPECT;
    const v = this.stage.viewSize(0);
    const f = this.frame;
    if (portrait) {
      f.scale = Math.min(v.width / 6.4, v.height / 9);
      f.x = v.width * 0.06;
      f.y = -v.height * 0.2;
      f.rotY = -0.08;
    } else {
      f.scale = Math.min(v.height / 7.4, v.width / 12);
      f.x = v.width * 0.2;
      f.y = -v.height * 0.1;
      f.rotY = -0.12;
    }
    const pr = this.stage.renderer.getPixelRatio();
    this.sparks.setScale(height, pr, FOV);
    this.network.setScale(this.sparks.material.uniforms.uScale.value);
    this.#measureSection(height);
  }

  #measureSection(vh) {
    const r = this.section.getBoundingClientRect();
    this.measured.top = r.top + window.scrollY;
    this.measured.range = Math.max(1, this.section.offsetHeight - vh * 0.5);
  }

  onTierChange(tier) {
    this.sparks.setFraction(tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35);
  }

  update(dt, time, state) {
    if (!this.reduced) this.clock += dt;
    const u = this.shared;
    u.uTime.value = this.clock;
    u.uOpacity.value = state.visibility;

    this.#updateScroll(dt, state);
    this.#updateFrame(dt);
  }

  #updateScroll(dt, state) {
    const raw = MathUtils.clamp((state.scrollY - this.measured.top) / this.measured.range, 0, 1);
    const k = 1 - Math.exp(-dt * SCROLL_SPRING);
    this.scrollS += (raw - this.scrollS) * k;
    const s = this.scrollS;
    const eased = s * s * (3 - 2 * s);
    this.shared.uUnravel.value = eased;
    this.shared.uTwist.value = s * 2.6;

    const target = this.reduced ? 0 : MathUtils.clamp(Math.abs(state.velocity) * 0.06, 0, 2.4);
    this.stream += (target - this.stream) * k;
    this.sparks.material.uniforms.uStream.value = this.stream;
  }

  #updateFrame(dt) {
    const f = this.frame;
    const g = this.group;
    const s = this.scrollS;
    const k = 1 - Math.exp(-dt * FRAME_SPRING);
    const tx = f.x - s * f.x * 0.6;
    const ty = f.y + s * 0.9;
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * k;
    g.position.z = s * 4.2;
    g.scale.setScalar(f.scale * (1 + s * 0.15));
    g.rotation.y += ((f.rotY + s * 0.5) - g.rotation.y) * k;
    g.rotation.x += ((-s * 0.18) - g.rotation.x) * k;
    g.rotation.z = s * -0.12;
  }
}
