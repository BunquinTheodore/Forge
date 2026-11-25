// Builds the ICCPI logo tiles from the official colour artwork, untouched and on white.
// Source: scripts/iccpi-logo-src.png (colour logo on white). Run: node scripts/build-iccpi-logo.mjs
// Outputs in public/img: iccpi-color.webp (full lockup), iccpi-color-compact.webp (symbol + ICCPI only).
// Each file is the artwork trimmed to its ink plus an even white margin, so the image is its own white tile:
// the site only adds rounded corners. The artwork is enlarged 2x (lanczos) so it stays crisp on high density screens.
import sharp from 'sharp';

const SRC = 'scripts/iccpi-logo-src.png';
const OUT = 'public/img';
const SCALE = 2;
const MARGIN = 24;          // white margin around the logo, in source pixels (the tile padding)
const COMPACT_BOTTOM = 342; // last row of the ICCPI letters; the name lines sit below it
const INK_BELOW = 235;      // a pixel with any channel darker than this counts as logo, not paper

const flat = () => sharp(SRC).flatten({ background: '#ffffff' }).toColourspace('srgb');
const { data, info } = await flat().removeAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.channels !== 3) throw new Error(`${SRC}: expected 3 colour channels after conversion, got ${info.channels}`);
const { width, height } = info;

function inkBounds(maxRow) {
  let x0 = width, x1 = -1, y0 = height, y1 = -1;
  for (let y = 0; y <= Math.min(maxRow, height - 1); y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      if (Math.min(data[i], data[i + 1], data[i + 2]) < INK_BELOW) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) throw new Error(`${SRC}: no logo pixels found (everything is lighter than ${INK_BELOW}); is the artwork blank?`);
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

async function write(name, box) {
  const pad = MARGIN * SCALE;
  const file = `${OUT}/${name}`;
  await flat()
    .extract(box)
    .resize(box.width * SCALE, box.height * SCALE, { kernel: 'lanczos3' })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#ffffff' })
    .webp({ quality: 92, smartSubsample: true, effort: 6 }) // flat colour art: smartSubsample keeps the red and blue edges clean
    .toFile(file);
  const m = await sharp(file).metadata();
  console.log(name, `${m.width}x${m.height}`, 'aspect', (m.width / m.height).toFixed(4));
}

await write('iccpi-color.webp', inkBounds(height));
await write('iccpi-color-compact.webp', inkBounds(COMPACT_BOTTOM));
