import {
  BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Group,
  LineSegments, LineBasicMaterial, Color,
} from 'three';
import { GLAct } from '../../gl/GLAct.js';

const CLUSTERS = 6;
const BASE_POINTS = 90;     // per cluster at detail 1
const DEPTH = -3.5;         // world z of the constellation centre
const SPREAD = 0.2;         // cluster radius relative to the ring radius

const VERT = /* glsl */ `
  attribute float aCluster;
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uPx;
  uniform float uOpacity;
  uniform float uActive[${CLUSTERS}];
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float act = uActive[int(aCluster + 0.5)];
    vec3 p = position;
    p.y += sin(uTime * 0.6 + aSeed * 6.2831) * 0.03;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.55 + 0.45 * sin(uTime * (1.2 + aSeed) + aSeed * 40.0);
    gl_PointSize = aSize * uPx * (0.75 + act * 0.9) * (12.0 / -mv.z);
    vAlpha = uOpacity * tw * (0.28 + 0.72 * act);
    vHeat = act;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uCool;
  uniform vec3 uHot;
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    gl_FragColor = vec4(mix(uCool, uHot, vHeat) * a, a * vAlpha);
  }
`;

/** Constellation of six glowing node clusters that turns with the role ring. */
export default class AudienceAct extends GLAct {
  static order = 2;

  async init() {
    this.pivot = new Group();
    this.group.add(this.pivot);
    this.angle = 0;
    this.active = new Array(CLUSTERS).fill(0);

    this.points = this.#buildPoints();
    this.lines = this.#buildLines();
    this.pivot.add(this.lines, this.points);
    this.group.position.z = DEPTH;
  }

  #centre(i) {
    const a = (i * Math.PI) / 3;
    return [Math.sin(a), 0, Math.cos(a)];
  }

  #buildPoints() {
    const per = Math.max(24, Math.round(BASE_POINTS * this.detail));
    const total = per * CLUSTERS;
    const pos = new Float32Array(total * 3);
    const cluster = new Float32Array(total);
    const seed = new Float32Array(total);
    const size = new Float32Array(total);
    let k = 0;
    for (let c = 0; c < CLUSTERS; c++) {
      const [cx, cy, cz] = this.#centre(c);
      for (let j = 0; j < per; j++, k++) {
        const hub = j === 0;
        const r = hub ? 0 : SPREAD * Math.pow(Math.random(), 1.6);
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        pos[k * 3] = cx + r * Math.sin(ph) * Math.cos(th);
        pos[k * 3 + 1] = cy + r * Math.cos(ph);
        pos[k * 3 + 2] = cz + r * Math.sin(ph) * Math.sin(th);
        cluster[k] = c;
        seed[k] = Math.random();
        size[k] = hub ? 26 : 3 + Math.random() * 6;
      }
    }
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aCluster', new BufferAttribute(cluster, 1));
    geo.setAttribute('aSeed', new BufferAttribute(seed, 1));
    geo.setAttribute('aSize', new BufferAttribute(size, 1));

    this.material = this.track(new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uPx: { value: this.stage.renderer.getPixelRatio() },
        uOpacity: { value: 0 },
        uActive: { value: this.active },
        uCool: { value: new Color('#e85b22') },
        uHot: { value: new Color('#ffb36b') },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }));
    return new Points(geo, this.material);
  }

  #buildLines() {
    const segs = [];
    for (let a = 0; a < CLUSTERS; a++) {
      for (let b = a + 1; b < CLUSTERS; b++) segs.push(...this.#centre(a), ...this.#centre(b));
    }
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(new Float32Array(segs), 3));
    this.lineMat = this.track(new LineBasicMaterial({
      color: new Color('#e85b22'), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending,
    }));
    return new LineSegments(geo, this.lineMat);
  }

  resize(width) {
    const v = this.stage.viewSize(DEPTH);
    const r = Math.min(v.width * (width < 768 ? 0.42 : 0.3), v.height * 0.42);
    this.pivot.scale.setScalar(r);
    if (this.material) this.material.uniforms.uPx.value = this.stage.renderer.getPixelRatio();
  }

  update(dt, time, state) {
    const k = 1 - Math.exp(-dt * 5);
    const ds = this.section.dataset;
    const role = Number(ds.role) || 0;
    const target = ((Number(ds.angle) || 0) * Math.PI) / 180;
    this.angle += (target - this.angle) * k;

    for (let i = 0; i < CLUSTERS; i++) {
      this.active[i] += ((i === role ? 1 : 0) - this.active[i]) * k;
    }
    const u = this.material.uniforms;
    const t = this.device.reducedMotion ? 0 : time;   // no ambient drift when motion is reduced
    u.uTime.value = t;
    u.uOpacity.value = state.visibility;
    this.lineMat.opacity = 0.12 * state.visibility;

    const p = state.progress;
    this.pivot.rotation.y = this.angle + t * 0.02;
    this.group.rotation.x = 0.32 + (p - 0.5) * 0.5 + state.pointer.y * 0.05;
    this.group.rotation.z = state.pointer.x * 0.04;
    this.group.position.y = (0.5 - p) * 1.6;
  }

  onTierChange() {
    if (this.material) this.material.uniforms.uPx.value = this.stage.renderer.getPixelRatio();
  }
}
