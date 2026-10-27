import {
  Group, BufferGeometry, BufferAttribute, Points, LineSegments, Mesh, SphereGeometry, PlaneGeometry,
  ShaderMaterial, AdditiveBlending, NormalBlending, Vector3, MathUtils,
} from 'three';
import { GLAct } from '../../gl/GLAct.js';
import { corridorState } from './corridorState.js';
import { latLonToUnit } from './corridorData.js';
import { buildDots, buildArcs } from './globeBuilders.js';
import { dotsShader, arcLineShader, arcPointShader, shellShader, haloShader } from './globeShaders.js';

const DOTS_HIGH = 22000;
const DOT_SIZE = 0.0085;
const GLOBE_FILL = 0.92;   // fraction of the anchor box (matches the SVG label overlay)
const HALO_SCALE = 1.5;
const DEG = Math.PI / 180;

/**
 * CorridorAct: a dotted globe with glowing arcs Milan/Rome to Manila and Manila to ASEAN capitals.
 * View direction comes from corridorState (written by CorridorSection), so tabs, drag, keys and
 * scroll all steer the same globe. Five draw calls: shell, halo, dots, arc lines, arc dots.
 */
export default class CorridorAct extends GLAct {
  static order = 2;

  async init() {
    this.anchor = this.section.querySelector('[data-globe-anchor]');
    this.root = new Group();
    this.tilt = new Group();
    this.spin = new Group();
    this.root.add(this.tilt);
    this.tilt.add(this.spin);
    this.group.add(this.root);

    this.focus = new Vector3(1, 0, 0);
    this.focusArr = [0, 0, 0];
    this.time = 0;
    this.radiusPx = 1;

    this.#buildShell();
    this.#buildDots();
    this.#buildArcs();
    this.#flag(true);
  }

  #material(shader, uniforms, extra = {}) {
    return this.track(new ShaderMaterial({
      vertexShader: shader.vertex,
      fragmentShader: shader.fragment,
      uniforms,
      transparent: true,
      depthWrite: false,
      ...extra,
    }));
  }

  #buildShell() {
    const shellGeo = this.track(new SphereGeometry(0.99, 48, 32));
    this.shellMat = this.#material(shellShader, { uVis: { value: 0 } }, { depthWrite: true, blending: NormalBlending });
    const shell = new Mesh(shellGeo, this.shellMat);
    shell.renderOrder = 0;
    this.spin.add(shell);

    const haloGeo = this.track(new PlaneGeometry(2 * HALO_SCALE, 2 * HALO_SCALE));
    this.haloMat = this.#material(haloShader, { uVis: { value: 0 }, uScale: { value: HALO_SCALE } }, { blending: AdditiveBlending });
    const halo = new Mesh(haloGeo, this.haloMat);
    halo.renderOrder = 1;
    this.root.add(halo);
  }

  #buildDots() {
    const data = buildDots(Math.round(DOTS_HIGH * this.detail));
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(data.position, 3));
    geo.setAttribute('aLand', new BufferAttribute(data.land, 1));
    geo.setAttribute('aRand', new BufferAttribute(data.rand, 1));
    this.dotsMat = this.#material(dotsShader, {
      uTime: { value: 0 },
      uIntro: { value: 0 },
      uPx: { value: 1 },
      uDot: { value: DOT_SIZE / Math.sqrt(this.detail) },
      uFocus: { value: this.focus },
      uVis: { value: 0 },
    });
    const dots = new Points(geo, this.dotsMat);
    dots.renderOrder = 2;
    dots.frustumCulled = false;
    this.spin.add(dots);
  }

  #arcGeometry(buf) {
    const geo = this.track(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(buf.position, 3));
    geo.setAttribute('aGate', new BufferAttribute(buf.gate, 1));
    geo.setAttribute('aT', new BufferAttribute(buf.t, 1));
    geo.setAttribute('aSeed', new BufferAttribute(buf.seed, 1));
    geo.setAttribute('aKind', new BufferAttribute(buf.kind, 1));
    return geo;
  }

  #buildArcs() {
    const { lines, dots } = buildArcs();
    // Both arc materials share one uniforms object so a single write drives them.
    this.arcUniforms = {
      uTime: { value: 0 }, uReveal: { value: 0 }, uIntro: { value: 0 }, uPx: { value: 1 }, uVis: { value: 0 },
    };
    const lineMat = this.#material(arcLineShader, this.arcUniforms, { blending: AdditiveBlending });
    const pointMat = this.#material(arcPointShader, this.arcUniforms, {
      blending: AdditiveBlending, defines: { ARC_POINTS: '' },
    });
    const lineMesh = new LineSegments(this.#arcGeometry(lines), lineMat);
    const pointMesh = new Points(this.#arcGeometry(dots), pointMat);
    lineMesh.renderOrder = 3;
    pointMesh.renderOrder = 4;
    lineMesh.frustumCulled = false;
    pointMesh.frustumCulled = false;
    this.spin.add(lineMesh, pointMesh);
  }

  /** Tell the section a live globe is rendering, so the SVG switches to label overlay mode. */
  #flag(on) {
    corridorState.glActive = on;
    this.section.classList.toggle('has-globe', on);
  }

  #place() {
    const rect = this.anchor.getBoundingClientRect();
    const box = this.stage.rectToWorld(rect, 0);
    const r = Math.min(box.w, box.h) * 0.5 * GLOBE_FILL;
    this.root.position.set(box.x, box.y, 0);
    this.root.scale.setScalar(Math.max(0.0001, r));
    this.radiusPx = Math.min(rect.width, rect.height) * 0.5 * GLOBE_FILL * this.stage.renderer.getPixelRatio();
  }

  update(dt, time, state) {
    const s = corridorState;
    const vis = state.visibility;
    if (s.animate) this.time += dt;
    this.#place();

    // Same rotation order as CorridorMap, so the DOM city labels sit exactly on the dots.
    this.spin.rotation.y = -Math.PI / 2 - s.lon * DEG;
    this.tilt.rotation.x = s.lat * DEG;

    latLonToUnit(s.focusLat, s.focusLon, this.focusArr);
    this.focus.set(this.focusArr[0], this.focusArr[1], this.focusArr[2]);

    const intro = s.intro;
    const body = vis * MathUtils.smoothstep(intro, 0.35, 1);
    this.shellMat.uniforms.uVis.value = body;
    this.haloMat.uniforms.uVis.value = body;

    const du = this.dotsMat.uniforms;
    du.uTime.value = this.time;
    du.uIntro.value = intro;
    du.uPx.value = this.radiusPx;
    du.uVis.value = vis;

    const au = this.arcUniforms;
    au.uTime.value = this.time;
    au.uReveal.value = s.reveal;
    au.uIntro.value = intro;
    au.uPx.value = this.radiusPx;
    au.uVis.value = vis;
  }

  dispose() {
    this.#flag(false);
    super.dispose();
  }
}
