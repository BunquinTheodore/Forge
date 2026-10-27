const TAU = Math.PI * 2;
const SPARKS_PER_LINK = 3;

/** Reads brand colours from the CSS tokens once, so the canvas never hardcodes a palette. */
function readTokens() {
  const css = getComputedStyle(document.documentElement);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    ember: v('--ember', 'orange'),
    glow: v('--ember-glow', 'orange'),
    hot: v('--ember-hot', 'orange'),
    cream: v('--cream', 'white'),
    fog: v('--fog', 'gray'),
    mute: v('--mute', 'gray'),
    ink: v('--ink', 'black'),
    ink2: v('--ink-2', 'black'),
    ink3: v('--ink-3', 'black'),
    steel: v('--steel-2', 'gray'),
  };
}

/**
 * Stateless-ish 2D painter for the configuration graph.
 * All styles are assigned from cached strings; no objects are created per frame.
 */
export class GraphPainter {
  constructor(ctx) {
    this.ctx = ctx;
    this.c = readTokens();
    this.labelFont = '600 12px sans-serif';
    this.coreFont = '700 13px sans-serif';
  }

  setScale(m) {
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || 'sans-serif';
    const label = Math.round(Math.max(11, Math.min(15, m * 0.03)));
    this.labelFont = `650 ${label}px ${family}`;
    this.coreFont = `800 ${label + 1}px ${family}`;
  }

  clear(w, h) {
    this.ctx.clearRect(0, 0, w, h);
  }

  /** Dashed docking orbit around the startup. */
  orbit(g, t, spin) {
    const { ctx, c } = this;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = c.steel;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 9]);
    ctx.lineDashOffset = -t * 12 * spin;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.slotR, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.setLineDash([1, 14]);
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.slotR * 1.55, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /** Link from the core to a node, brighter as it approaches. */
  link(g, n, t, motion) {
    if (n.link < 0.02) return;
    const { ctx, c } = this;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = c.ember;
    ctx.globalAlpha = n.link * 0.22;
    ctx.lineWidth = 9;
    this.#segment(g.cx, g.cy, n.x, n.y);
    ctx.strokeStyle = c.glow;
    ctx.globalAlpha = Math.min(1, n.link * 1.1);
    ctx.lineWidth = n.connected ? 2 : 1.2;
    this.#segment(g.cx, g.cy, n.x, n.y);
    if (n.connected && motion) this.#sparks(g, n, t);
    ctx.restore();
  }

  #segment(x1, y1, x2, y2) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  #sparks(g, n, t) {
    const { ctx, c } = this;
    ctx.fillStyle = c.cream;
    for (let k = 0; k < SPARKS_PER_LINK; k += 1) {
      const f = (t * 0.55 + k / SPARKS_PER_LINK + n.seed) % 1;
      const x = n.x + (g.cx - n.x) * f;
      const y = n.y + (g.cy - n.y) * f;
      ctx.globalAlpha = Math.sin(f * Math.PI) * 0.9;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, TAU);
      ctx.fill();
    }
  }

  /** The startup at the centre. heat 0..1 = how many parts are connected. */
  core(g, heat, pulse) {
    const { ctx, c } = this;
    const r = g.coreR;
    ctx.save();
    if (heat > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.08 + heat * 0.18;
      ctx.fillStyle = c.ember;
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, r * (1.3 + heat * 0.35), 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (pulse > 0) {
      ctx.globalAlpha = (1 - pulse) * 0.8;
      ctx.strokeStyle = c.glow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, r + pulse * g.slotR * 1.4, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = heat >= 1 ? c.ember : c.ink2;
    ctx.strokeStyle = c.ember;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = heat >= 1 ? c.ink : c.cream;
    ctx.font = this.coreFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STARTUP', g.cx, g.cy);
    ctx.restore();
  }

  /** A draggable configuration part. */
  node(g, n, focus) {
    const { ctx, c } = this;
    const r = g.nodeR * (1 + n.lift * 0.12);
    ctx.save();
    if (n.link > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = n.link * 0.22;
      ctx.fillStyle = c.ember;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 1.5, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = n.connected ? c.hot : c.ink3;
    ctx.strokeStyle = n.connected || focus ? c.glow : c.steel;
    ctx.lineWidth = focus ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = n.connected ? c.ink : c.glow;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r * 0.22, 0, TAU);
    ctx.fill();
    this.#label(g, n, r);
    ctx.restore();
  }

  #label(g, n, r) {
    const { ctx, c } = this;
    const below = n.y >= g.cy - g.nodeR;
    ctx.font = this.labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = below ? 'top' : 'bottom';
    ctx.fillStyle = n.connected ? c.cream : c.fog;
    ctx.fillText(n.label, n.x, below ? n.y + r + 8 : n.y - r - 8);
  }
}
