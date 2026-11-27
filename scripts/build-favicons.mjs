// Square site icons for browser tabs, phones and search results: FORGE above its orange PH, on the site's black.
// Source: scripts/forge-wordmark-src.png, the website's own FORGE PH 2027 wordmark (transparent, 1600 pixels wide).
// Run: node scripts/build-favicons.mjs
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const SRC = 'scripts/forge-wordmark-src.png';
const INK = '#080b0e';
const MASTER = 192;
const EDGE = 2; // source pixels kept around each part so letter edges stay smooth
const SOLID_ALPHA = 150; // anything fainter is the soft glow, which would show as a box once cut out
// Where each part sits in the source, then its width and top on the master. Narrow enough to survive a round crop.
const PARTS = [
  { box: { left: 70, top: 59, width: 1284, height: 204 }, width: 158, top: 54 }, // FORGE
  { box: { left: 1378, top: 59, width: 125, height: 53 }, width: 112, top: 91 }, // PH
];
const PNG_ICONS = [
  { file: 'public/img/favicon-192.png', size: 192 }, // search results need a square multiple of 48
  { file: 'public/img/apple-touch-icon.png', size: 180 },
];
const ICO_SIZES = [16, 32, 48];
const ICO_HEADER = 6;
const ICO_ENTRY = 16;

/** One part of the wordmark without its glow, scaled and centred, ready to place on the master. */
async function layer({ box, width, top }) {
  const scale = width / box.width;
  const crop = { left: box.left - EDGE, top: box.top - EDGE, width: box.width + 2 * EDGE, height: box.height + 2 * EDGE };
  const { data, info } = await sharp(SRC).extract(crop).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const letters = Buffer.from(data.map((value, i) => (i % 4 === 3 && value < SOLID_ALPHA ? 0 : value)));
  const input = await sharp(letters, { raw: info })
    .resize(Math.round(crop.width * scale), Math.round(crop.height * scale), { kernel: 'lanczos3' })
    .png()
    .toBuffer();
  return { input, left: Math.round((MASTER - crop.width * scale) / 2), top: Math.round(top - EDGE * scale) };
}

const master = await sharp({ create: { width: MASTER, height: MASTER, channels: 4, background: INK } })
  .composite(await Promise.all(PARTS.map(layer)))
  .png()
  .toBuffer();

const square = (size) => sharp(master)
  .resize(size, size, { kernel: 'lanczos3' })
  .ensureAlpha()
  .png({ compressionLevel: 9 })
  .toBuffer();

/** An .ico file is a small directory followed by the images, which may be PNGs. */
function ico(images) {
  const head = Buffer.alloc(ICO_HEADER + images.length * ICO_ENTRY);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, png }, i) => {
    const at = ICO_HEADER + i * ICO_ENTRY;
    head.writeUInt8(size, at);
    head.writeUInt8(size, at + 1);
    head.writeUInt16LE(1, at + 4); // colour planes
    head.writeUInt16LE(32, at + 6); // bits per pixel
    head.writeUInt32LE(png.length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...images.map(({ png }) => png)]);
}

for (const { file, size } of PNG_ICONS) await writeFile(file, await square(size));
const images = await Promise.all(ICO_SIZES.map(async (size) => ({ size, png: await square(size) })));
await writeFile('public/favicon.ico', ico(images));
console.log('site icons written:', [...PNG_ICONS.map((i) => i.file), 'public/favicon.ico'].join(', '));
