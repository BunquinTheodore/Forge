import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Section partials are plain HTML files owned by each section folder.
 * index.html references them with <!--@include id--> so the markup is
 * static (fast LCP, crawlable) while every section stays in its own file.
 */
function sectionPartials() {
  const INCLUDE = /<!--@include ([a-z0-9-]+)-->/g;
  const partialPath = (id) => resolve(__dirname, 'src/sections', id, `${id}.html`);
  return {
    name: 'forge-section-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(INCLUDE, (_, id) => {
          const file = partialPath(id);
          if (!existsSync(file)) return `<!-- missing partial: ${id} -->`;
          return readFileSync(file, 'utf8');
        });
      },
    },
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.html') && file.includes('sections')) server.ws.send({ type: 'full-reload' });
    },
  };
}

/**
 * Critical CSS: tokens, base and the above-the-fold sections (splash, chrome, hero) are inlined
 * into index.html at <!--@critical-css-->, so first paint never waits on the network.
 * main.js excludes these files from its CSS glob. Keep CRITICAL_SECTIONS in sync with
 * App.js (CRITICAL_SECTIONS) and main.js (the glob exclusions).
 */
const CRITICAL_SECTIONS = ['splash', 'chrome', 'hero'];
const CRITICAL_FILES = [
  'src/styles/tokens.css',
  'src/styles/base.css',
  ...CRITICAL_SECTIONS.map((id) => `src/sections/${id}/${id}.css`),
].map((f) => resolve(__dirname, f));
// lightningcss version targets (major << 16), matching the es2020 build target.
const CSS_TARGETS = { chrome: 87 << 16, edge: 88 << 16, firefox: 78 << 16, safari: 14 << 16 };

async function minifyCss(code) {
  try {
    const { transform } = await import('lightningcss');
    const out = transform({ filename: 'critical.css', code: Buffer.from(code), minify: true, targets: CSS_TARGETS });
    return out.code.toString();
  } catch (err) {
    console.warn('[critical-css] minify skipped:', err.message);
    return code;
  }
}

function criticalCss() {
  let isBuild = false;
  return {
    name: 'forge-critical-css',
    configResolved(config) { isBuild = config.command === 'build'; },
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        const raw = CRITICAL_FILES.filter(existsSync).map((f) => readFileSync(f, 'utf8')).join('\n');
        const css = isBuild ? await minifyCss(raw) : raw;
        return html.replace('<!--@critical-css-->', `<style data-critical>${css}</style>`);
      },
    },
    handleHotUpdate({ file, server }) {
      if (CRITICAL_FILES.includes(resolve(file))) server.ws.send({ type: 'full-reload' });
    },
  };
}

/**
 * The bundled (below-the-fold) stylesheet is loaded without blocking render: preloaded at high
 * priority, applied on load. App waits for link[data-async-css] before initialising those sections.
 */
function asyncStylesheet() {
  const LINK = /<link rel="stylesheet"( crossorigin)? href="([^"]+\.css)">/g;
  return {
    name: 'forge-async-css',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(LINK, (_, co = '', href) => [
          `<link rel="preload" as="style"${co} href="${href}">`,
          `<link rel="stylesheet"${co} href="${href}" media="print" data-async-css onload="this.media='all'">`,
          `<noscript><link rel="stylesheet"${co} href="${href}"></noscript>`,
        ].join(''));
      },
    },
  };
}

export default defineConfig({
  plugins: [sectionPartials(), criticalCss(), asyncStylesheet()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 2048,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'motion';
        },
      },
    },
  },
});
