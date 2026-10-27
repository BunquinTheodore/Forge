import { Device } from './Device.js';
import { Scroll, gsap, ScrollTrigger, byDocument } from './Scroll.js';

/** Section classes are discovered automatically: any src/sections/<id>/*Section.js file. */
const SECTION_MODULES = import.meta.glob('../sections/*/*Section.js', { eager: true });
const SPLASH_MODULES = import.meta.glob('../sections/splash/Splash.js', { eager: true });

/** Sections whose CSS is inlined in index.html (see vite.config.js): initialised before the splash. */
const CRITICAL_SECTIONS = new Set(['chrome', 'hero']);
const STYLE_TIMEOUT = 6000;        // ms: never wait longer than this for the async stylesheet
const GL_IDLE_HIGH = 1200;         // ms: idle timeout before the stage loads on desktop
const GL_IDLE_DEFERRED = 2000;     // ms: idle timeout once a deferred stage is allowed to load
const GL_DEFER_FALLBACK = 8000;    // ms after ready: load a deferred stage even without interaction
const INTERACTIONS = ['pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll'];
const FOLLOWING = 4;               // Node.DOCUMENT_POSITION_FOLLOWING

const idle = (timeout) => new Promise((r) => {
  if (window.requestIdleCallback) window.requestIdleCallback(() => r(), { timeout });
  else setTimeout(r, Math.min(timeout, 200));
});
/** Give the main thread back between long pieces of work (keeps boot out of one long task). */
const yieldToMain = () => (globalThis.scheduler?.yield
  ? globalThis.scheduler.yield()
  : new Promise((r) => setTimeout(r, 0)));
const windowLoaded = () => new Promise((r) => {
  if (document.readyState === 'complete') r();
  else window.addEventListener('load', () => r(), { once: true });
});

/**
 * Application root. Owns the device profile, smooth scroll, the section instances,
 * the single frame loop and the (lazily loaded) WebGL stage.
 *
 * Events (app.on / app.emit):
 *   'ready'   splash finished, page is interactive. Hero intro listens to this.
 *   'gl'      WebGL stage created (payload: stage)
 *   'gl-failed'  the stage could not start (html.no-gl has just been added). On desktop this happens during the splash;
 *             on other tiers only after 'ready' and the first interaction, so never assume order.
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
  #sectionsBuilt = Promise.resolve();

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
    gsap.ticker.add((time, deltaMs) => this.#tick(time, deltaMs / 1000));

    const entries = this.#sectionEntries();
    // Chrome and hero are styled by the inlined critical CSS: build them before the splash shows.
    this.#initSections(entries.filter((e) => CRITICAL_SECTIONS.has(e.SectionClass.id)));

    // Desktop builds the stage behind the splash. Elsewhere GL waits until after 'ready' so
    // three.js parsing and shader work stay out of the load window (see #deferStage).
    const eagerGL = this.device.tier === 'high';
    let built;
    this.#sectionsBuilt = new Promise((r) => { built = r; });
    const glJob = eagerGL ? this.#startStage(GL_IDLE_HIGH) : null;
    const splash = this.#createSplash();
    const splashJob = splash ? splash.play(glJob) : Promise.resolve();

    await this.#stylesReady();
    await this.#initSectionsChunked(entries.filter((e) => !CRITICAL_SECTIONS.has(e.SectionClass.id)));
    this.#observeSections();
    built();
    await Promise.all([splashJob, document.fonts?.ready]);

    this.scroll.start();
    ScrollTrigger.sort(byDocument);
    ScrollTrigger.refresh();
    this.isReady = true;
    document.documentElement.classList.add('is-ready');
    this.emit('ready');
    if (!eagerGL) this.#deferStage();
  }

  #createSplash() {
    const mod = Object.values(SPLASH_MODULES)[0];
    if (!mod?.default) return null;
    return new mod.default(this);
  }

  /** Section classes paired with their root element, in page (DOM) order. */
  #sectionEntries() {
    return Object.values(SECTION_MODULES)
      .map((m) => m.default)
      .filter(Boolean)
      .map((SectionClass) => ({ SectionClass, el: document.querySelector(`[data-section="${SectionClass.id}"]`) }))
      .filter(({ el }) => el)
      .sort((a, b) => (a.el.compareDocumentPosition(b.el) & FOLLOWING ? -1 : 1));
  }

  #initSections(entries) {
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

  /** One section per task, in page order, so boot never becomes one long main-thread task. */
  async #initSectionsChunked(entries) {
    for (const entry of entries) {
      await yieldToMain();
      this.#initSections([entry]);
    }
  }

  /** Resolve once the non-blocking stylesheet (link[data-async-css], build only) has applied. */
  #stylesReady() {
    const links = Array.from(document.querySelectorAll('link[data-async-css]'));
    return Promise.all(links.map((link) => new Promise((resolve) => {
      if (link.media !== 'print') { resolve(); return; }
      const done = () => { link.media = 'all'; resolve(); };
      link.addEventListener('load', done, { once: true });
      link.addEventListener('error', () => resolve(), { once: true });
      setTimeout(resolve, STYLE_TIMEOUT);
    })));
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

  /**
   * Off desktop, load the stage on the first interaction after 'ready' (or after a fallback
   * delay), once the page has loaded and the main thread is idle.
   */
  #deferStage() {
    if (!this.device.webgl || this.device.tier === 'low') return;
    let started = false;
    const controller = new AbortController();
    const go = () => {
      if (started) return;
      started = true;
      controller.abort();
      clearTimeout(timer);
      this.#startStage(GL_IDLE_DEFERRED);
    };
    const timer = setTimeout(go, GL_DEFER_FALLBACK);
    for (const type of INTERACTIONS) {
      window.addEventListener(type, go, { passive: true, once: true, signal: controller.signal });
    }
  }

  /** Load three.js and the stage after the window load event and an idle slot, so it never blocks LCP. */
  async #startStage(idleTimeout) {
    if (!this.device.webgl || this.device.tier === 'low') return null;
    // Acts read state their sections publish in init(), so every section must exist first.
    await Promise.all([windowLoaded(), this.#sectionsBuilt]);
    await idle(idleTimeout);
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
      this.stage?.dispose();
      this.stage = null;
      document.documentElement.classList.add('no-gl');
      this.emit('gl-failed');
      return null;
    }
  }

  #tick(time, dt) {
    const step = Math.min(dt, 0.1);
    for (const s of this.sections) if (s.visible) s.update(step, time);
    this.stage?.render(step);
  }
}
