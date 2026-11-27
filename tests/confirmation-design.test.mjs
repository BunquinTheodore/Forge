import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// The designed (HTML) confirmation email: brand colours, the real logo, and safe in mail apps.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = () => import('../api/_confirmationHtml.js');
const SAMPLE = { greeting: 'Hello Jane,', what: 'conference registration', reference: 'FORGE-ABCDEF12' };
const LOGO = 'https://www.forgeph.org/img/iccpi-email.png';
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');

const visibleText = (html) => html
  .replace(/<head[\s\S]*?<\/head>/, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#847;|&zwnj;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

test('the email states the registration, reference, date and venue', async () => {
  const { confirmationHtml } = await load();
  const text = visibleText(confirmationHtml(SAMPLE));
  for (const fact of ['Hello Jane,', 'conference registration', 'FORGE-ABCDEF12', '27 January 2027', '10:00 AM to 6:00 PM', 'WhiteSpace, Makati, Philippines', 'FORGE does not guarantee investment', 'info@iccpi.org.ph', 'f.calabretta@iccpi.org.ph']) {
    assert.ok(text.includes(fact), `missing "${fact}"`);
  }
});

test('it uses the FORGE black and orange and the official ICCPI logo', async () => {
  const { confirmationHtml } = await load();
  const html = confirmationHtml(SAMPLE);
  const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
  for (const name of ['ink', 'ember', 'cream']) {
    const colour = tokens.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))[1];
    assert.ok(html.toLowerCase().includes(colour), `the ${name} colour ${colour} is not used`);
  }
  assert.ok(html.includes(`src="${LOGO}"`));
  assert.match(html, /<img[^>]+alt="[^"]*Italian Chamber of Commerce[^"]*"/);
});

test('the buttons lead to the programme and the calendar file', async () => {
  const { confirmationHtml } = await load();
  const html = confirmationHtml(SAMPLE);
  assert.ok(html.includes('href="https://www.forgeph.org/programme/"'));
  assert.ok(html.includes('href="https://www.forgeph.org/forge-ph-2027.ics"'));
});

test('everything it loads or links to belongs to FORGE or ICCPI', async () => {
  const { confirmationHtml } = await load();
  const links = [...confirmationHtml(SAMPLE).matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const link of links) {
    assert.match(link, /^(https:\/\/www\.forgeph\.org\/|mailto:(info|f\.calabretta)@iccpi\.org\.ph)/, `unexpected address ${link}`);
  }
});

test('it holds up in mail apps: table layout, inline styles, no scripts or style sheets, small', async () => {
  const { confirmationHtml } = await load();
  const html = confirmationHtml(SAMPLE);
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<table[^>]+role="presentation"/);
  assert.doesNotMatch(html, /<script|<link|<style|display:\s*(flex|grid)/i);
  assert.ok(Buffer.byteLength(html) < 60 * 1024, 'Gmail clips long messages');
});

test('copy has no long dashes', async () => {
  const { confirmationHtml } = await load();
  assert.doesNotMatch(confirmationHtml(SAMPLE), DASHES);
});

test('anything inserted is escaped', async () => {
  const { confirmationHtml } = await load();
  const html = confirmationHtml({ greeting: 'Hello <img src=x onerror=1> D\'Angelo,', what: 'a"b&c', reference: '<x>' });
  assert.doesNotMatch(html, /<img src=x|<x>/);
  assert.ok(html.includes('D&#39;Angelo'));
  assert.ok(html.includes('a&quot;b&amp;c'));
});

test('the logo file for email is a small PNG, since some mail apps cannot show WebP', async () => {
  const file = join(root, 'public/img/iccpi-email.png');
  const info = await sharp(readFileSync(file)).metadata();
  assert.equal(info.format, 'png');
  assert.equal(info.width, 240, 'twice the 120 pixel display width');
  assert.ok(statSync(file).size < 60 * 1024);
});
