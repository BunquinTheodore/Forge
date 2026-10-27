/** GLSL for the AskAct forge finale. Colours are written in display (sRGB) space. */

export const SPARK_VERT = /* glsl */ `
uniform float uTime;
uniform float uConverge;
uniform float uHeat;
uniform float uPixel;
uniform vec2 uSpread;
uniform vec2 uPointer;
uniform vec3 uCore;
attribute vec4 aSeed; // x delay/phase, y speed, z size, w orbit radius
varying float vHot;
varying float vTw;

void main() {
  float span = 2.0 * uSpread.y;
  vec3 start = vec3(
    position.x * uSpread.x + sin(uTime * 0.3 + aSeed.x * 12.0) * 0.25,
    mod(position.y * uSpread.y + uTime * (0.25 + aSeed.y * 0.6) + uSpread.y, span) - uSpread.y,
    position.z * 2.5
  );

  float ang = aSeed.x * 6.2831 + uTime * (0.35 + aSeed.y * 0.9);
  float r = aSeed.w * (1.0 - 0.5 * uHeat);
  vec3 orbit = uCore + vec3(cos(ang) * r, sin(ang) * r * 0.62, sin(ang) * r * 0.35);

  float c = clamp(uConverge * 1.8 - aSeed.x * 0.8, 0.0, 1.0);
  c = c * c * (3.0 - 2.0 * c);
  vec3 p = mix(start, orbit, c);

  vec2 d = p.xy - uPointer;
  float fall = exp(-dot(d, d) * 1.6);
  p.xy += normalize(d + vec2(0.0001)) * fall * (0.35 + 0.5 * c);

  vHot = c;
  vTw = 0.6 + 0.4 * sin(uTime * (3.0 + aSeed.y * 6.0) + aSeed.x * 40.0);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSeed.z * uPixel * (0.8 + 0.9 * c * uHeat) / -mv.z;
}
`;

export const SPARK_FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uHeat;
varying float vHot;
varying float vTw;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  vec3 ember = vec3(0.91, 0.36, 0.13);
  vec3 glow = vec3(1.0, 0.70, 0.42);
  vec3 col = mix(ember, glow, clamp(vHot * uHeat * 1.4, 0.0, 1.0));
  gl_FragColor = vec4(col, a * vTw * uOpacity * (0.45 + 0.55 * vHot));
}
`;

export const CORE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const CORE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uHeat;
uniform float uOpacity;
varying vec2 vUv;

void main() {
  vec2 q = vUv - 0.5;
  float d = length(q) * 2.0;
  float ang = atan(q.y, q.x);
  float flick = 0.85 + 0.15 * sin(uTime * 6.0 + ang * 5.0) * sin(uTime * 2.3 - ang * 3.0);
  float core = exp(-d * d * 22.0);
  float halo = exp(-d * 4.0) * 0.55 * flick;
  float rim = smoothstep(0.03, 0.0, abs(d - 0.42 - 0.04 * sin(uTime * 1.2))) * 0.12 * uHeat;
  vec3 ember = vec3(0.91, 0.36, 0.13);
  vec3 glow = vec3(1.0, 0.70, 0.42);
  vec3 col = mix(ember, glow, core) + vec3(1.0, 0.82, 0.62) * core * uHeat * 0.6;
  float a = (core * (0.3 + 0.6 * uHeat) + halo + rim) * uHeat * uOpacity * smoothstep(1.0, 0.55, d);
  gl_FragColor = vec4(col, a);
}
`;
