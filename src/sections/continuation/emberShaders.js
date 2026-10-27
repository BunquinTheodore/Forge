/** GLSL for the continuation ember field and its horizon line. */

export const emberVertex = /* glsl */ `
  attribute vec4 aSeed; // x rand, y speed, z size, w phase
  uniform float uTime;
  uniform float uErupt;
  uniform float uHeat;
  uniform float uHorizon;
  uniform float uDepth;
  uniform float uHeight;
  uniform float uScale;
  uniform float uWidth;
  uniform float uVis;
  uniform vec2 uPointer;
  varying float vHeat;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    p.x *= uWidth;
    float depth = p.y;
    float t = uTime * aSeed.y + aSeed.w;
    float y = uHorizon - depth * uDepth + sin(t * 1.3 + aSeed.x * 6.283) * 0.04;

    float gate = smoothstep(aSeed.x * 0.7, aSeed.x * 0.7 + 0.3, uErupt);
    float cyc = fract(t * 0.16 + aSeed.x * 3.7);
    float lift = cyc * cyc * uHeight * (0.3 + aSeed.x * 0.9);
    y += lift * gate;

    float sway = sin(t * 0.8 + aSeed.x * 12.0) * (0.06 + 0.4 * gate * cyc);
    p.x += sway + uPointer.x * 0.3 * (1.0 - depth);
    p.y = y;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float above = clamp((y - uHorizon) / uHeight, 0.0, 1.0);
    float smoulder = (0.25 + 0.75 * (1.0 - depth)) * (0.35 + 0.65 * uHeat);
    float flare = 0.5 + 0.5 * sin(t * 2.1 + aSeed.x * 40.0);
    vHeat = clamp(0.35 + (1.0 - depth) * 0.45 + gate * 0.35 - above * 0.5 + flare * 0.15, 0.0, 1.0);
    vAlpha = uVis * mix(smoulder * (0.55 + 0.45 * flare), 1.0 - cyc, gate);
    gl_PointSize = aSeed.z * uScale * (0.55 + vHeat * 0.9) / -mv.z;
  }
`;

export const emberFragment = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uEmber;
  uniform vec3 uGlow;
  varying float vHeat;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    core *= core;
    vec3 col = mix(uDeep, uEmber, smoothstep(0.0, 0.55, vHeat));
    col = mix(col, uGlow, smoothstep(0.55, 1.0, vHeat));
    col += vec3(1.0, 0.9, 0.75) * smoothstep(0.2, 0.0, d) * vHeat * 0.6;
    gl_FragColor = vec4(col * core * vAlpha, 1.0);
  }
`;

export const horizonVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const horizonFragment = /* glsl */ `
  uniform float uHeat;
  uniform float uErupt;
  uniform float uVis;
  uniform float uTime;
  uniform vec3 uEmber;
  uniform vec3 uGlow;
  varying vec2 vUv;

  void main() {
    float dy = abs(vUv.y - 0.5);
    float line = exp(-dy * 90.0);
    float haze = exp(-dy * 9.0) * (vUv.y > 0.5 ? 0.35 + uErupt * 0.9 : 0.5);
    float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
    float run = smoothstep(uHeat * 1.15 + 0.02, uHeat * 1.15 - 0.08, vUv.x);
    float shimmer = 0.85 + 0.15 * sin(vUv.x * 40.0 - uTime * 2.0);
    vec3 col = uEmber * haze * (0.25 + 0.75 * uHeat) + uGlow * line * (0.25 + 0.75 * run) * shimmer;
    gl_FragColor = vec4(col * edge * uVis, 1.0);
  }
`;
