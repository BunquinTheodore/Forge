import { CITIES, ROUTES, latLonToUnit, sampleArc } from './corridorData.js';
import { LAND, LAKES } from './landData.js';

const NS = 'http://www.w3.org/2000/svg';
const C = 200;          // viewBox centre (0 0 400 400)
const R = 184;          // sphere radius in viewBox units (0.92 of half size, same as the GL act)
const DEG = Math.PI / 180;
const ARC_SAMPLES = 48;
const GRID_STEP = 30;
const GRID_SAMPLE = 5;

const el = (name, attrs = {}, parent = null) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
};
const fmt = (n) => Math.round(n * 10) / 10;

/** Pre-sample polygons as unit vectors once. */
function toUnitRings(polys) {
  return polys.map((flat) => {
    const out = new Float32Array((flat.length / 2) * 3);
    for (let i = 0, j = 0; i < flat.length; i += 2, j += 3) latLonToUnit(flat[i + 1], flat[i], out, j);
    return out;
  });
}

function graticule() {
  const lines = [];
  for (let lon = -180; lon < 180; lon += GRID_STEP) {
    const flat = [];
    for (let lat = -80; lat <= 80; lat += GRID_SAMPLE) flat.push(lon, lat);
    lines.push(flat);
  }
  for (let lat = -60; lat <= 60; lat += GRID_STEP) {
    const flat = [];
    for (let lon = -180; lon <= 180; lon += GRID_SAMPLE) flat.push(lon, lat);
    lines.push(flat);
  }
  return toUnitRings(lines);
}

/**
 * Orthographic (optionally perspective-corrected) SVG globe.
 * Full mode = no-GL fallback (land dots, graticule, arcs, pulses).
 * In GL mode CSS hides everything except the city labels, which track the 3D globe.
 */
export class CorridorMap {
  constructor(svg) {
    this.svg = svg;
    this.persp = 0;
    this.ox = 0;
    this.oy = 0;
    this.v = [0, 0, 0];
    this.land = toUnitRings(LAND);
    this.lakes = toUnitRings(LAKES);
    this.grid = graticule();
    this.arcs = ROUTES.map(([from, to, gate, len]) => {
      const pts = new Float32Array(ARC_SAMPLES * 3);
      sampleArc(CITIES[from], CITIES[to], ARC_SAMPLES, pts);
      return { pts, gate, len };
    });
    this.#build();
  }

  #build() {
    const defs = el('defs', {}, this.svg);
    const pat = el('pattern', { id: 'corridor-dots', width: 5, height: 5, patternUnits: 'userSpaceOnUse' }, defs);
    el('circle', { cx: 2.5, cy: 2.5, r: 1.15, class: 'cmap__dot' }, pat);
    const glow = el('radialGradient', { id: 'corridor-sphere', cx: '42%', cy: '38%', r: '70%' }, defs);
    el('stop', { offset: '0%', class: 'cmap__stop-a' }, glow);
    el('stop', { offset: '100%', class: 'cmap__stop-b' }, glow);

    const base = el('g', { class: 'cmap__base' }, this.svg);
    el('circle', { cx: C, cy: C, r: R, class: 'cmap__sphere', fill: 'url(#corridor-sphere)' }, base);
    this.gridPath = el('path', { class: 'cmap__grid' }, base);
    this.landPath = el('path', { class: 'cmap__land', fill: 'url(#corridor-dots)' }, base);
    this.lakePath = el('path', { class: 'cmap__lake' }, base);
    el('circle', { cx: C, cy: C, r: R, class: 'cmap__rim' }, base);

    const arcs = el('g', { class: 'cmap__arcs' }, this.svg);
    this.arcEls = this.arcs.map((_, i) => ({
      line: el('path', { class: 'cmap__arc' }, arcs),
      pulse: el('path', { class: 'cmap__pulse', pathLength: 100, style: `animation-delay:${-i * 0.37}s` }, arcs),
    }));

