import './styles/index.css';
import.meta.glob('./sections/*/*.css', { eager: true });
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
