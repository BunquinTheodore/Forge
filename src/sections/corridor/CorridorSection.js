import { BaseSection, gsap, ScrollTrigger } from '../../core/BaseSection.js';
import { REGIONS } from './corridorData.js';
import { corridorState } from './corridorState.js';
import { GlobeController } from './GlobeController.js';
import { GlobeDrag } from './GlobeDrag.js';
import { CorridorMap } from './CorridorMap.js';
import { GlobeGeometry } from './GlobeGeometry.js';

const PIN_QUERY = '(min-width: 960px) and (min-height: 640px)';
const VIEW_H_AT_ORIGIN = 2 * Math.tan((17.5 * Math.PI) / 180) * 10; // shared camera: fov 35, z 10
const CAMERA_Z = 10;
const GLOBE_FILL = 0.92;
const BANDS = [0.33, 0.6];

const formatLat = (v) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? 'N' : 'S'}`;
const formatLon = (v) => {
  const w = ((v + 540) % 360) - 180;
  return `${Math.abs(w).toFixed(1)}° ${w >= 0 ? 'E' : 'W'}`;
};

export default class CorridorSection extends BaseSection {
  static id = 'corridor';

  init() {
    this.globe = this.$('[data-globe-anchor]');
    this.tabs = this.$$('.corridor__tab');
    this.panels = this.$$('.corridor__panel');
    this.hudLat = this.$('[data-hud="lat"]');
    this.hudLon = this.$('[data-hud="lon"]');
    this.controller = new GlobeController(this.reducedMotion);
    this.map = new CorridorMap(this.$('.corridor__map'));
    this.drag = new GlobeDrag(this, this.globe, this.controller);
    this.regionsEl = this.$('.corridor__regions');
    this.geo = new GlobeGeometry(this.globe, this.$('.corridor__pin'), this.$('.corridor__track'));
    corridorState.geo = this.geo;
    this.regionIndex = 0;
    this.scrollBand = 0;
    this.userPicked = false;
    this.last = { lon: NaN, lat: NaN, reveal: NaN, gl: false };

    this.#bindTabs();
    this.#measure();
    this.onRefresh = () => this.#measure();
    this.listen(window, 'resize', this.onRefresh);
    ScrollTrigger.addEventListener('refresh', this.onRefresh);
    // Content above can shift (fonts, lazy media): re-measure when the page height changes.
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(this.onRefresh);
      this.ro.observe(document.body);
    }

    this.controller.update(1);
    this.map.render(corridorState.lon, corridorState.lat, corridorState.reveal);
    this.gsap(() => this.#scrollWork());
  }

  /* Tabs: click, arrow keys, Home and End. */
  #bindTabs() {
    this.tabs.forEach((tab, i) => {
      this.listen(tab, 'click', () => {
        this.userPicked = true;
        this.setRegion(i, { animate: true });
      });
    });
    const list = this.$('.corridor__tabs');
    this.listen(list, 'keydown', (e) => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      let next = null;
      if (e.key in keys) next = (this.regionIndex + keys[e.key] + REGIONS.length) % REGIONS.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = REGIONS.length - 1;
      if (next === null) return;
      e.preventDefault();
      this.userPicked = true;
      this.setRegion(next, { animate: true });
      this.tabs[next].focus();
    }, { passive: false });
  }

  setRegion(index, { animate = false } = {}) {
    if (index === this.regionIndex) return;
    this.regionIndex = index;
    const id = REGIONS[index].id;
    this.el.dataset.region = id;
    this.controller.setRegion(index);
    this.tabs.forEach((t, i) => {
      const on = i === index;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    this.panels.forEach((p, i) => { p.hidden = i !== index; });
    if (animate && !this.reducedMotion) {
      const chips = this.panels[index].querySelectorAll('li');
      gsap.fromTo(chips, { yPercent: 70, opacity: 0 }, {
        yPercent: 0, opacity: 1, duration: 0.6, ease: 'expo.out', stagger: 0.045, overwrite: true,
      });
    }
  }

  /** Layout reads live here only (resize and refresh), never in update(). */
  #measure() {
    if (!this.globe) return;
    this.geo.measure();
    const w = this.geo.rect.width;
    const rWorld = ((w * 0.5 * GLOBE_FILL) / this.geo.vh) * VIEW_H_AT_ORIGIN;
    this.perspGL = rWorld / CAMERA_Z;
    this.last.lon = NaN;
  }

  #scrollWork() {
    ScrollTrigger.create({
      trigger: this.el,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => this.controller.setProgress(self.progress),
      // A visitor's own tab choice holds until they leave the section.
      onLeave: () => { this.userPicked = false; },
      onLeaveBack: () => { this.userPicked = false; },
      onToggle: (self) => this.el.classList.toggle('is-visible', self.isActive),
    });

    this.mm = gsap.matchMedia();
    this.mm.add({ pin: `${PIN_QUERY} and (prefers-reduced-motion: no-preference)`, flow: `not all and ${PIN_QUERY}`, reduced: '(prefers-reduced-motion: reduce)' }, (ctx) => {
      const { pin, reduced } = ctx.conditions;
      if (reduced) return;
      this.#regionBands(pin);
      this.#entrance(pin);
      this.#background();
    });
  }

  /**
   * Scroll walks the corridor: Europe, Philippines, ASEAN. Never overrides the visitor: while
   * focus is inside the region controls, or after they chose a tab (until they leave the
   * section), scroll stops driving the selection. Off under reduced motion.
   */
  #regionBands(pin) {
    ScrollTrigger.create({
      trigger: this.$('.corridor__track'),
      start: pin ? 'top top' : 'top 45%',
      end: pin ? 'bottom bottom' : 'bottom 75%',
      onUpdate: (self) => {
        const p = self.progress;
        const band = p < BANDS[0] ? 0 : p < BANDS[1] ? 1 : 2;
        if (band === this.scrollBand) return;
        this.scrollBand = band;
        if (this.userPicked || this.regionsEl?.contains(document.activeElement)) return;
        this.setRegion(band, { animate: true });
      },
    });
  }

  /** Entrance: a horizontal scan. Title lines slide out of their masks behind an ember scan bar. */
  #entrance(pin) {
    const lines = this.$$('.corridor__title .line > span');
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: pin ? this.el : this.$('.corridor__head'),
        start: pin ? 'top 80%' : 'top 85%',
        end: pin ? 'top top' : 'top 30%',
        scrub: 0.6,
      },
    });
    tl.fromTo(this.$('.corridor__scan'), { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0)
      .fromTo(lines, { xPercent: -104 }, { xPercent: 0, duration: 0.8, stagger: 0.18 }, 0.05)
      .fromTo(this.$('.corridor__lead'), { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.4 }, 0.55)
      .fromTo(this.tabs, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.08 }, 0.6)
      .fromTo(this.$('.corridor__map'), { scale: 0.7, opacity: 0, rotate: -12 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.9 }, 0);

    const thesis = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: pin ? this.$('.corridor__track') : this.$('.corridor__thesis'),
        start: pin ? '84% bottom' : 'top 90%',
        end: pin ? '96% bottom' : 'top 55%',
        scrub: 0.6,
      },
    });
    // Pinned: the closing claim takes over the region controls' place at the end of the walk.
    if (pin) thesis.to(this.$('.corridor__regions'), { autoAlpha: 0, y: -30, duration: 0.5 }, 0);
    thesis.fromTo(this.$$('.corridor__thesis > *'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, stagger: 0.12, duration: 0.6 }, pin ? 0.3 : 0);
  }

  /** Background: latitude bands drift against the scroll and slowly converge. */
  #background() {
    gsap.fromTo(this.$('.corridor__lat'), { yPercent: -18, scaleY: 1.35 }, {
      yPercent: 18, scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: this.el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }

  update(dt) {
    this.controller.update(dt);
    const s = corridorState;
    const gl = s.glActive;
    const last = this.last;
    const moved = gl || Math.abs(s.lon - last.lon) > 0.03 || Math.abs(s.lat - last.lat) > 0.03;
    const revealed = Math.abs(s.reveal - last.reveal) > 0.004;
    if (!moved && !revealed && gl === last.gl) return;

    if (gl) {
      this.#offAxis();
      this.map.setPerspective(this.perspGL, this.ox, this.oy);
      this.map.renderCities(s.lon, s.lat);
    } else {
      this.map.setPerspective(0);
      this.map.render(s.lon, s.lat, s.reveal);
    }
    if (moved || gl !== last.gl) this.#hud(s.lon, s.lat);
    last.lon = s.lon; last.lat = s.lat; last.reveal = s.reveal; last.gl = gl;
  }

  /** Globe centre offset from the viewport centre in SVG viewBox units. Derived, no layout read. */
  #offAxis() {
    const g = this.geo;
    const r = g.compute(this.scroll.y);
    const unit = 400 / Math.max(1, r.width);
    this.ox = (r.left + r.width / 2 - g.vw / 2) * unit;
    this.oy = (r.top + r.height / 2 - g.vh / 2) * unit;
  }

  #hud(lon, lat) {
    const la = formatLat(lat);
    const lo = formatLon(lon);
    if (this.hudLat.textContent !== la) this.hudLat.textContent = la;
    if (this.hudLon.textContent !== lo) this.hudLon.textContent = lo;
  }

  destroy() {
    ScrollTrigger.removeEventListener('refresh', this.onRefresh);
    this.ro?.disconnect();
    if (corridorState.geo === this.geo) corridorState.geo = null;
    this.mm?.revert();
    super.destroy();
  }
}
