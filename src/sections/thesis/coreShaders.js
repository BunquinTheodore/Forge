/** GLSL for ThesisAct. Kept apart so the act file stays readable. */

export const WIRE = {
  vertex: /* glsl */ `
    attribute vec3 aMid;
    attribute float aRand;
    uniform float uExplode;
    uniform float uRound;
    uniform float uStretch;
    uniform float uRadius;
    varying float vFacing;
    varying float vRand;
    void main() {
      vec3 p = mix(position, normalize(position) * uRadius, uRound);
      vec3 dir = normalize(aMid + 1e-4);
      p += dir * uExplode * (0.35 + aRand * 1.4);
      p.x *= 1.0 + uStretch;
      p.yz *= 1.0 - uStretch * 0.25;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vec3 n = normalize(normalMatrix * dir);
      vFacing = n.z * 0.5 + 0.5;
      vRand = aRand;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragment: /* glsl */ `
    uniform vec3 uSteel;
    uniform vec3 uEmber;
    uniform float uHeat;
    uniform float uOpacity;
    varying float vFacing;
    varying float vRand;
    void main() {
      float heat = clamp(uHeat * (0.45 + vRand * 0.9) * (1.2 - vFacing * 0.6), 0.0, 1.0);
      vec3 col = mix(uSteel, uEmber, heat);
      float a = uOpacity * (0.18 + 0.82 * vFacing);
      gl_FragColor = vec4(col * (0.7 + vFacing * 0.6), a);
    }
  `,
};

export const CORE = {
  vertex: /* glsl */ `
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragment: /* glsl */ `
    uniform vec3 uEmber;
    uniform vec3 uHot;
    uniform float uPower;
    uniform float uOpacity;
    uniform float uTime;
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      float f = 1.0 - max(dot(vN, vV), 0.0);
      float rim = pow(f, 2.2);
      float pulse = 0.85 + 0.15 * sin(uTime * 1.7);
      vec3 col = mix(uHot, uEmber, rim) * uPower * pulse;
      float a = uOpacity * (0.35 + rim * 0.9);
      gl_FragColor = vec4(col, a);
    }
  `,
};

export const GLOW = {
  vertex: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragment: /* glsl */ `
    uniform vec3 uEmber;
    uniform float uOpacity;
    varying vec2 vUv;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      float g = pow(max(1.0 - d, 0.0), 2.6);
      gl_FragColor = vec4(uEmber, g * uOpacity);
    }
  `,
};

export const SPARKS = {
  vertex: /* glsl */ `
    attribute vec3 aSeed;
    uniform float uTime;
    uniform float uSize;
    uniform float uSpread;
    varying float vTw;
    void main() {
      float ang = aSeed.x * 6.2831 + uTime * (0.08 + aSeed.y * 0.22);
      float r = 1.9 + aSeed.y * 1.6 * uSpread;
      float tilt = (aSeed.z - 0.5) * 1.6;
      vec3 p = vec3(cos(ang) * r, sin(ang * 0.7 + aSeed.z * 6.0) * tilt, sin(ang) * r);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vTw = 0.5 + 0.5 * sin(uTime * (1.5 + aSeed.z * 3.0) + aSeed.x * 40.0);
      gl_PointSize = uSize * (0.4 + aSeed.z) * (10.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragment: /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying float vTw;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d) * uOpacity * (0.25 + vTw * 0.75);
      gl_FragColor = vec4(uColor, a);
    }
  `,
};
