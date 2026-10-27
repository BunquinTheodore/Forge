/** GLSL for CapitalAct: forged rings and the sparks that ride them. */

export const RING_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const RING_FRAG = /* glsl */`
  uniform float uTime; uniform float uHeat; uniform float uOpacity; uniform float uSeed;
  uniform vec3 uSteel; uniform vec3 uEmber; uniform vec3 uHot;
  varying vec2 vUv; varying vec3 vN; varying vec3 vView;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash(i), hash(i + 1.0), f); }
  void main() {
    float u = vUv.x * 48.0;
    float streak = noise(u + uSeed - uTime * 1.6) * noise(u * 0.37 + uSeed * 2.0 + uTime * 0.4);
    float fres = pow(1.0 - abs(dot(vN, vView)), 2.0);
    float heat = 0.25 + uHeat * 1.1;
    vec3 col = uSteel * (0.25 + fres * 0.9);
    col += uEmber * streak * heat * 1.4;
    col += uHot * pow(streak, 3.0) * heat * 1.6;
    col += uEmber * fres * uHeat * 0.6;
    gl_FragColor = vec4(col * uOpacity, 1.0);
  }
`;

export const SPARK_VERT = /* glsl */`
  attribute float aAngle; attribute float aSeed;
  uniform float uTime; uniform float uRadius; uniform float uPixel; uniform float uHeat;
  varying float vSeed;
  void main() {
    vSeed = aSeed;
    float a = aAngle + uTime * (0.15 + aSeed * 0.35);
    float drift = sin(uTime * 0.8 + aSeed * 30.0) * 0.04;
    vec3 p = vec3(cos(a) * (uRadius + drift), sin(a) * (uRadius + drift), drift * 1.5);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uPixel * (0.012 + aSeed * 0.02) * (0.7 + uHeat) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

export const SPARK_FRAG = /* glsl */`
  uniform vec3 uEmber; uniform vec3 uHot; uniform float uOpacity; uniform float uTime;
  varying float vSeed;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    float flick = 0.55 + 0.45 * sin(uTime * (3.0 + vSeed * 5.0) + vSeed * 40.0);
    gl_FragColor = vec4(mix(uEmber, uHot, a) * a * a * flick * uOpacity, 1.0);
  }
`;
