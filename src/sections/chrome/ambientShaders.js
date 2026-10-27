/**
 * GLSL for the ambient layer. Positions are stored normalised (-1..1 of the
 * view at the particle's own depth) so the field always fills the frustum.
 */
const COMMON = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform float uVel;
  uniform float uHeat;
  uniform float uOpacity;
  uniform float uPR;
  uniform float uAspect;
  uniform float uTanHalf;
  uniform vec3 uCool;
  uniform vec3 uWarm;
  uniform vec3 uHot;
  const float CAM_Z = 10.0;
  const float NEAR_Z = 2.5;
  const float FAR_Z = -9.0;

  float depthOf(float z) { return clamp((z - FAR_Z) / (NEAR_Z - FAR_Z), 0.0, 1.0); }

  vec3 heatColor(float h) {
    vec3 warm = mix(uWarm, uHot, smoothstep(0.62, 1.0, h));
    return mix(uCool, warm, smoothstep(0.12, 0.72, h));
  }

  vec3 toWorld(vec2 n, float z) {
    float halfH = uTanHalf * (CAM_Z - z);
    return vec3(n.x * halfH * uAspect, n.y * halfH, z);
  }
`;

export const DUST_VERTEX = /* glsl */ `
  ${COMMON}
  uniform float uSize;
  attribute vec4 aRand; // size, speed, phase, warmth
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float depth = depthOf(position.z);
    vec2 n = position.xy;
    float rise = uTime * (0.012 + aRand.y * 0.03);
    float parallax = uScroll * (0.35 + depth * 1.4);
    n.y = mod(n.y + rise + parallax + 1.0, 2.0) - 1.0;
    n.x += sin(uTime * 0.21 + aRand.z * 6.2831 + n.y * 2.4) * 0.02 * (0.4 + depth);

    vec4 mv = modelViewMatrix * vec4(toWorld(n, position.z), 1.0);
    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.45 + aRand.x * 1.35) * (1.0 + uVel * 0.5);
    gl_PointSize = min(size * uPR * (CAM_Z / -mv.z), 48.0 * uPR);

    float h = clamp(uHeat + (aRand.w - 0.5) * 0.7, 0.0, 1.0);
    vColor = heatColor(h);
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + aRand.y * 2.6) + aRand.z * 40.0);
    vAlpha = uOpacity * twinkle * (0.18 + depth * 0.82) * (0.8 + uVel * 0.6);
  }
`;

export const DUST_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    float a = core * core * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }
`;

export const STREAK_VERTEX = /* glsl */ `
  ${COMMON}
  uniform float uLength;
  attribute vec4 aSeed; // start offset, slope, speed, size
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAngle;
  varying float vThick;

  void main() {
    float depth = depthOf(position.z);
    float s = fract(aSeed.x + uTime * (0.014 + aSeed.z * 0.022));
    vec2 n;
    n.x = mix(-1.35, 1.35, s);
    n.y = position.y + n.x * aSeed.y;
    n.y = mod(n.y + uScroll * (0.5 + depth) + 1.2, 2.4) - 1.2;

    vec4 mv = modelViewMatrix * vec4(toWorld(n, position.z), 1.0);
    gl_Position = projectionMatrix * mv;

    float stretch = 1.0 + uVel * 2.4;
    float size = uLength * (0.6 + aSeed.w) * stretch * (CAM_Z / -mv.z);
    gl_PointSize = min(size * uPR, 256.0 * uPR);
    vThick = 1.4 * uPR / max(gl_PointSize, 1.0);
    vAngle = atan(aSeed.y / uAspect);

    vColor = heatColor(clamp(uHeat * 0.85 + 0.25, 0.0, 1.0)) * 1.25;
    vAlpha = uOpacity * sin(s * 3.14159) * (0.25 + depth * 0.5) * (0.7 + uVel * 0.9);
  }
`;

export const STREAK_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAngle;
  varying float vThick;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    vec2 dir = vec2(cos(vAngle), -sin(vAngle));
    float along = dot(c, dir);
    float across = dot(c, vec2(-dir.y, dir.x));
    float line = exp(-(across * across) / (vThick * vThick));
    float tail = smoothstep(-0.48, 0.32, along) * (1.0 - smoothstep(0.32, 0.48, along));
    float a = line * tail * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }
`;
