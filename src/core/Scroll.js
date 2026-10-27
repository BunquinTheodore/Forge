import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth scroll (Lenis) synchronised with GSAP ScrollTrigger.
 * Exposes scroll position, velocity and progress for the GL stage and sections.
 */
export class Scroll {
  constructor(device) {
    this.device = device;
    this.y = window.scrollY;
    this.velocity = 0;
    this.progress = 0;
    this.lenis = null;
    this.#listeners = new Set();

    if (!device.reducedMotion) {
      this.lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
      this.lenis.on('scroll', (l) => this.#onScroll(l.scroll, l.velocity, l.progress));
      gsap.ticker.add((time) => this.lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
      this.lenis.on('scroll', ScrollTrigger.update);
    } else {
      window.addEventListener('scroll', () => this.#onNativeScroll(), { passive: true });
    }
  }

  #listeners;

  #onNativeScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const y = window.scrollY;
    this.#onScroll(y, y - this.y, max > 0 ? y / max : 0);
  }

  #onScroll(y, velocity, progress) {
    this.y = y;
    this.velocity = velocity;
    this.progress = progress;
    this.#listeners.forEach((fn) => fn(this));
  }

  onScroll(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  stop() { this.lenis?.stop(); document.documentElement.classList.add('is-locked'); }
  start() { this.lenis?.start(); document.documentElement.classList.remove('is-locked'); }

  /** Scroll to an element or selector. Respects reduced motion. */
  to(target, opts = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    if (this.lenis) this.lenis.scrollTo(el, { offset: 0, duration: 1.6, ...opts });
    else el.scrollIntoView({ behavior: 'auto' });
  }
}

export { gsap, ScrollTrigger };
