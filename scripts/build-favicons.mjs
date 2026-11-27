// Square site icons for browser tabs, phones and search results, from the official colour ICCPI artwork on white.
// Source: public/img/iccpi-color-compact.webp (symbol + ICCPI, built by build-iccpi-logo.mjs).
// Run: node scripts/build-favicons.mjs
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const SRC = 'public/img/iccpi-color-compact.webp';
const PNG_ICONS = [
  { file: 'public/img/favicon-192.png', size: 192 }, // search results need a square multiple of 48
  { file: 'public/img/apple-touch-icon.png', size: 180 },
];
const ICO_SIZES = [16, 32, 48];
const ICO_HEADER = 6;
const ICO_ENTRY = 16;

const square = (size) => sharp(SRC)
  .resize(size, size, { fit: 'contain', background: '#ffffff', kernel: 'lanczos3' })
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
