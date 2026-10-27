import { ROLES, flowsFor, OPEN_ROLE_NOTE } from './roles.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CX = 200;
const CY = 200;
const R = 140;
const NODE_R = 9;
const CURVE = 26;   // perpendicular bend of each flow line, px in viewBox units

const svgEl = (tag, attrs) => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

/**
 * Hexagonal flow map: the selected role sends ember lines to the roles it provides for
 * and receives dashed lines from the roles it draws on. Also fills the readable flow lists.
 */
export class RoleMap {
  constructor(root, { listen, onPick }) {
    this.svg = root.querySelector('[data-map]');
    this.linesG = root.querySelector('[data-map-lines]');
    this.nodesG = root.querySelector('[data-map-nodes]');
    this.nameEl = root.querySelector('[data-flow-name]');
    this.giveEl = root.querySelector('[data-flow-give]');
    this.drawEl = root.querySelector('[data-flow-draw]');
    this.statusEl = root.querySelector('[data-flow-status]');
    this.points = ROLES.map((_, i) => {
      const a = (-90 + i * 60) * (Math.PI / 180);
      return { x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R, a };
    });
    this.nodes = this.#buildNodes();
    this.index = -1;
    this.announced = false;

    listen(this.nodesG, 'click', (e) => {
      const g = e.target.closest('[data-i]');
      if (g) onPick?.(Number(g.dataset.i));
    });
  }

  #buildNodes() {
    return ROLES.map((role, i) => {
      const p = this.points[i];
      const g = svgEl('g', { class: 'map__node', 'data-i': String(i) });
      g.appendChild(svgEl('circle', { class: 'map__halo', cx: p.x, cy: p.y, r: NODE_R * 2.6 }));
      g.appendChild(svgEl('circle', { class: 'map__dot', cx: p.x, cy: p.y, r: NODE_R }));
      const out = 1.32;
      const tx = CX + Math.cos(p.a) * R * out;
      const ty = CY + Math.sin(p.a) * R * out + 4;
      const anchor = Math.abs(Math.cos(p.a)) < 0.2 ? 'middle' : Math.cos(p.a) > 0 ? 'start' : 'end';
      const label = svgEl('text', { class: 'map__label', x: tx, y: ty, 'text-anchor': anchor });
      label.textContent = role.short;
      g.appendChild(label);
      this.nodesG.appendChild(g);
      return g;
    });
  }

  #curve(a, b, sign) {
    const pa = this.points[a];
    const pb = this.points[b];
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const sx = pa.x + ux * (NODE_R + 4);
    const sy = pa.y + uy * (NODE_R + 4);
    const ex = pb.x - ux * (NODE_R + 6);
    const ey = pb.y - uy * (NODE_R + 6);
    const mx = (sx + ex) / 2 - uy * CURVE * sign;
    const my = (sy + ey) / 2 + ux * CURVE * sign;
    return `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  }

  #line(from, to, kind, delay) {
    const path = svgEl('path', {
      class: `map__line map__line--${kind}`,
      d: this.#curve(from, to, 1),
      pathLength: '1',
      'marker-end': `url(#aud-arrow-${kind})`,
    });
    path.style.animationDelay = `${delay}ms`;
    this.linesG.appendChild(path);
  }

  #list(el, items, empty) {
    el.replaceChildren();
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'flows__empty';
      li.textContent = empty;
      el.appendChild(li);
      return;
    }
    for (const f of items) {
      const li = document.createElement('li');
      const what = document.createElement('span');
      what.className = 'flows__what';
      what.textContent = f.what;
      const peer = document.createElement('span');
      peer.className = 'flows__peer';
      peer.textContent = f.peerName;
      li.append(what, peer);
      el.appendChild(li);
    }
  }

  select(i) {
    if (i === this.index) return;
    this.index = i;
    const role = ROLES[i];
    const idx = (id) => ROLES.findIndex((r) => r.id === id);
    const { give, draw } = flowsFor(role.id);

    this.linesG.replaceChildren();
    const out = give.flatMap((f) => f.peers.map(idx));
    out.forEach((to, k) => this.#line(i, to, 'give', k * 90));
    draw.forEach((f, k) => this.#line(idx(f.peer), i, 'draw', 240 + k * 90));

    const linked = new Set([...out, ...draw.map((f) => idx(f.peer))]);
    this.nodes.forEach((g, k) => {
      g.classList.toggle('is-active', k === i);
      g.classList.toggle('is-linked', linked.has(k));
    });

    this.nameEl.textContent = role.name;
    this.#list(this.giveEl, give, OPEN_ROLE_NOTE);
    this.#list(this.drawEl, draw, OPEN_ROLE_NOTE);
    this.#announce(role.name, give.length, draw.length);
  }

  /** Short polite summary for screen readers; skipped for the initial selection. */
  #announce(name, gives, draws) {
    if (!this.statusEl) return;
    if (!this.announced) { this.announced = true; return; }
    this.statusEl.textContent = `${name} selected. Provides ${gives}, draws on ${draws}.`;
  }
}
