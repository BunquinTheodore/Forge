/**
 * GLSL for the corridor globe. Colours are the FORGE tokens in linear-ish RGB:
 * ember #e85b22, ember-glow #ffb36b, fog #aeb7c4, steel #293342, ink-2 #101925, ink-3 #11253a.
 */
const COLORS = /* glsl */`
  const vec3 EMBER = vec3(0.910, 0.357, 0.133);
  const vec3 EMBER_GLOW = vec3(1.0, 0.702, 0.420);
  const vec3 EMBER_DEEP = vec3(0.659, 0.204, 0.059);
  const vec3 FOG = vec3(0.682, 0.718, 0.769);
  const vec3 STEEL = vec3(0.161, 0.2, 0.259);
  const vec3 INK2 = vec3(0.063, 0.098, 0.145);
  const vec3 INK3 = vec3(0.067, 0.145, 0.227);
`;

export const dotsShader = {
  vertex: /* glsl */`
    attribute float aLand;
    attribute float aRand;
    uniform float uTime;
    uniform float uIntro;
    uniform float uPx;
    uniform float uDot;
    uniform vec3 uFocus;
    varying float vAlpha;
    varying float vHeat;
    varying float vLand;
    void main() {
      float spread = 1.0 - uIntro;
      spread = spread * spread;
      vec3 p = position * (1.0 + spread * (0.5 + aRand * 2.4));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vec3 n = normalize(normalMatrix * position);
      float heat = smoothstep(0.86, 0.985, dot(position, uFocus)) * aLand;
      float twinkle = 0.78 + 0.22 * sin(uTime * 1.6 + aRand * 40.0);
      vHeat = heat;
      vLand = aLand;
      vAlpha = smoothstep(-0.1, 0.5, n.z) * mix(0.28, 0.92, aLand) * mix(1.0, twinkle, aLand)
             * mix(1.0, 0.35, spread);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = max(1.2, uPx * uDot * mix(0.62, 1.0, aLand) * (1.0 + heat * 0.55));
    }
  `,
  fragment: /* glsl */`
    ${COLORS}
    uniform float uVis;
    varying float vAlpha;
    varying float vHeat;
    varying float vLand;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.18, d);
      vec3 col = mix(STEEL * 1.6, FOG, vLand);
      col = mix(col, mix(EMBER, EMBER_GLOW, vHeat * 0.5), vHeat);
      gl_FragColor = vec4(col, a * vAlpha * uVis);
    }
  `,
};

const ARC_VERTEX = /* glsl */`
  attribute float aGate;
  attribute float aT;
  attribute float aSeed;
  attribute float aKind;
  uniform float uTime;
  uniform float uReveal;
  uniform float uIntro;
  uniform float uPx;
  varying float vA;
  varying float vHot;
  varying float vKind;
  void main() {
    float shown = step(aGate, uReveal) * smoothstep(0.55, 1.0, uIntro);
    float tip = 1.0 - smoothstep(0.0, 0.04, uReveal - aGate);
    float head = fract(uTime * 0.16 + aSeed);
    float d = aT - head;
    float pulse = d < 0.0 ? exp(d * 20.0) : exp(-d * 140.0);
    vHot = max(pulse, tip) * (1.0 - aKind);
    vKind = aKind;
    vA = shown;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #ifdef ARC_POINTS
      float citySize = 0.055 + 0.01 * sin(uTime * 2.2 + aSeed * 10.0);
      float size = aKind > 0.5 ? citySize : 0.006 + vHot * 0.022;
      gl_PointSize = max(1.5, size * uPx);
    #endif
  }
`;

export const arcLineShader = {
  vertex: ARC_VERTEX,
  fragment: /* glsl */`
    ${COLORS}
    uniform float uVis;
    varying float vA;
    varying float vHot;
    void main() {
      float a = vA * (0.2 + vHot * 0.95) * uVis;
      gl_FragColor = vec4(mix(EMBER_DEEP * 1.4, EMBER_GLOW, vHot), a);
    }
  `,
};

export const arcPointShader = {
  vertex: ARC_VERTEX,
  fragment: /* glsl */`
    ${COLORS}
    uniform float uVis;
    varying float vA;
    varying float vHot;
    varying float vKind;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a;
      vec3 col;
      if (vKind > 0.5) {
        float core = smoothstep(0.17, 0.09, d);
        float ring = smoothstep(0.05, 0.0, abs(d - 0.38)) * 0.75;
        a = core + ring;
        col = mix(EMBER, EMBER_GLOW, core);
      } else {
        a = smoothstep(0.5, 0.0, d) * (0.3 + vHot * 1.1);
        col = mix(EMBER, EMBER_GLOW, vHot);
      }
      gl_FragColor = vec4(col, a * vA * uVis);
    }
  `,
};

/** Dark body that also writes depth, so arcs and dots behind the globe are hidden. */
export const shellShader = {
  vertex: /* glsl */`
    varying vec3 vN;
    void main() {
      vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragment: /* glsl */`
    ${COLORS}
    uniform float uVis;
    varying vec3 vN;
    void main() {
      float rim = 1.0 - clamp(vN.z, 0.0, 1.0);
      vec3 col = mix(INK2 * 0.7, INK3, rim * rim);
      col += EMBER_DEEP * pow(rim, 5.0) * 0.5;
      gl_FragColor = vec4(col, 0.9 * uVis);
    }
  `,
};

/** Atmosphere: an ember halo just outside the silhouette (plane behind the globe, additive). */
export const haloShader = {
  vertex: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragment: /* glsl */`
    ${COLORS}
    uniform float uVis;
    uniform float uScale;
    varying vec2 vUv;
    void main() {
      float d = length(vUv - 0.5) * 2.0 * uScale;
      float outside = max(d - 1.0, 0.0);
      float glow = exp(-outside * 7.0) * smoothstep(0.9, 1.02, d);
      vec3 col = mix(EMBER_DEEP, EMBER, exp(-outside * 14.0));
      gl_FragColor = vec4(col, glow * 0.42 * uVis);
    }
  `,
};
