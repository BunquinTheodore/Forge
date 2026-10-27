import { Device } from './Device.js';
import { Scroll, gsap, ScrollTrigger } from './Scroll.js';

/** Section classes are discovered automatically: any src/sections/<id>/*Section.js file. */
const SECTION_MODULES = import.meta.glob('../sections/*/*Section.js', { eager: true });
const SPLASH_MODULES = import.meta.glob('../sections/splash/Splash.js', { eager: true });

/**
 * Application root. Owns the device profile, smooth scroll, the section instances,
 * the single frame loop and the (lazily loaded) WebGL stage.
 *
 * Events (app.on / app.emit):
 *   'ready'   splash finished, page is interactive. Hero intro listens to this.
 *   'gl'      WebGL stage created (payload: stage)
 */
export class App {
  constructor() {
    this.device = new Device();
    this.scroll = new Scroll(this.device);
    this.sections = [];
    this.stage = null;
    this.isReady = false;
    this.#events = new Map();

    document.documentElement.classList.add(`tier-${this.device.tier}`);
    if (this.device.reducedMotion) document.documentElement.classList.add('reduced-motion');
    // Low tier never creates the stage, so it gets the same CSS fallbacks as no WebGL.
    if (!this.device.webgl || this.device.tier === 'low') document.documentElement.classList.add('no-gl');
  }

  #events;

  on(name, fn) {
    if (name === 'ready' && this.isReady) { fn(); return; }
    if (!this.#events.has(name)) this.#events.set(name, new Set());
    this.#events.get(name).add(fn);
  }

  emit(name, payload) {
    this.#events.get(name)?.forEach((fn) => fn(payload));
  }

  async start() {
    this.scroll.stop();
    this.#createSections();
    this.#observeSections();
    gsap.ticker.add((time, deltaMs) => this.#tick(time, deltaMs / 1000));

    const splash = this.#createSplash();
    const glJob = this.#startStage();
    await Promise.all([splash ? splash.play(glJob) : Promise.resolve(), document.fonts?.ready]);

    this.scroll.start();
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    this.isReady = true;
    document.documentElement.classList.add('is-ready');
    this.emit('ready');
  }

  #createSplash() {
    const mod = Object.values(SPLASH_MODULES)[0];
    if (!mod?.default) return null;
    return new mod.default(this);
  }

  #createSections() {
    // Create sections in page (DOM) order, not glob order, so pins higher on the page
    // exist before the triggers below them compute their start positions.
    const entries = Object.values(SECTION_MODULES)
      .map((m) => m.default)
      .filter(Boolean)
      .map((SectionClass) => ({ SectionClass, el: document.querySelector(`[data-section="${SectionClass.id}"]`) }))
      .filter(({ el }) => el)
      .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    for (const { SectionClass, el } of entries) {
      try {
        const section = new SectionClass(this, el);
        section.init();
        this.sections.push(section);
      } catch (err) {
        console.error(`[App] section "${SectionClass.id}" failed to init`, err);
      }
    }
  }

  #observeSections() {
    const byEl = new Map(this.sections.map((s) => [s.el, s]));
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const section = byEl.get(entry.target);
        if (!section || section.visible === entry.isIntersecting) continue;
        section.visible = entry.isIntersecting;
        if (section.visible) section.onEnter();
        else section.onLeave();
      }
    }, { rootMargin: '10% 0px 10% 0px' });
    byEl.forEach((_, el) => io.observe(el));
  }

  /** Load three.js and the stage after first paint so it never blocks LCP. */
  async #startStage() {
    if (!this.device.webgl || this.device.tier === 'low') return null;
    await new Promise((r) => (window.requestIdleCallback || setTimeout)(r, { timeout: 600 }));
    try {
      const { Stage } = await import('../gl/Stage.js');
      const canvas = document.getElementById('gl');
      this.stage = new Stage(this, canvas);
      await this.stage.warmup();
      canvas.classList.add('is-ready');
      this.emit('gl', this.stage);
      return this.stage;
    } catch (err) {
      console.error('[App] WebGL stage unavailable, continuing without it', err);
      document.documentElement.classList.add('no-gl');
      return null;
    }
  }

  #tick(time, dt) {
    const step = Math.min(dt, 0.1);
    for (const s of this.sections) if (s.visible) s.update(step, time);
    this.stage?.render(step);
  }
}
