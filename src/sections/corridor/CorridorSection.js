import { BaseSection, gsap, ScrollTrigger } from '../../core/BaseSection.js';
import { REGIONS } from './corridorData.js';
import { corridorState } from './corridorState.js';
import { GlobeController } from './GlobeController.js';
import { CorridorMap } from './CorridorMap.js';
import { GlobeGeometry } from './GlobeGeometry.js';

const PIN_QUERY = '(min-width: 960px) and (min-height: 640px)';
const VIEW_H_AT_ORIGIN = 2 * Math.tan((17.5 * Math.PI) / 180) * 10; // shared camera: fov 35, z 10
const CAMERA_Z = 10;
const GLOBE_FILL = 0.92;
const BANDS = [0.33, 0.6];

export default class CorridorSection extends BaseSection {
  static id = 'corridor';

  init() {
    this.globe = this.$('[data-globe-anchor]');
    this.regions = this.$$('.corridor__region');
    this.controller = new GlobeController(this.reducedMotion);
    this.map = new CorridorMap(this.$('.corridor__map'));
    this.geo = new GlobeGeometry(this.globe, this.$('.corridor__pin'), this.$('.corridor__track'));
    corridorState.geo = this.geo;
    this.regionIndex = 0;
    this.scrollBand = 0;
    this.last = { lon: NaN, lat: NaN, reveal: NaN, gl: false };

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

  /** Scroll-driven: highlights a region and turns the globe toward it. */
  setRegion(index) {
    if (index === this.regionIndex) return;
    this.regionIndex = index;
    this.el.dataset.region = REGIONS[index].id;
    this.controller.setRegion(index);
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

  /** Scroll walks the corridor: Europe, Philippines, ASEAN. Off under reduced motion. */
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
        this.setRegion(band);
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
      .fromTo(this.regions, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.08 }, 0.6)
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
    thesis.fromTo(this.$('.corridor__claim'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6 }, 0);
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

  destroy() {
    ScrollTrigger.removeEventListener('refresh', this.onRefresh);
    this.ro?.disconnect();
    if (corridorState.geo === this.geo) corridorState.geo = null;
    this.mm?.revert();
    super.destroy();
  }
}
