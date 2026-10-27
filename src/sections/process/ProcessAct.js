import {
  BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Color, Vector2, Vector3,
} from 'three';
import { GLAct } from '../../gl/GLAct.js';

const BASE_SPARKS = 260;   // at detail 1
const DEPTH = 0;           // sparks sit on the DOM plane so they meet the molten head

const VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aSpeed;
  attribute float aAngle;
  uniform float uTime;
  uniform float uPx;
  uniform float uScale;
  uniform vec3 uHead;
  uniform vec2 uDir;
  uniform float uPower;
  varying float vLife;
  void main() {
    float life = fract(uTime * aSpeed + aSeed);
    // spray backwards from the travel direction and upward, then fall under gravity
    float ang = aAngle;
    vec2 back = -uDir;
    vec2 up = vec2(-uDir.y, uDir.x);
    if (up.y < 0.0) up = -up;
    vec2 v = (back * cos(ang) + up * sin(ang)) * (0.6 + aSeed * 1.4) * uPower;
    vec2 p = v * life * uScale;
    p.y -= 1.1 * life * life * uScale;
    vec4 mv = modelViewMatrix * vec4(uHead + vec3(p, 0.0), 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPx * (2.0 + 5.0 * (1.0 - life)) * (10.0 / -mv.z);
    vLife = life;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uHot;
  uniform vec3 uCool;
  uniform float uOpacity;
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    float fade = (1.0 - vLife) * (1.0 - vLife);
    vec3 col = mix(uHot, uCool, vLife);
    gl_FragColor = vec4(col * a, a * fade * uOpacity);
  }
`;

/** Forge sparks spraying from the head of the molten line as it travels through the steps. */
export default class ProcessAct extends GLAct {
  static order = 3;

  async init() {
    const count = Math.max(60, Math.round(BASE_SPARKS * this.detail));
    const seed = new Float32Array(count);
    const speed = new Float32Array(count);
    const angle = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seed[i] = Math.random();
      speed[i] = 0.7 + Math.random() * 1.1;
      angle[i] = (Math.random() * 1.25 - 0.15) * Math.PI * 0.5;
    }
    const geo = this.track(new BufferGeometry());
    // positions are computed in the shader; a zeroed buffer gives three the vertex count
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new BufferAttribute(seed, 1));
    geo.setAttribute('aSpeed', new BufferAttribute(speed, 1));
    geo.setAttribute('aAngle', new BufferAttribute(angle, 1));

    this.head = new Vector3();
    this.material = this.track(new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uPx: { value: this.stage.renderer.getPixelRatio() },
        uScale: { value: 1 },
        uHead: { value: this.head },
        uDir: { value: new Vector2(1, 0) },
        uPower: { value: 1 },
        uOpacity: { value: 0 },
        uHot: { value: new Color('#ffd29a') },
        uCool: { value: new Color('#e85b22') },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }));
    this.points = new Points(geo, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.live = 0;
    this.headReady = false;
  }

  resize() {
    if (!this.material) return;
    const v = this.stage.viewSize(DEPTH);
    this.material.uniforms.uScale.value = Math.min(v.width, v.height) * 0.16;
    this.material.uniforms.uPx.value = this.stage.renderer.getPixelRatio();
  }

  onTierChange() { this.resize(); }

  update(dt, time, state) {
    const ds = this.section.dataset;
    const target = ds.hot === '1' ? 1 : 0;
    const k = 1 - Math.exp(-dt * 4);
    this.live += (target - this.live) * k;

    const v = this.stage.viewSize(DEPTH);
    const hx = (Number(ds.hx) - 0.5) * v.width;
    const hy = -(Number(ds.hy) - 0.5) * v.height;
    if (!this.headReady) { this.head.set(hx, hy, DEPTH); this.headReady = true; }
    this.head.x += (hx - this.head.x) * Math.min(1, k * 4);
    this.head.y += (hy - this.head.y) * Math.min(1, k * 4);

    const u = this.material.uniforms;
    const vertical = ds.dir === 'v';
    u.uDir.value.x = vertical ? 0 : 1;
    u.uDir.value.y = vertical ? -1 : 0;
    u.uTime.value = time;
    u.uPower.value = 0.8 + Math.min(Math.abs(state.velocity) / 25, 1) * 0.9;
    u.uOpacity.value = this.live * state.visibility;
  }
}
