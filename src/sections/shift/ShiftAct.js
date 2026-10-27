import {
  BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Color,
} from 'three';
import { GLAct } from '../../gl/GLAct.js';
import { ScrollTrigger } from '../../core/Scroll.js';

const RINGS = 3;
const MEASURE_EVERY = 30; // frames between DOM rect refreshes (catches late layout shifts)
const POINTS_PER_RING = 520;
const DEPTH = 0;

const vertexShader = /* glsl */ `
  attribute float aAngle;
  attribute float aRing;
  attribute float aSeed;
  uniform float uTime;
  uniform float uProgress;
  uniform float uRadius;
  uniform float uPixel;
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float dir = mod(aRing, 2.0) < 0.5 ? 1.0 : -1.0;
    float a = aAngle + dir * (uTime * (0.07 + aRing * 0.025) + uProgress * 2.4);
    float r = uRadius * (1.0 + aRing * 0.34) * (1.0 + 0.012 * sin(aSeed * 60.0 + uTime));
    vec3 p = vec3(cos(a) * r, sin(a) * r, 0.0);
    float tx = 1.12 + aRing * 0.16;
    p = vec3(p.x, p.y * cos(tx), p.y * sin(tx));
    float tz = aRing * 0.62 - 0.4;
    p = vec3(p.x * cos(tz) - p.y * sin(tz), p.x * sin(tz) + p.y * cos(tz), p.z);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float head = pow(fract(aAngle / 6.2831853 + aSeed * 0.02), 6.0);
    float tw = 0.5 + 0.5 * sin(uTime * 1.6 + aSeed * 40.0);
    vHeat = head;
    vAlpha = 0.18 + 0.5 * tw * tw + head * 0.8;
    gl_PointSize = uPixel * (1.0 + tw + head * 2.5) * (10.0 / -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uEmber;
  uniform vec3 uGlow;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vHeat;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float disc = smoothstep(0.5, 0.0, d);
    vec3 col = mix(uEmber, uGlow, vHeat);
    gl_FragColor = vec4(col, disc * vAlpha * uOpacity);
  }
`;

function cssColor(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new Color(value || 'white');
}

/** Subtle orbit rings of ember points around the configuration builder. */
export default class ShiftAct extends GLAct {
  static order = 3;

  async init() {
    this.target = this.section.querySelector('.shift__graph');
    this.material = this.track(new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uRadius: { value: 1 },
        uPixel: { value: 1 },
        uOpacity: { value: 0 },
        uEmber: { value: cssColor('--ember') },
        uGlow: { value: cssColor('--ember-glow') },
      },
    }));
    // Document-space rect of the builder, cached so update() never forces layout.
    // The builder sits below the pin spacer, so docTop stays valid between refreshes.
    this.box = { docTop: 0, left: 0, width: 1, height: 1 };
    this.view = { width: 1, height: 1 };
    this.frame = 0;
    this.onRefresh = () => this.#measure();
    ScrollTrigger.addEventListener('refresh', this.onRefresh);
    this.#measure();
    this.#build();
  }

  #measure() {
    if (!this.target) return;
    const r = this.target.getBoundingClientRect();
    this.box.docTop = r.top + window.scrollY;
    this.box.left = r.left;
    this.box.width = Math.max(1, r.width);
    this.box.height = Math.max(1, r.height);
    const v = this.stage.viewSize(DEPTH);
    this.view.width = v.width;
    this.view.height = v.height;
  }

  #build() {
    if (this.points) {
      const old = this.points.geometry;
      this.group.remove(this.points);
      old.dispose();
      this.disposables = this.disposables.filter((d) => d !== old);
    }
    const per = Math.max(60, Math.round(POINTS_PER_RING * this.detail));
    const total = per * RINGS;
    const pos = new Float32Array(total * 3);
    const angle = new Float32Array(total);
    const ring = new Float32Array(total);
    const seed = new Float32Array(total);
    for (let r = 0; r < RINGS; r += 1) {
      for (let i = 0; i < per; i += 1) {
        const k = r * per + i;
        angle[k] = (i / per) * Math.PI * 2;
        ring[k] = r;
        seed[k] = Math.random();
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('aAngle', new Float32BufferAttribute(angle, 1));
    geo.setAttribute('aRing', new Float32BufferAttribute(ring, 1));
    geo.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
    this.track(geo);
    this.points = new Points(geo, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  resize(_width, height) {
    if (!this.material) return;
    this.#measure();
    this.frame = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, this.device.maxDpr);
    this.material.uniforms.uPixel.value = Math.max(1.5, (height / 900) * 2.2) * dpr;
  }

  onTierChange() {
    this.#build();
  }

  update(dt, time, state) {
    if (!this.target) return;
    if (this.frame % MEASURE_EVERY === 0) this.#measure();
    this.frame += 1;
    const b = this.box;
    const stage = this.stage;
    const vw = stage.width;
    const vh = stage.height;
    const top = b.docTop - state.scrollY;
    // Fade in only while the builder itself is on screen.
    const centre = top + b.height / 2;
    const onScreen = Math.max(0, 1 - Math.abs(centre / vh - 0.5) * 1.6);
    const x = ((b.left + b.width / 2) / vw - 0.5) * this.view.width;
    const y = -(centre / vh - 0.5) * this.view.height;
    const w = (b.width / vw) * this.view.width;
    const h = (b.height / vh) * this.view.height;
    const u = this.material.uniforms;
    u.uTime.value = this.device.reducedMotion ? 0 : time;
    u.uProgress.value = state.progress;
    u.uRadius.value = Math.min(w, h) * 0.36;
    u.uOpacity.value = 0.75 * state.visibility * onScreen;
    this.group.position.set(x + state.pointer.x * 0.08, y + state.pointer.y * 0.08, DEPTH);
  }

  dispose() {
    ScrollTrigger.removeEventListener('refresh', this.onRefresh);
    super.dispose();
  }
}
