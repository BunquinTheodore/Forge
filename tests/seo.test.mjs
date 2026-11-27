import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Search engine basics: what makes the site eligible to show up, and look right, when someone searches for it.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.forgeph.org';
const ICCPI_SITE = 'https://www.iccpi.org.ph/';
const PATHS = [
  '/',
  '/programme/',
  '/how-forge-works/',
  '/workshop-fd90/',
  '/international-forge/',
  '/partners/',
  '/privacy/',
  '/register/conference/',
  '/register/booth/',
  '/register/workshop/',
];
const ICONS = [
  { href: '/img/favicon-192.png', rel: 'icon', size: 192 },
  { href: '/img/apple-touch-icon.png', rel: 'apple-touch-icon', size: 180 },
];

const read = (path) => readFileSync(join(root, path), 'utf8');
const page = (path) => read(`${path.slice(1)}index.html`);
const attr = (tag, name) => tag?.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? [];
const meta = (html, key) => attr(tags(html, 'meta').find((t) => attr(t, 'name') === key || attr(t, 'property') === key), 'content');
const links = (html, rel) => tags(html, 'link').filter((t) => attr(t, 'rel') === rel);
const title = (html) => html.match(/<title>([^<]*)<\/title>/)?.[1];

/** Every JSON-LD node on a page, with @graph flattened. Throws on invalid JSON. */
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((m) => JSON.parse(m[1]))
  .flatMap((data) => data['@graph'] ?? [data]);
const node = (nodes, type) => nodes.find((n) => n['@type'] === type);

for (const path of PATHS) {
  test(`${path}: title, description and canonical`, () => {
    const html = page(path);
    const url = `${SITE}${path}`;
    const heading = title(html);
    const description = meta(html, 'description');

    assert.ok(heading?.includes('FORGE'), 'title should name FORGE');
    assert.ok(heading.length <= 65, `title is ${heading.length} characters, search results cut it off after about 65`);
    assert.ok(description, 'meta description is missing');
    assert.ok(description.length >= 70 && description.length <= 160, `description is ${description.length} characters, aim for 70 to 160`);
    assert.equal(attr(links(html, 'canonical')[0], 'href'), url);
    assert.equal(meta(html, 'og:url'), url);
    assert.equal(meta(html, 'og:site_name'), 'FORGE PH');
    assert.doesNotMatch(meta(html, 'robots') ?? '', /noindex|none/i, 'a sitemap page must be indexable');
  });
}

test('every built page is covered by these checks', () => {
  const list = read('vite.config.js').match(/const PAGES = \[([\s\S]*?)\];/)[1];
  const built = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== '404.html');
  assert.deepEqual(built.sort(), PATHS.map((p) => `${p.slice(1)}index.html`).sort());
});

test('titles and descriptions are unique', () => {
  const titles = PATHS.map((p) => title(page(p)));
  const descriptions = PATHS.map((p) => meta(page(p), 'description'));
  assert.equal(new Set(titles).size, PATHS.length, 'two pages share a title');
  assert.equal(new Set(descriptions).size, PATHS.length, 'two pages share a description');
});

test('the sitemap lists every page and robots.txt points at it', () => {
  const listed = [...read('public/sitemap.xml').matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(listed.sort(), PATHS.map((p) => `${SITE}${p}`).sort());
  const robots = read('public/robots.txt');
  assert.match(robots, new RegExp(`^Sitemap: ${SITE}/sitemap\\.xml\\s*$`, 'm'));
  assert.doesNotMatch(robots, /^Disallow: \/\s*$/m);
});

test('the error page stays out of search results', () => {
  assert.ok(meta(read('404.html'), 'robots')?.includes('noindex'));
});

for (const path of [...PATHS.map((p) => `${p.slice(1)}index.html`), '404.html']) {
  test(`${path}: declares the square site icons`, () => {
    const html = read(path);
    assert.ok(links(html, 'icon').some((t) => attr(t, 'href') === '/favicon.ico'), 'favicon.ico is not linked');
    for (const { href, rel } of ICONS) {
      assert.ok(links(html, rel).some((t) => attr(t, 'href') === href), `${href} is not linked as ${rel}`);
    }
  });
}

test('icon files are square and the declared size', async () => {
  for (const { href, size } of ICONS) {
    const info = await sharp(readFileSync(join(root, 'public', href))).metadata();
    assert.deepEqual([info.width, info.height], [size, size], `${href} has the wrong size`);
  }
});

test('the site icon is the FORGE wordmark on black with its orange PH', async () => {
  for (const { href, size } of ICONS) {
    const { data, info } = await sharp(readFileSync(join(root, 'public', href))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = (x, y) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) {
      assert.ok(pixel(x, y).every((c) => c < 32), `${href}: the corners should be the site's black, got ${pixel(x, y)}`);
    }
    let orangeBelow = 0;
    let lightAbove = 0;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const [r, g, b] = pixel(x, y);
        if (y >= size / 2 && r > 180 && g > 50 && g < 140 && b < 90) orangeBelow += 1;
        if (y < size / 2 && r > 150 && g > 150 && b > 150) lightAbove += 1;
      }
    }
    assert.ok(orangeBelow > size * size * 0.04, `${href}: the orange PH is missing from the lower half`);
    assert.ok(lightAbove > size * size * 0.04, `${href}: the FORGE letters are missing from the upper half`);
  }
});

