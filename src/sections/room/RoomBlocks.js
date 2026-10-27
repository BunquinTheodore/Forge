import {
  BoxGeometry, EdgesGeometry, BufferGeometry, BufferAttribute, Float32BufferAttribute, PlaneGeometry,
  Mesh, LineSegments, ShaderMaterial, AdditiveBlending, Color,
} from 'three';
import { ZONES, GRID, zoneCentre } from './zones.js';

const GAP = 0.09;

const SHARED_VERT_HEAD = /* glsl */`
  uniform float uGlow[${ZONES.length}];
  attribute vec2 aInfo;           // x = zone index, y = block height
  varying float vGlow;
  varying float vY;
`;

const BLOCK_VERT = /* glsl */`
  ${SHARED_VERT_HEAD}
  varying vec3 vNormal;
  void main() {
    vGlow = uGlow[int(aInfo.x + 0.5)];
    vY = clamp(position.y / max(aInfo.y, 0.001), 0.0, 1.0);
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BLOCK_FRAG = /* glsl */`
  uniform vec3 uBase; uniform vec3 uRim; uniform vec3 uEmber; uniform vec3 uHot;
  uniform float uOpacity;
  varying float vGlow; varying float vY; varying vec3 vNormal;
  void main() {
    float top = step(0.5, vNormal.y);
    float side = 1.0 - top;
    vec3 col = mix(uBase, uRim, vY * 0.55 + top * 0.35);
    col += uEmber * vGlow * (0.25 + 0.75 * vY) * side;
    col = mix(col, mix(uEmber, uHot, 0.4), vGlow * top * 0.85);
    col += uHot * pow(vY, 6.0) * side * (0.15 + vGlow);
    gl_FragColor = vec4(col, uOpacity);
  }
`;

const EDGE_VERT = /* glsl */`
  ${SHARED_VERT_HEAD}
  void main() {
    vGlow = uGlow[int(aInfo.x + 0.5)];
    vY = clamp(position.y / max(aInfo.y, 0.001), 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EDGE_FRAG = /* glsl */`
  uniform vec3 uLine; uniform vec3 uHot; uniform float uOpacity;
  varying float vGlow; varying float vY;
  void main() {
    vec3 col = mix(uLine * (0.35 + 0.4 * vY), uHot * 1.4, vGlow);
    gl_FragColor = vec4(col * uOpacity, 1.0);
  }
`;

const FLOOR_VERT = /* glsl */`
  varying vec2 vP;
  void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const FLOOR_FRAG = /* glsl */`
  uniform vec3 uLine; uniform vec3 uEmber; uniform float uOpacity; uniform float uTime;
  varying vec2 vP;
  float grid(vec2 p, float s) {
    vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }
  void main() {
    float fine = grid(vP, 0.5) * 0.35 + grid(vP, 1.0) * 0.65;
    float r = length(vP / vec2(${(GRID.cols / 2 + 0.6).toFixed(2)}, ${(GRID.rows / 2 + 0.6).toFixed(2)}));
    float fade = smoothstep(1.05, 0.55, r);
    float pulse = 0.5 + 0.5 * sin(uTime * 0.6 - r * 5.0);
    vec3 col = uLine * fine * 0.55 + uEmber * fade * (0.05 + 0.04 * pulse);
    gl_FragColor = vec4(col * fade * uOpacity, 1.0);
  }
`;

/** Append one geometry's attributes into flat arrays, tagging each vertex with zone info. */
function appendGeometry(geo, zoneIdx, lift, dx, dz, out) {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const base = out.pos.length / 3;
  for (let i = 0; i < pos.count; i += 1) {
    out.pos.push(pos.getX(i) + dx, pos.getY(i), pos.getZ(i) + dz);
    if (nor) out.nor.push(nor.getX(i), nor.getY(i), nor.getZ(i));
    out.info.push(zoneIdx, lift);
  }
  if (geo.index) for (const v of geo.index.array) out.idx.push(v + base);
}

function toGeometry(out) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(out.pos, 3));
  if (out.nor.length) g.setAttribute('normal', new Float32BufferAttribute(out.nor, 3));
  g.setAttribute('aInfo', new Float32BufferAttribute(out.info, 2));
  if (out.idx.length) g.setIndex(new BufferAttribute(new Uint16Array(out.idx), 1));
  return g;
}

/**
 * The extruded zone blocks, their glowing edges and the gridded floor.
 * Three draw calls in total; glow per zone is a uniform array driven by RoomAct.
 */
export class RoomBlocks {
  constructor(act) {
    this.glow = new Float32Array(ZONES.length);
    const solids = { pos: [], nor: [], info: [], idx: [] };
    const edges = { pos: [], nor: [], info: [], idx: [] };
    ZONES.forEach((z, i) => {
      const { x, z: cz } = zoneCentre(z);
      const box = new BoxGeometry(z.w - GAP * 2, z.lift, z.h - GAP * 2);
      box.translate(0, z.lift / 2, 0);
      const edge = new EdgesGeometry(box);
      appendGeometry(box, i, z.lift, x, cz, solids);
      appendGeometry(edge, i, z.lift, x, cz, edges);
      box.dispose(); edge.dispose();
    });

    const c = (v) => new Color(v);
    const glowUniform = { value: this.glow };
    this.blockMat = act.track(new ShaderMaterial({
      vertexShader: BLOCK_VERT, fragmentShader: BLOCK_FRAG, transparent: true,
      uniforms: {
        uGlow: glowUniform, uOpacity: { value: 0 },
        uBase: { value: c('#0b1420') }, uRim: { value: c('#293342') },
        uEmber: { value: c('#e85b22') }, uHot: { value: c('#ffb36b') },
      },
    }));
    this.edgeMat = act.track(new ShaderMaterial({
      vertexShader: EDGE_VERT, fragmentShader: EDGE_FRAG, transparent: true, depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uGlow: glowUniform, uOpacity: { value: 0 }, uLine: { value: c('#aeb7c4') }, uHot: { value: c('#ff7a2f') } },
    }));
    this.floorMat = act.track(new ShaderMaterial({
      vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG, transparent: true, depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, uLine: { value: c('#aeb7c4') }, uEmber: { value: c('#e85b22') } },
    }));

    const floorGeo = act.track(new PlaneGeometry(GRID.cols + 1.2, GRID.rows + 1.2, 1, 1));
    floorGeo.rotateX(-Math.PI / 2);

    this.floor = new Mesh(floorGeo, this.floorMat);
    this.floor.renderOrder = 0;
    this.solids = new Mesh(act.track(toGeometry(solids)), this.blockMat);
    this.solids.renderOrder = 1;
    this.edges = new LineSegments(act.track(toGeometry(edges)), this.edgeMat);
    this.edges.renderOrder = 2;
    this.objects = [this.floor, this.solids, this.edges];
  }

  setOpacity(o) {
    this.blockMat.uniforms.uOpacity.value = o;
    this.edgeMat.uniforms.uOpacity.value = o;
    this.floorMat.uniforms.uOpacity.value = o;
  }

  setTime(t) { this.floorMat.uniforms.uTime.value = t; }
}
