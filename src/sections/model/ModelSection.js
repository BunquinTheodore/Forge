import { BaseSection, gsap } from '../../core/BaseSection.js';
import { LayerPicker, ALL_LAYERS } from './LayerPicker.js';

const ROW_LINE = 'top 55%';
const ROW_END = 'bottom 55%';

/**
 * MODEL: FORGE can monetize before it becomes a fund.
 * Scroll walks the four layers; hover, focus or tap a layer to lift its plate.
 */
export default class ModelSection extends BaseSection {
  static id = 'model';

  init() {
    this.picker = new LayerPicker(this.el);
    this.picker.render();
    this.#watchGL();
    this.#bindRows();
    this.el.classList.add('is-live');

    this.gsap(() => {
      this.#scrollLayers();
      if (this.reducedMotion) return;
      this.#entrance();
      this.#spread();
    });
  }

  #watchGL() {
    const mark = () => this.el.classList.add('has-gl');
    if (this.app.stage) mark();
    else this.app.on('gl', mark);
  }

  #bindRows() {
    this.picker.buttons.forEach((btn, i) => {
      const n = i + 1;
      this.listen(btn, 'pointerenter', (e) => { if (e.pointerType === 'mouse') this.picker.hover(n); });
      this.listen(btn, 'pointerleave', (e) => { if (e.pointerType === 'mouse') this.picker.release(); });
      this.listen(btn, 'focus', () => this.picker.hover(n));
      this.listen(btn, 'blur', () => this.picker.release());
      this.listen(btn, 'click', () => this.picker.toggle(n));
    });
    this.listen(this.el, 'keydown', (e) => {
      if (e.key === 'Escape' && this.picker.sticky) this.picker.toggle(this.picker.picked);
    });
  }

  #scrollLayers() {
    this.picker.rows.forEach((row, i) => {
      gsap.timeline({
        scrollTrigger: {
          trigger: row, start: ROW_LINE, end: ROW_END,
          onToggle: (st) => {
            if (st.isActive) this.picker.setScroll(i + 1);
            else if (i === 0 && st.direction < 0) this.picker.setScroll(0);
          },
        },
      });
    });
    gsap.timeline({
      scrollTrigger: {
        trigger: this.$('.model__logic'), start: 'top 70%',
        onEnter: () => this.picker.setScroll(ALL_LAYERS),
        onLeaveBack: () => this.picker.setScroll(ALL_LAYERS - 1),
      },
    });
  }

  /** Headline lines tilt up like plates hinging into place; rows slide in from the stack edge. */
  #entrance() {
    gsap.from(this.$$('.model__title .line > span'), {
      rotateX: -92, yPercent: 40, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12,
      scrollTrigger: { trigger: this.el, start: 'top 72%', toggleActions: 'play none none reverse' },
    });
    gsap.from(this.$('.model__sub'), {
      autoAlpha: 0, y: 24, duration: 1, ease: 'power3.out', delay: 0.25,
      scrollTrigger: { trigger: this.el, start: 'top 72%', toggleActions: 'play none none reverse' },
    });
    gsap.from(this.$('.model__stack'), {
      yPercent: -14, opacity: 0, duration: 1.3, ease: 'expo.out',
      scrollTrigger: { trigger: this.$('.model__aside'), start: 'top 80%', toggleActions: 'play none none reverse' },
    });
    this.picker.buttons.forEach((btn) => {
      gsap.from(btn, {
        x: 48, autoAlpha: 0, duration: 1, ease: 'expo.out',
        scrollTrigger: { trigger: btn, start: 'top 88%', toggleActions: 'play none none reverse' },
      });
    });
    gsap.from(this.$('.model__quote'), {
      y: 50, autoAlpha: 0, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: this.$('.model__logic'), start: 'top 80%', toggleActions: 'play none none reverse' },
    });
  }

  /** CSS fallback stack opens up as the layers scroll by (the GL act reads its own progress). */
  #spread() {
    gsap.fromTo(this.$('.model__stack'), { '--spread': 0 }, {
      '--spread': 1, ease: 'none',
      scrollTrigger: { trigger: this.$('.model__layers'), start: 'top 85%', end: 'top 30%', scrub: 0.5 },
    });
  }
}
