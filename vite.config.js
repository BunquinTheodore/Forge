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

export default defineConfig({
  plugins: [sectionPartials()],
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
