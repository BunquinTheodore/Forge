import { defineConfig, loadEnv } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Section partials are plain HTML files owned by each section folder.
 * index.html references them with <!--@include id--> so the markup is
 * static (fast LCP, crawlable) while every section stays in its own file.
 */
function sectionPartials() {
  // <!--@include id-->  loads src/sections/<id>/<id>.html
  // <!--@include dir/name-->  loads src/sections/<dir>/<name>.html (extra partials owned by one section)
  const INCLUDE = /<!--@include ([a-z0-9-]+)(?:\/([a-z0-9-]+))?-->/g;
  const MAX_DEPTH = 4;
  const partialPath = (dir, name) => resolve(__dirname, 'src/sections', dir, `${name || dir}.html`);
  const expand = (html, depth = 0) => html.replace(INCLUDE, (_, dir, name) => {
    const file = partialPath(dir, name);
    if (!existsSync(file)) return `<!-- missing partial: ${dir}${name ? `/${name}` : ''} -->`;
    const body = readFileSync(file, 'utf8');
    return depth < MAX_DEPTH ? expand(body, depth + 1) : body;
  });
  return {
    name: 'forge-section-partials',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => expand(html),
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
const CRITICAL_SECTIONS = ['splash', 'chrome', 'hero', 'pagehead', 'partners'];
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

/**
 * Dev only: serve the Vercel function api/register.js at /api/register so the registration forms
 * can be exercised end to end locally. In production Vercel runs the same file.
 */
function devApi() {
  return {
    name: 'forge-dev-api',
    apply: 'serve',
    configureServer(server) {
      // Vite keeps .env values out of process.env: expose them to the function exactly as Vercel would.
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));
      server.middlewares.use('/api/register', async (req, res) => {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString('utf8');
        try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = undefined; }
        Object.assign(res, {
          status(code) { res.statusCode = code; return res; },
          json(obj) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return res; },
        });
        try {
          const mod = await server.ssrLoadModule('/api/register.js');
          await mod.default(req, res);
        } catch (err) {
          server.config.logger.error(`[dev-api] ${err.message}`);
          if (!res.writableEnded) res.status(500).json({ ok: false, code: 'server' });
        }
      });
    },
  };
}

/** Every page of the site. Each folder is a static page (clean URL with a trailing slash). */
const PAGES = [
  'index.html',
  'programme/index.html',
  'how-forge-works/index.html',
  'workshop-fd90/index.html',
  'international-forge/index.html',
  'partners/index.html',
  'register/conference/index.html',
  'register/booth/index.html',
  'register/workshop/index.html',
];

export default defineConfig({
  plugins: [sectionPartials(), criticalCss(), asyncStylesheet(), devApi()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 2048,
    rollupOptions: {
      input: Object.fromEntries(PAGES.map((p) => [p.replace(/\/?index\.html$/, '').replace(/\//g, '-') || 'index', resolve(__dirname, p)])),
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'motion';
        },
      },
    },
  },
});