test('favicon.ico exists and holds square 16, 32 and 48 pixel icons', () => {
  const file = join(root, 'public', 'favicon.ico');
  assert.ok(existsSync(file), 'public/favicon.ico is missing');
  const ico = readFileSync(file);
  assert.equal(ico.readUInt16LE(2), 1, 'not an icon file');
  const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => {
    const entry = 6 + i * 16;
    assert.equal(ico[entry], ico[entry + 1], 'icon entry is not square');
    const start = ico.readUInt32LE(entry + 12);
    assert.ok(start + ico.readUInt32LE(entry + 8) <= ico.length, 'icon entry runs past the end of the file');
    return ico[entry];
  });
  assert.deepEqual(sizes, [16, 32, 48]);
});

test('home page names the site for search engines', () => {
  const site = node(jsonLd(page('/')), 'WebSite');
  assert.ok(site, 'WebSite data is missing');
  assert.equal(site.url, `${SITE}/`);
  assert.equal(site.name, 'FORGE PH');
  assert.ok(site.alternateName.includes('forgeph.org'), 'the domain should be an alternate name');
});

test('home page links the event to ICCPI on its own website', () => {
  const nodes = jsonLd(page('/'));
  const org = node(nodes, 'Organization');
  const event = node(nodes, 'Event');
  assert.equal(org?.url, ICCPI_SITE);
  assert.ok(org.sameAs.length >= 1, 'official social profiles are missing');
  assert.equal(event.organizer['@id'], org['@id'], 'the event organiser should be the ICCPI record');
  assert.equal(node(nodes, 'WebSite').publisher['@id'], org['@id']);
  assert.equal(event.url, `${SITE}/`);
  assert.equal(event.startDate, '2027-01-27T10:00:00+08:00');
  assert.equal(event.endDate, '2027-01-27T18:00:00+08:00');
  assert.equal(event.offers.price, '5000');
  assert.equal(event.image, meta(page('/'), 'og:image'), 'the event image should match the link preview image');
});

for (const path of PATHS.filter((p) => p !== '/')) {
  test(`${path}: breadcrumb leads from the home page to this page`, () => {
    const items = node(jsonLd(page(path)), 'BreadcrumbList')?.itemListElement;
    assert.ok(items, 'BreadcrumbList data is missing');
    assert.deepEqual(items.map((i) => i.position), items.map((_, i) => i + 1));
    assert.equal(items[0].item, `${SITE}/`);
    assert.equal(items.at(-1).item, `${SITE}${path}`);
    assert.ok(items.every((i) => i.name), 'every breadcrumb needs a name');
  });
}

test('an address without the trailing slash redirects to the canonical one', () => {
  const { redirects } = JSON.parse(read('vercel.json'));
  assert.ok(!redirects.some((r) => PATHS.includes(r.source)), 'redirecting a canonical address would loop');
  for (const path of PATHS.filter((p) => p !== '/')) {
    const rule = redirects.find((r) => r.source === path.slice(0, -1) && !r.has);
    assert.equal(rule?.destination, path, `no redirect to ${path}`);
    assert.equal(rule.permanent, true);
  }
});

test('only the vercel.app copy of the site is kept out of search results', () => {
  const { headers } = JSON.parse(read('vercel.json'));
  const blocking = headers.filter((rule) => rule.headers.some(
    (h) => h.key.toLowerCase() === 'x-robots-tag' && /noindex|none/i.test(h.value),
  ));
  assert.equal(blocking.length, 1);
  assert.equal(blocking[0].source, '/(.*)', 'every address on the copy should be covered');
  const [condition] = blocking[0].has ?? [];
  assert.equal(condition?.type, 'host', 'an unconditional rule would hide the real site');
  const host = new RegExp(`^${condition.value}$`);
  assert.ok(host.test('forge-example.vercel.app'));
  assert.ok(!host.test('www.forgeph.org'), 'the real domain must stay indexable');
  assert.ok(!host.test('forgeph.org'), 'the real domain must stay indexable');
});
