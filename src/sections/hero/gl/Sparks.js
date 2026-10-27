import {
  BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Vector3,
} from 'three';
import { EMBER_RAMP } from './glsl.js';
import { emberUniforms } from './palette.js';
import { seeded } from './Ribbon.js';

const BURST_SHARE = 0.38;   // fraction of sparks that join a click burst

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uSize;
  uniform float uStream;
  uniform float uUnravel;
  uniform vec3 uBurst;
  uniform float uBurstAge;
  attribute vec3 aOrigin;
  attribute vec4 aRand;
  varying float vAlpha;
  varying float vHeat;

  void main() {
    float speed = 0.1 + aRand.x * 0.22 + uStream * 0.12;
    float life = fract(uTime * speed + aRand.y);
    vec3 dir = normalize(vec3(aRand.z - 0.25, 0.35 + aRand.w * 0.9, aRand.x - 0.5));
    vec3 p = aOrigin + dir * life * (0.6 + aRand.z * 1.5);
    p.y += life * life * 0.7;
    p += vec3(1.0, 0.45, 0.25) * uStream * life * (0.6 + aRand.w) * 1.6;
    p += sin(vec3(life * 8.0 + aRand.x * 20.0, life * 6.0 + aRand.y * 20.0, life * 7.0)) * 0.07;
    p.z += uUnravel * (aRand.w - 0.3) * 2.5;
    float alpha = sin(life * 3.14159) * (0.35 + aRand.z * 0.65);
    float heat = 0.4 + aRand.z * 0.4;

    float burstOn = step(aRand.w, ${BURST_SHARE}) * step(0.0, uBurstAge) * step(uBurstAge, 1.8);
    float th = aRand.x * 6.2832;
    float ph = acos(aRand.y * 2.0 - 1.0);
    vec3 bdir = vec3(sin(ph) * cos(th), sin(ph) * sin(th) * 0.8 + 0.25, cos(ph));
    float reach = (1.0 - exp(-uBurstAge * 3.2)) * (0.6 + aRand.z * 1.9);
    vec3 bp = uBurst + bdir * reach + vec3(0.0, -uBurstAge * uBurstAge * 0.45, 0.0);
    p = mix(p, bp, burstOn);
    alpha = mix(alpha, 1.0 - smoothstep(0.3, 1.6 + aRand.z * 0.2, uBurstAge), burstOn);
    heat = mix(heat, 1.0 - uBurstAge * 0.4, burstOn);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (0.45 + aRand.z) * (1.0 + burstOn * 0.6) * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
    vAlpha = alpha;
    vHeat = clamp(heat, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uEmberDeep;
  uniform vec3 uEmber;
  uniform vec3 uEmberHot;
  uniform vec3 uEmberGlow;
  varying float vAlpha;
  varying float vHeat;
  ${EMBER_RAMP}

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.22, 0.0, d);
    vec3 col = emberRamp(clamp(vHeat * 0.7 + core * 0.4, 0.0, 1.0));
    gl_FragColor = vec4(col * (1.0 + core), a * a * vAlpha * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Ember sparks lifting off the ribbon; streams with scroll velocity; a share of them answers a click burst. */
export class Sparks {
  constructor({ count, ribbon, palette, shared }) {
    this.count = count;
    const origin = new Float32Array(count * 3);
    const rnd = new Float32Array(count * 4);
    const rand = seeded(901);
    const tmp = new Vector3();
    for (let i = 0; i < count; i += 1) {
      ribbon.samplePoint(rand, tmp).toArray(origin, i * 3);
      rnd[i * 4] = rand();
      rnd[i * 4 + 1] = rand();
      rnd[i * 4 + 2] = rand();
      rnd[i * 4 + 3] = rand();
    }
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(origin, 3));
    this.geometry.setAttribute('aOrigin', new BufferAttribute(origin, 3));
    this.geometry.setAttribute('aRand', new BufferAttribute(rnd, 4));

    this.material = new ShaderMaterial({
      uniforms: {
        ...shared,
        ...emberUniforms(palette),
        uScale: { value: 600 },
        uSize: { value: 0.05 },
        uStream: { value: 0 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  get disposables() { return [this.geometry, this.material]; }

  setScale(viewportHeightPx, pixelRatio, fovDeg) {
    const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
    this.material.uniforms.uScale.value = viewportHeightPx * pixelRatio * 0.5 * f;
  }

  setFraction(k) {
    this.geometry.setDrawRange(0, Math.max(1, Math.round(this.count * k)));
  }
}
