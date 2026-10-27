import { BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Color } from 'three';
import { ZONES, FLOW, zoneCentre } from './zones.js';

const BASE_COUNT = 260;
const ARC = 0.55;          // extra height of the hop between two zones
const SPEED = 0.045;       // path lengths per second

const VERT = /* glsl */`
  attribute float aSeed;
  uniform float uSize; uniform float uPixel;
  varying float vSeed;
  void main() {
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uPixel * (0.6 + aSeed * 0.8) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  uniform vec3 uCol; uniform vec3 uHot; uniform float uOpacity;
  varying float vSeed;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 col = mix(uCol, uHot, a * a);
    gl_FragColor = vec4(col * a * a * uOpacity * (0.55 + 0.45 * vSeed), 1.0);
  }
`;

/**
 * Ember particles hopping along the venture flow:
 * project gallery, FORGE desk, working tables, deal rooms, outcome desk.
 * Positions are written into one preallocated buffer per frame (no allocations).
 */
export class FlowParticles {
  constructor(act) {
    this.count = Math.max(40, Math.round(BASE_COUNT * act.detail));
    this.points3 = FLOW.map((id) => {
      const z = ZONES.find((zone) => zone.id === id);
      const c = zoneCentre(z);
      return [c.x, z.lift + 0.06, c.z];
    });
    this.segments = this.points3.length - 1;

    this.positions = new Float32Array(this.count * 3);
    this.seeds = new Float32Array(this.count);
    this.lanes = new Float32Array(this.count * 2);
    for (let i = 0; i < this.count; i += 1) {
      this.seeds[i] = Math.random();
      this.lanes[i * 2] = (Math.random() - 0.5) * 0.35;
      this.lanes[i * 2 + 1] = (Math.random() - 0.5) * 0.35;
    }

    const geo = act.track(new BufferGeometry());
    this.attr = new BufferAttribute(this.positions, 3);
    geo.setAttribute('position', this.attr);
    geo.setAttribute('aSeed', new BufferAttribute(this.seeds, 1));
    this.material = act.track(new ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: {
        uSize: { value: 0.16 }, uPixel: { value: 600 }, uOpacity: { value: 0 },
        uCol: { value: new Color('#e85b22') }, uHot: { value: new Color('#ffb36b') },
      },
    }));
    this.points = new Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.update(0);
  }

  setPixel(heightPx) { this.material.uniforms.uPixel.value = heightPx; }

  setOpacity(o) { this.material.uniforms.uOpacity.value = o; }

  update(time) {
    const p = this.positions;
    const pts = this.points3;
    for (let i = 0; i < this.count; i += 1) {
      const u = (this.seeds[i] + time * SPEED * (0.7 + this.seeds[i] * 0.6)) % 1;
      const f = u * this.segments;
      const s = Math.min(this.segments - 1, Math.floor(f));
      const t = f - s;
      const a = pts[s];
      const b = pts[s + 1];
      const hop = Math.sin(Math.PI * t) * ARC;
      const k = i * 3;
      p[k] = a[0] + (b[0] - a[0]) * t + this.lanes[i * 2];
      p[k + 1] = a[1] + (b[1] - a[1]) * t + hop;
      p[k + 2] = a[2] + (b[2] - a[2]) * t + this.lanes[i * 2 + 1];
    }
    this.attr.needsUpdate = true;
  }
}
