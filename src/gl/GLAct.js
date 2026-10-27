import { Group } from 'three';

/**
 * Base class for a WebGL "act": the 3D layer that belongs to one section.
 * All acts share ONE renderer, camera and canvas (src/gl/Stage.js), which keeps
 * the page to a single WebGL context.
 *
 * Subclass contract (file: src/sections/<id>/<Name>Act.js, default export):
 *   static global = false     true = always on (ambient layers); otherwise tied to section <id>
 *   static order = 0          render order among acts (higher draws later)
 *   async init()              build meshes and add them to this.group. Called lazily when the section approaches.
 *   update(dt, time, state)   per frame while visible. state = {
 *                               progress,   0..1 scroll progress through the section (0 = section top at viewport bottom,
 *                                           1 = section bottom at viewport top)
 *                               visibility, 0..1 eased presence in the viewport; multiply your opacity by it
 *                               pointer,    {x, y} smoothed, -1..1, y up
 *                               velocity,   smoothed scroll velocity (px/frame, signed)
 *                               scrollY, pageProgress (0..1 whole page), tier }
 *   resize(width, height)     optional
 *   onTierChange(tier)        optional, reduce work when the governor downgrades quality
 *   dispose()                 free geometries/materials/textures you created (call super.dispose()).
 *
 * Camera: PerspectiveCamera fov 35 at (0, 0, 10) looking at the origin. Never move the shared camera;
 * transform this.group instead. Use stage.viewSize(z) and stage.rectToWorld(domRect, z) to align 3D with DOM.
 */
export class GLAct {
  static global = false;
  static order = 0;

  constructor(stage, sectionEl) {
    this.stage = stage;
    this.section = sectionEl;
    this.device = stage.device;
    this.group = new Group();
    this.group.visible = false;
    this.ready = false;
    this.disposables = [];
  }

  get tier() { return this.device.tier; }
  get detail() { return this.device.detail; }

  /** Register geometries/materials/textures for automatic disposal. Returns the first argument. */
  track(...items) {
    this.disposables.push(...items);
    return items[0];
  }

  async init() {}
  update() {}
  resize() {}
  onTierChange() {}

  dispose() {
    this.disposables.forEach((d) => d?.dispose?.());
    this.disposables = [];
    this.group.removeFromParent();
  }
}
