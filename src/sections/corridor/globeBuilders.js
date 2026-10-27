import { CITIES, ROUTES, latLonToUnit, sampleArc } from './corridorData.js';
import { LAND, LAKES } from './landData.js';

const MASK_W = 512;
const MASK_H = 256;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const OCEAN_KEEP = 4;      // keep one ocean dot in N for a faint sphere body
const ARC_POINTS = 90;     // travelling dots per route
const ARC_SEGMENTS = 64;   // line segments per route

/** Rasterise the embedded outlines into a tiny equirectangular land mask (read once). */
function landMask() {
  const canvas = document.createElement('canvas');
  canvas.width = MASK_W;
  canvas.height = MASK_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const draw = (polys, color) => {
    ctx.fillStyle = color;
    for (const flat of polys) {
      ctx.beginPath();
      for (let i = 0; i < flat.length; i += 2) {
        const x = ((flat[i] + 180) / 360) * MASK_W;
        const y = ((90 - flat[i + 1]) / 180) * MASK_H;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  };
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, MASK_W, MASK_H);
  draw(LAND, '#fff');
  draw(LAKES, '#000');
  const data = ctx.getImageData(0, 0, MASK_W, MASK_H).data;
  return (lat, lon) => {
    const x = Math.min(MASK_W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * MASK_W)));
    const y = Math.min(MASK_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * MASK_H)));
    return data[(y * MASK_W + x) * 4] > 127;
  };
}

/** Fibonacci sphere, land dots kept, ocean thinned. */
export function buildDots(total) {
  const isLand = landMask();
  const pos = [];
  const land = [];
  const rand = [];
  for (let i = 0; i < total; i += 1) {
    const y = 1 - ((i + 0.5) / total) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = i * GOLDEN;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = (Math.atan2(-z, x) * 180) / Math.PI;
    const onLand = isLand(lat, lon);
    if (!onLand && i % OCEAN_KEEP !== 0) continue;
    pos.push(x, y, z);
    land.push(onLand ? 1 : 0);
    rand.push(Math.random());
  }
  return {
    position: new Float32Array(pos),
    land: new Float32Array(land),
    rand: new Float32Array(rand),
  };
}

/**
 * Arc lines (segments) and arc dots plus city markers, all with:
 * aGate (global reveal position), aT (0..1 along its route), aSeed (pulse phase), aKind (0 arc, 1 city).
 */
export function buildArcs() {
  const lineCount = ROUTES.length * ARC_SEGMENTS * 2;
  const cityKeys = Object.keys(CITIES);
  const dotCount = ROUTES.length * ARC_POINTS + cityKeys.length;
  const lines = alloc(lineCount);
  const dots = alloc(dotCount);
  const seg = new Float32Array((ARC_SEGMENTS + 1) * 3);
  const pts = new Float32Array(ARC_POINTS * 3);

  let li = 0;
  let di = 0;
  ROUTES.forEach(([from, to, gate, len], r) => {
    const seed = r * 0.137;
    sampleArc(CITIES[from], CITIES[to], ARC_SEGMENTS + 1, seg);
    for (let s = 0; s < ARC_SEGMENTS; s += 1) {
      for (let e = 0; e < 2; e += 1) {
        const k = s + e;
        const t = k / ARC_SEGMENTS;
        write(lines, li, seg, k * 3, gate + t * len, t, seed, 0);
        li += 1;
      }
    }
    sampleArc(CITIES[from], CITIES[to], ARC_POINTS, pts);
    for (let p = 0; p < ARC_POINTS; p += 1) {
      const t = p / (ARC_POINTS - 1);
      write(dots, di, pts, p * 3, gate + t * len, t, seed, 0);
      di += 1;
    }
  });

  const unit = new Float32Array(3);
  cityKeys.forEach((key, i) => {
    const c = CITIES[key];
    latLonToUnit(c.lat, c.lon, unit);
    unit[0] *= 1.006; unit[1] *= 1.006; unit[2] *= 1.006;
    const gate = key === 'milan' || key === 'rome' || key === 'manila' ? 0 : 0.5;
    write(dots, di, unit, 0, gate, 0, i * 0.21, 1);
    di += 1;
  });
  return { lines, dots };
}

function alloc(n) {
  return {
    position: new Float32Array(n * 3),
    gate: new Float32Array(n),
    t: new Float32Array(n),
    seed: new Float32Array(n),
    kind: new Float32Array(n),
  };
}

function write(buf, i, src, o, gate, t, seed, kind) {
  buf.position[i * 3] = src[o];
  buf.position[i * 3 + 1] = src[o + 1];
  buf.position[i * 3 + 2] = src[o + 2];
  buf.gate[i] = gate;
  buf.t[i] = t;
  buf.seed[i] = seed;
  buf.kind[i] = kind;
}