    const cities = el('g', { class: 'cmap__cities' }, this.svg);
    this.cityEls = Object.entries(CITIES).map(([key, c]) => {
      const g = el('g', { class: 'cmap__city', 'data-city': key, 'data-city-region': c.region }, cities);
      el('circle', { r: 7, class: 'cmap__ring' }, g);
      el('circle', { r: 2.6, class: 'cmap__core' }, g);
      if (c.label) {
        const t = el('text', { x: c.dx || 0, y: (c.dy || 0) + 3.5, 'text-anchor': c.anchor || 'start', class: 'cmap__label' }, g);
        t.textContent = c.label;
      }
      const unit = latLonToUnit(c.lat, c.lon, new Float32Array(3));
      return { g, unit };
    });
  }

  /**
   * persp = sphere radius in world units / camera distance (0 = pure orthographic).
   * ox, oy = globe centre offset from the viewport centre, in viewBox units. An off-axis
   * globe under a perspective camera shifts nearer points outward by offset * (k - 1).
   */
  setPerspective(persp, ox = 0, oy = 0) {
    this.persp = persp;
    this.ox = ox;
    this.oy = oy;
  }

  #setView(lon, lat) {
    const ry = -Math.PI / 2 - lon * DEG;
    const rx = lat * DEG;
    this.cy = Math.cos(ry); this.sy = Math.sin(ry);
    this.cx = Math.cos(rx); this.sx = Math.sin(rx);
  }

  /** Rotate an object-space vector into view space (same order as the GL tilt and spin groups). */
  #view(arr, i, scale = 1) {
    const x = arr[i] * scale; const y = arr[i + 1] * scale; const z = arr[i + 2] * scale;
    const x1 = x * this.cy + z * this.sy;
    const z1 = -x * this.sy + z * this.cy;
    const v = this.v;
    v[0] = x1;
    v[1] = y * this.cx - z1 * this.sx;
    v[2] = y * this.sx + z1 * this.cx;
    return v;
  }

  #screen(v) {
    const k = 1 / (1 - v[2] * this.persp);
    return `${fmt(C + v[0] * R * k + this.ox * (k - 1))} ${fmt(C - v[1] * R * k + this.oy * (k - 1))}`;
  }

  #ringPath(ring, closed) {
    let d = '';
    let any = false;
    for (let i = 0; i < ring.length; i += 3) {
      const v = this.#view(ring, i);
      if (v[2] < 0) {
        const len = Math.hypot(v[0], v[1]) || 1;
        v[0] /= len; v[1] /= len; v[2] = 0;
      } else any = true;
      d += (i === 0 ? 'M' : 'L') + this.#screen(v);
    }
    return any ? d + (closed ? 'Z' : '') : '';
  }

  #linePath(ring, count = ring.length / 3) {
    let d = '';
    let pen = false;
    for (let i = 0; i < count; i += 1) {
      const v = this.#view(ring, i * 3);
      const hidden = v[2] < 0 && Math.hypot(v[0], v[1]) < 1;
      if (hidden) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + this.#screen(v);
      pen = true;
    }
    return d;
  }

  /** Full redraw (fallback mode). */
  render(lon, lat, reveal) {
    this.#setView(lon, lat);
    this.landPath.setAttribute('d', this.land.map((r) => this.#ringPath(r, true)).join(''));
    this.lakePath.setAttribute('d', this.lakes.map((r) => this.#ringPath(r, true)).join(''));
    this.gridPath.setAttribute('d', this.grid.map((r) => this.#linePath(r)).join(''));
    this.arcs.forEach((arc, i) => {
      const local = Math.min(1, Math.max(0, (reveal - arc.gate) / arc.len));
      const count = Math.round(local * ARC_SAMPLES);
      const d = count > 1 ? this.#linePath(arc.pts, count) : '';
      this.arcEls[i].line.setAttribute('d', d);
      this.arcEls[i].pulse.setAttribute('d', local >= 1 ? d : '');
    });
    this.renderCities();
  }

  /** Cheap update for the label overlay that rides on top of the GL globe. */
  renderCities(lon, lat) {
    if (lon !== undefined) this.#setView(lon, lat);
    for (const city of this.cityEls) {
      const v = this.#view(city.unit, 0, 1.005);
      const k = 1 / (1 - v[2] * this.persp);
      const facing = v[2] > 0.12;
      const x = C + v[0] * R * k + this.ox * (k - 1);
      const y = C - v[1] * R * k + this.oy * (k - 1);
      city.g.setAttribute('transform', `translate(${fmt(x)} ${fmt(y)})`);
      city.g.classList.toggle('is-hidden', !facing);
    }
  }
}
