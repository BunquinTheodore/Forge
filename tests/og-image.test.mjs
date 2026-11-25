import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Every page must declare the same link preview image, and the file must really be there with the declared size.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.forgeph.org';
const SKIP = new Set(['node_modules', '.git', '.vercel', 'dist', '_source', 'docs', 'public', 'src', 'tests', 'api', 'scripts', 'shared']);
const MAX_SHARE_BYTES = 300 * 1024; // WhatsApp and some other apps drop larger preview images

function pages(dir = root) {
  const found = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...pages(full));
    else if (name.endsWith('.html')) found.push(full);
  }
  return found;
}

const meta = (html, attr, key) => {
  const tag = html.match(new RegExp(`<meta[^>]*${attr}="${key}"[^>]*>`));
  return tag?.[0].match(/content="([^"]*)"/)?.[1];
};

const list = pages();

test('the site has pages to check', () => {
  assert.ok(list.length >= 10, `expected the site pages, found ${list.length}`);
});

for (const file of list) {
  const label = file.slice(root.length + 1).replace(/\\/g, '/');

  test(`${label}: preview image tags match the real file`, async () => {
    const html = readFileSync(file, 'utf8');
    const image = meta(html, 'property', 'og:image');
    assert.ok(image, 'og:image is missing');
    assert.ok(image.startsWith(`${SITE}/img/`), `og:image should be an absolute ${SITE}/img/ URL, got ${image}`);

    const path = join(root, 'public', image.slice(SITE.length));
    assert.ok(existsSync(path), `og:image points at a file that does not exist: ${path}`);
    assert.ok(statSync(path).size <= MAX_SHARE_BYTES, `share image is larger than ${MAX_SHARE_BYTES / 1024} KB`);

    const info = await sharp(readFileSync(path)).metadata();
    assert.equal(String(info.width), meta(html, 'property', 'og:image:width'), 'og:image:width does not match the file');
    assert.equal(String(info.height), meta(html, 'property', 'og:image:height'), 'og:image:height does not match the file');
    assert.equal(`image/${info.format}`, meta(html, 'property', 'og:image:type').replace('jpg', 'jpeg'), 'og:image:type does not match the file');
    assert.ok(meta(html, 'property', 'og:image:alt'), 'og:image:alt is missing');
    assert.equal(meta(html, 'name', 'twitter:image'), image, 'twitter:image should match og:image');
    assert.ok(meta(html, 'name', 'twitter:image:alt'), 'twitter:image:alt is missing');
  });
}
