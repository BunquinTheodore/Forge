// tokens, base and the splash/chrome/hero CSS are inlined into index.html (vite.config.js criticalCss),
// so they are excluded here. Every other section stylesheet is bundled and loaded without blocking paint.
import.meta.glob([
  './sections/*/*.css',
  '!./sections/splash/*.css',
  '!./sections/chrome/*.css',
  '!./sections/hero/*.css',
], { eager: true });
import { App } from './core/App.js';
import { ScrollTrigger } from './core/Scroll.js';

// The page is a scroll-driven film that starts with a splash: always begin at the top so
// every scrubbed scene and pin is built from a known scroll position.
// ScrollTrigger owns history.scrollRestoration, so set it through its API.
ScrollTrigger.clearScrollMemory('manual');
if (!location.hash) window.scrollTo(0, 0);

const app = new App();
app.start();

if (import.meta.env.DEV) window.__forge = app;
