/** GLSL for the forged glass/metal plates and the sparks shed by the active plate. */

export const plateVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vPos;
  void main() {
    vPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    vN = normalMatrix * normal;
    gl_Position = projectionMatrix * mv;
  }
`;

export const plateFragment = /* glsl */ `
  uniform float uActive;
  uniform float uVis;
  uniform float uTime;
  uniform vec2 uHalf;
  uniform vec3 uSteel;
  uniform vec3 uSteelHi;
  uniform vec3 uEmber;
  uniform vec3 uGlow;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vPos;

  void main() {
    vec3 n = normalize(vN);
    float fres = pow(1.0 - abs(dot(n, normalize(vView))), 2.2);
    float top = smoothstep(0.4, 0.9, abs(n.y));
    float brush = 0.5 + 0.5 * sin(vPos.z * 220.0 + sin(vPos.x * 9.0) * 2.5);
    vec3 base = mix(uSteel, uSteelHi, brush * 0.25 + top * 0.35 + fres * 0.3);

    vec2 e = abs(vPos.xz) / uHalf;
    float rim = smoothstep(0.88, 1.0, max(e.x, e.y));
    float flow = 0.5 + 0.5 * sin(vPos.x * 10.0 - uTime * 1.8 + vPos.z * 7.0);
    float core = (1.0 - smoothstep(0.0, 1.0, length(e))) * top;

    vec3 edgeCol = mix(uSteelHi * 1.6, uEmber * 1.4, uActive);
    vec3 col = base * (0.6 + 0.6 * top);
    col += edgeCol * rim * (0.35 + uActive * 0.9);
    col += mix(uSteelHi, uGlow, uActive) * fres * (0.35 + 0.5 * uActive);
    col += mix(uEmber, uGlow, flow) * core * uActive * 0.6;
    float a = (0.5 + fres * 0.3 + rim * 0.3 + uActive * 0.2) * uVis;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`;

export const sparkVertex = /* glsl */ `
  attribute vec3 aSeed; // x rand, y speed, z size
  uniform float uTime;
  uniform float uScale;
  uniform float uRise;
  varying float vLife;
  void main() {
    float life = fract(uTime * aSeed.y * 0.35 + aSeed.x * 7.0);
    vec3 p = position;
    p.y += life * uRise;
    p.x += sin(life * 6.0 + aSeed.x * 30.0) * 0.04;
    vLife = life;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSeed.z * uScale * (1.0 - life * 0.6) / -mv.z;
  }
`;

export const sparkFragment = /* glsl */ `
  uniform vec3 uEmber;
  uniform vec3 uGlow;
  uniform float uAmount;
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float g = smoothstep(0.5, 0.0, d);
    vec3 col = mix(uGlow, uEmber, vLife);
    float a = g * g * (1.0 - vLife) * uAmount;
    gl_FragColor = vec4(col * a, 1.0);
  }
`;
