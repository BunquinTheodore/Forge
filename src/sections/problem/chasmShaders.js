/** GLSL for ProblemAct: two particle clouds over a chasm, and sparks trying to cross. */

export const CLOUD = {
  vertex: /* glsl */ `
    attribute vec4 aSeed;
    attribute float aSide;
    uniform float uTime;
    uniform float uOpen;
    uniform float uHalfW;
    uniform float uHalfH;
    uniform float uSize;
    varying float vLip;
    varying float vSide;
    varying float vTw;
    void main() {
      float gap = uHalfW * mix(0.05, 0.3, uOpen);
      float spread = uHalfW * 0.62;
      float ang = aSeed.x * 6.2831 + uTime * 0.04 * (0.4 + aSeed.w);
      float r = pow(aSeed.y, 0.55);
      vec2 local = vec2(cos(ang) * spread * 0.55, sin(ang) * uHalfH * 0.75) * r;
      float x = aSide * (gap + spread * 0.5) + local.x;
      x = aSide > 0.0 ? max(x, gap) : min(x, -gap);
      vec3 p = vec3(x, local.y, (aSeed.z - 0.5) * 3.0);
      vLip = 1.0 - smoothstep(0.0, uHalfW * 0.12, abs(x) - gap);
      vSide = aSide;
      vTw = 0.55 + 0.45 * sin(uTime * (0.8 + aSeed.w * 2.0) + aSeed.x * 50.0);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uSize * (0.5 + aSeed.w) * (1.0 + vLip * 0.8) * (10.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragment: /* glsl */ `
    uniform vec3 uCool;
    uniform vec3 uWarm;
    uniform vec3 uHot;
    uniform float uOpacity;
    uniform float uBridge;
    varying float vLip;
    varying float vSide;
    varying float vTw;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float soft = smoothstep(0.5, 0.05, d);
      vec3 base = vSide < 0.0 ? uCool : uWarm;
      vec3 col = mix(base, uHot, vLip * (0.35 + uBridge * 0.5));
      float a = soft * uOpacity * vTw * (0.22 + vLip * 0.6 + uBridge * 0.15);
      gl_FragColor = vec4(col, a);
    }
  `,
};

export const SPARK = {
  vertex: /* glsl */ `
    attribute vec3 aSeed;
    uniform float uTime;
    uniform float uOpen;
    uniform float uHalfW;
    uniform float uHalfH;
    uniform float uBridge;
    uniform float uSize;
    varying float vAlpha;
    void main() {
      float gap = uHalfW * mix(0.05, 0.3, uOpen);
      float t = fract(uTime * (0.08 + aSeed.y * 0.12) + aSeed.x);
      float dir = aSeed.z > 0.5 ? 1.0 : -1.0;
      float reach = mix(0.32, 1.08, uBridge) * (0.75 + aSeed.y * 0.35);
      float x = dir * mix(-gap, gap, t);
      float y = (aSeed.y - 0.5) * uHalfH * 0.9 + sin(t * 3.1416) * uHalfH * 0.18 * (aSeed.z - 0.3);
      vec3 p = vec3(x, y, (aSeed.x - 0.5) * 1.5);
      float born = smoothstep(0.0, 0.08, t);
      float die = 1.0 - smoothstep(reach - 0.12, reach, t);
      vAlpha = born * die;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uSize * (0.6 + aSeed.z * 0.8) * (10.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragment: /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d) * vAlpha * uOpacity;
      gl_FragColor = vec4(uColor, a);
    }
  `,
};
