// Builds the white (single colour, transparent) ICCPI logo files from the official artwork.
// Source: scripts/iccpi-logo-src.png (colour logo on white). Run: node scripts/build-iccpi-logo.mjs
// Outputs in public/img: iccpi-white.webp (full lockup), iccpi-white-compact.webp (symbol + ICCPI only).
import sharp from 'sharp';

const SRC = 'scripts/iccpi-logo-src.png';
const OUT = 'public/img';
const SCALE = 3;          // upscale the soft edge, then re-sharpen it, so the logo stays crisp when shown large
const PAD = 6;            // transparent margin kept around each crop, in source pixels
const COMPACT_BOTTOM = 342; // last row of the ICCPI letters; the name lines sit below it

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;

// Ink coverage per pixel: how much of the pixel is ink rather than white paper. The distance from white is
// divided by the strongest ink colour nearby, so every brand colour (yellow, green, red, blue, black) comes out
// solid inside the shapes while edges and the thin white gaps between the arcs keep their true width.
const RADIUS = 2;
const NOISE_FLOOR = 14;
const MIN_PEAK = 90;
const depth = new Uint8Array(width * height);
for (let i = 0; i < width * height; i++) {
  depth[i] = Math.max(255 - data[i * 3], 255 - data[i * 3 + 1], 255 - data[i * 3 + 2]);
}
const ink = Buffer.alloc(width * height);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const here = depth[y * width + x];
    if (here <= NOISE_FLOOR) continue;
    let peak = MIN_PEAK;
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < height && xx >= 0 && xx < width) peak = Math.max(peak, depth[yy * width + xx]);
      }
    }
    ink[y * width + x] = Math.min(255, Math.round((here / peak) * 255));
  }
}

function bounds(maxRow) {
  let x0 = width, x1 = -1, y0 = height, y1 = -1;
  for (let y = 0; y <= Math.min(maxRow, height - 1); y++) {
    for (let x = 0; x < width; x++) {
      if (ink[y * width + x] > 60) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
  }
  return { left: Math.max(0, x0 - PAD), top: Math.max(0, y0 - PAD), width: x1 - x0 + 1 + PAD * 2, height: y1 - y0 + 1 + PAD * 2 };
}

async function write(name, box) {
  const alpha = await sharp(ink, { raw: { width, height, channels: 1 } })
    .extract(box)
    .resize(box.width * SCALE, box.height * SCALE, { kernel: 'lanczos3' })
    .linear(5, -5 * 128 + 128) // contrast around mid grey: crisp, anti-aliased edge
    .extractChannel(0)
    .raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = alpha.info;
  const white = Buffer.alloc(w * h * 3, 255);
  await sharp(white, { raw: { width: w, height: h, channels: 3 } })
    .joinChannel(alpha.data, { raw: { width: w, height: h, channels: 1 } })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(`${OUT}/${name}`);
  console.log(name, `${w}x${h}`, 'aspect', (w / h).toFixed(4));
}

await write('iccpi-white.webp', bounds(height));
await write('iccpi-white-compact.webp', bounds(COMPACT_BOTTOM));
