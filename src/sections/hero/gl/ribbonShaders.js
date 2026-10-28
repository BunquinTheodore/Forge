import { NOISE, EMBER_RAMP } from './glsl.js';

/**
 * Ribbon vertex shader. Geometry stores the strand spine (position) and its parallel-transport
 * frame; the strip is built here so twist and unravel stay on the GPU.
 * GLOW define: thin additive strip riding one edge of each strand.
 */
export const ribbonVertex = /* glsl */ `
  uniform float uTime;
  uniform float uTwist;
  uniform float uUnravel;
  uniform float uWidth;
  uniform float uGlowWidth;

  attribute vec3 aFrameN;
  attribute vec3 aFrameB;
  attribute float aT;
  attribute float aS;
  attribute vec2 aStrand;

  varying float vT;
  varying float vS;
  varying float vSeed;
  varying vec3 vNormalV;
  varying vec3 vViewDir;

  void main() {
    float seed = aStrand.x;
    float tw = seed * 2.4 + aT * (1.6 + uUnravel * 5.5) + uTwist * (0.6 + seed)
      + sin(uTime * 0.32 + aT * 4.0 + seed * 6.0) * 0.32;
    vec3 side = cos(tw) * aFrameN + sin(tw) * aFrameB;
    vec3 nrm = -sin(tw) * aFrameN + cos(tw) * aFrameB;

    float taper = pow(sin(3.14159 * clamp(aT, 0.0, 1.0)), 0.4);
    float w = uWidth * aStrand.y * taper;

    vec3 p = position;
    p += nrm * sin(aT * 9.0 - uTime * 0.8 + seed * 4.0) * 0.07;
    p += aFrameB * (seed - 0.5) * uUnravel * 2.4;
    p.z += uUnravel * sin(aT * 3.14159) * (0.8 + seed) * 1.4;

  #ifdef GLOW
    float edge = seed > 0.5 ? 1.0 : -1.0;
    vec3 c = p + side * (edge * w * 0.97 + aS * uGlowWidth * taper) + nrm * 0.012;
  #else
    vec3 c = p + side * aS * w;
  #endif

    vT = aT;
    vS = aS;
    vSeed = seed;

    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    vNormalV = normalize(normalMatrix * nrm);
    vViewDir = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const COMMON_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uEmberDeep;
  uniform vec3 uEmber;
  uniform vec3 uEmberHot;
  uniform vec3 uEmberGlow;
  varying float vT;
  varying float vS;
  varying float vSeed;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  ${NOISE}
  ${EMBER_RAMP}
`;

/**
 * Dark forged metal body with flowing ember cracks, brushed streaks and a fresnel rim.
 * LOW_DETAIL (mid tier): single-octave pits and a 2-octave crack field, about a quarter of the noise cost.
 */
export const bodyFragment = /* glsl */ `
  uniform vec3 uDark;
  uniform vec3 uSteel;
  uniform vec3 uRim;
  ${COMMON_FRAG}

  void main() {
    vec3 N = normalize(vNormalV);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(vViewDir);
    vec3 L = normalize(vec3(-0.35, 0.75, 0.55));

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 28.0);
    float fres = pow(1.0 - abs(dot(N, V)), 2.4);
    float streak = vnoise(vec2(vS * 46.0 + vSeed * 9.0, vT * 3.0));
  #ifdef LOW_DETAIL
    float pits = vnoise(vec2(vT * 60.0, vS * 6.0 + vSeed * 4.0)) * 0.9375;
  #else
    float pits = fbm(vec2(vT * 60.0, vS * 6.0 + vSeed * 4.0));
  #endif

    vec3 metal = mix(uDark, uSteel, 0.08 + diff * (0.28 + streak * 0.4) + pits * 0.1);
    metal += uRim * (spec * 0.55 + fres * 0.18);

  #ifdef LOW_DETAIL
    float n = fbm2(vec2(vT * 16.0 - uTime * 0.11, vS * 1.4 + vSeed * 13.0)) * 1.25;
  #else
    float n = fbm(vec2(vT * 16.0 - uTime * 0.11, vS * 1.4 + vSeed * 13.0));
  #endif
    float crack = 1.0 - smoothstep(0.0, 0.03, abs(n - 0.5));
    float flow = smoothstep(0.38, 0.85, vnoise(vec2(vT * 3.5 - uTime * 0.22, vSeed * 5.0)));
    float edge = smoothstep(0.86, 1.0, abs(vS));

    float hot = crack * (flow * 0.85 + 0.12) + edge * (0.35 + flow * 0.4);
    vec3 col = metal + emberRamp(clamp(hot, 0.0, 1.0)) * hot * 1.8;

    float fade = smoothstep(0.0, 0.07, vT) * smoothstep(1.0, 0.9, vT);
    gl_FragColor = vec4(col, uOpacity * fade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Additive molten edge strand with travelling pulses. */
export const glowFragment = /* glsl */ `
  ${COMMON_FRAG}

  void main() {
    float core = pow(1.0 - abs(vS), 2.2);
    float wave = sin(vT * 24.0 - uTime * 2.2 + vSeed * 9.0) * 0.5 + 0.5;
    float pulse = 0.3 + 0.7 * smoothstep(0.55, 1.0, wave);
    float fade = smoothstep(0.0, 0.1, vT) * smoothstep(1.0, 0.85, vT);
    float k = clamp(core * 0.55, 0.0, 1.0);
    vec3 col = emberRamp(k) * core * pulse;
    gl_FragColor = vec4(col, uOpacity * fade * core);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
