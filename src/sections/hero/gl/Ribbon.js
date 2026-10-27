import {
  BufferGeometry, BufferAttribute, CatmullRomCurve3, Vector3, Mesh, ShaderMaterial,
  DoubleSide, AdditiveBlending,
} from 'three';
import { ribbonVertex, bodyFragment, glowFragment } from './ribbonShaders.js';
import { emberUniforms } from './palette.js';

/** Spine of the poster ribbon: rises from the lower left, curls, then sweeps to the upper right. */
const SPINE = [
  [-8.4, -3.9, -1.6], [-5.0, -2.9, 0.3], [-2.3, -3.1, 1.0], [-0.5, -1.8, 0.7],
  [-1.3, -0.3, -0.1], [0.5, 0.8, 0.3], [2.9, 1.0, 0.6], [5.5, 1.8, 0.0], [8.6, 2.9, -1.2],
];

/** Deterministic pseudo random so every load forges the same shape. */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Several twisted metal strands around one spine, merged into two draw calls:
 * an opaque-ish forged body and an additive molten edge.
 */
export class Ribbon {
  constructor({ strands, segments, palette, shared }) {
    this.curves = Ribbon.#makeCurves(strands);
    const geometry = Ribbon.#makeGeometry(this.curves, segments);
    this.geometry = geometry;

    const base = {
      ...shared,
      ...emberUniforms(palette),
      uWidth: { value: 0.34 },
      uGlowWidth: { value: 0.022 },
    };
    this.bodyMaterial = new ShaderMaterial({
      uniforms: {
        ...base,
        uDark: { value: palette.ink },
        uSteel: { value: palette.steel2 },
        uRim: { value: palette.fog },
      },
      vertexShader: ribbonVertex,
      fragmentShader: bodyFragment,
      side: DoubleSide,
      transparent: true,
    });
    this.glowMaterial = new ShaderMaterial({
      uniforms: base,
      defines: { GLOW: '' },
      vertexShader: ribbonVertex,
      fragmentShader: glowFragment,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this.body = new Mesh(geometry, this.bodyMaterial);
    this.glow = new Mesh(geometry, this.glowMaterial);
    this.body.frustumCulled = false;
    this.glow.frustumCulled = false;
    this.glow.renderOrder = 1;
  }

  get disposables() { return [this.geometry, this.bodyMaterial, this.glowMaterial]; }

  static #makeCurves(count) {
    const rand = seeded(29102026);
    const mid = (count - 1) / 2;
    const curves = [];
    for (let i = 0; i < count; i += 1) {
      const k = i - mid;
      const pts = SPINE.map(([x, y, z], j) => {
        const spread = 0.2 + 0.17 * Math.sin(j * 1.1 + i * 0.7) + (rand() - 0.5) * 0.06;
        return new Vector3(
          x + k * 0.05 * Math.cos(j * 0.9),
          y + k * spread,
          z + k * 0.26 * Math.cos(j * 0.8 + i * 0.3),
        );
      });
      curves.push(new CatmullRomCurve3(pts, false, 'centripetal'));
    }
    return curves;
  }

  static #makeGeometry(curves, segments) {
    const rows = segments + 1;
    const vertCount = curves.length * rows * 2;
    const pos = new Float32Array(vertCount * 3);
    const fn = new Float32Array(vertCount * 3);
    const fb = new Float32Array(vertCount * 3);
    const aT = new Float32Array(vertCount);
    const aS = new Float32Array(vertCount);
    const strand = new Float32Array(vertCount * 2);
    const index = [];
    const rand = seeded(1029);

    let v = 0;
    curves.forEach((curve, ci) => {
      const points = curve.getSpacedPoints(segments);
      const frames = curve.computeFrenetFrames(segments, false);
      const seed = (ci + 0.5) / curves.length * 0.8 + rand() * 0.2;
      const widthMul = 0.7 + rand() * 0.7;
      const start = v;
      for (let r = 0; r < rows; r += 1) {
        for (let side = -1; side <= 1; side += 2) {
          points[r].toArray(pos, v * 3);
          frames.normals[r].toArray(fn, v * 3);
          frames.binormals[r].toArray(fb, v * 3);
          aT[v] = r / segments;
          aS[v] = side;
          strand[v * 2] = seed;
          strand[v * 2 + 1] = widthMul;
          v += 1;
        }
        if (r < segments) {
          const a = start + r * 2;
          index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    });

    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aFrameN', new BufferAttribute(fn, 3));
    g.setAttribute('aFrameB', new BufferAttribute(fb, 3));
    g.setAttribute('aT', new BufferAttribute(aT, 1));
    g.setAttribute('aS', new BufferAttribute(aS, 1));
    g.setAttribute('aStrand', new BufferAttribute(strand, 2));
    g.setIndex(index);
    return g;
  }

  /** A random point on one of the strands (for spark origins). */
  samplePoint(rand, out) {
    const curve = this.curves[Math.floor(rand() * this.curves.length)];
    return curve.getPointAt(0.08 + rand() * 0.86, out);
  }
}
