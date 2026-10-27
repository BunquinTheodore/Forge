import {
  BufferGeometry, BufferAttribute, Points, LineSegments, ShaderMaterial, AdditiveBlending, Vector3,
} from 'three';
import { EMBER_RAMP } from './glsl.js';
import { emberUniforms } from './palette.js';
import { seeded } from './Ribbon.js';

const LINKS_PER_NODE = 3;
const MAX_LINK = 2.3;
/** Where the network blooms off the ribbon's upper end (group space). */
const CLOUD = { x: [2.2, 8.4], y: [0.6, 4.4], z: [-1.2, 0.6] };

const head = /* glsl */ `
  uniform float uTime;
  uniform float uUnravel;
  uniform vec3 uPointer;
  uniform float uPointerAmt;
  uniform float uHeatRadius;
  vec3 drift(vec3 p, float seed) {
    vec3 c = vec3(5.0, 2.4, 0.0);
    p += (p - c) * uUnravel * 0.35;
    p += vec3(sin(uTime * 0.4 + seed * 9.0), cos(uTime * 0.33 + seed * 7.0), 0.0) * 0.06;
    return p;
  }
  float near(vec3 p) {
    vec2 d = p.xy - uPointer.xy;
    return exp(-dot(d, d) / (uHeatRadius * uHeatRadius * 1.6)) * uPointerAmt;
  }
`;

const nodeVertex = /* glsl */ `
  ${head}
  uniform float uScale;
  attribute float aSeed;
  varying float vGlow;
  void main() {
    vec3 p = drift(position, aSeed);
    float pulse = 0.6 + 0.4 * sin(uTime * (1.2 + aSeed) + aSeed * 30.0);
    vGlow = pulse + near(p) * 1.4;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (0.07 + aSeed * 0.1) * (1.0 + near(p)) * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const lineVertex = /* glsl */ `
  ${head}
  attribute float aSeed;
  attribute float aEnd;
  varying float vEnd;
  varying float vSeed;
  varying float vNear;
  void main() {
    vec3 p = drift(position, aSeed);
    vEnd = aEnd;
    vSeed = aSeed;
    vNear = near(p);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragHead = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uEmberDeep;
  uniform vec3 uEmber;
  uniform vec3 uEmberHot;
  uniform vec3 uEmberGlow;
  ${EMBER_RAMP}
`;

const nodeFragment = /* glsl */ `
  ${fragHead}
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float halo = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.12, 0.0, d);
    vec3 col = emberRamp(0.55 + core * 0.45) * (halo * halo * 0.9 + core * 1.6);
    gl_FragColor = vec4(col * vGlow, halo * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const lineFragment = /* glsl */ `
  ${fragHead}
  varying float vEnd;
  varying float vSeed;
  varying float vNear;
  void main() {
    float head = fract(uTime * (0.18 + vSeed * 0.25) + vSeed * 7.0);
    float pulse = exp(-pow((vEnd - head) * 7.0, 2.0));
    float a = (0.16 + pulse * 0.8 + vNear * 0.5) * uOpacity;
    gl_FragColor = vec4(emberRamp(0.4 + pulse * 0.5), a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** The poster's glowing network: nodes joined to their nearest neighbours, pulses travelling the links. */
export class Network {
  constructor({ nodes, palette, shared }) {
    const rand = seeded(2026);
    const pts = Network.#scatter(nodes, rand);
    const seeds = new Float32Array(nodes);
    for (let i = 0; i < nodes; i += 1) seeds[i] = rand();

    this.nodeGeometry = new BufferGeometry();
    this.nodeGeometry.setAttribute('position', new BufferAttribute(Network.#flatten(pts), 3));
    this.nodeGeometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    this.lineGeometry = Network.#links(pts, seeds);

    const uniforms = { ...shared, ...emberUniforms(palette) };
    const common = { transparent: true, depthWrite: false, blending: AdditiveBlending };
    this.nodeMaterial = new ShaderMaterial({
      uniforms: { ...uniforms, uScale: { value: 600 } },
      vertexShader: nodeVertex, fragmentShader: nodeFragment, ...common,
    });
    this.lineMaterial = new ShaderMaterial({
      uniforms, vertexShader: lineVertex, fragmentShader: lineFragment, ...common,
    });
    this.nodes = new Points(this.nodeGeometry, this.nodeMaterial);
    this.lines = new LineSegments(this.lineGeometry, this.lineMaterial);
    this.nodes.frustumCulled = false;
    this.lines.frustumCulled = false;
    this.nodes.renderOrder = 3;
    this.lines.renderOrder = 2;
  }

  get disposables() { return [this.nodeGeometry, this.lineGeometry, this.nodeMaterial, this.lineMaterial]; }

  setScale(value) { this.nodeMaterial.uniforms.uScale.value = value; }

  static #scatter(n, rand) {
    const out = [];
    const lerp = (r, t) => r[0] + (r[1] - r[0]) * t;
    for (let i = 0; i < n; i += 1) {
      const t = Math.pow(rand(), 0.8);
      const y = lerp(CLOUD.y, rand()) * (0.55 + t * 0.45) + t * 0.6;
      out.push(new Vector3(lerp(CLOUD.x, t), y, lerp(CLOUD.z, rand())));
    }
    return out;
  }

  static #flatten(pts) {
    const arr = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => p.toArray(arr, i * 3));
    return arr;
  }

  static #links(pts, seeds) {
    const pos = [];
    const seed = [];
    const end = [];
    const seen = new Set();
    pts.forEach((p, i) => {
      const nearest = pts
        .map((q, j) => ({ j, d: p.distanceTo(q) }))
        .filter((o) => o.j !== i && o.d < MAX_LINK)
        .sort((a, b) => a.d - b.d)
        .slice(0, LINKS_PER_NODE);
      for (const { j } of nearest) {
        const key = i < j ? `${i}:${j}` : `${j}:${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pos.push(p.x, p.y, p.z, pts[j].x, pts[j].y, pts[j].z);
        const s = (seeds[i] + seeds[j]) * 0.5;
        seed.push(s, s);
        end.push(0, 1);
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('aSeed', new BufferAttribute(new Float32Array(seed), 1));
    g.setAttribute('aEnd', new BufferAttribute(new Float32Array(end), 1));
    return g;
  }
}
