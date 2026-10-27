import { Color } from 'three';

/** Token name -> fallback hex (kept identical to src/styles/tokens.css). */
const TOKENS = {
  ink: ['--ink', '#080b0e'],
  steel: ['--steel', '#293342'],
  steel2: ['--steel-2', '#3a4656'],
  fog: ['--fog', '#aeb7c4'],
  cream: ['--cream', '#f5f0e8'],
  ember: ['--ember', '#e85b22'],
  emberHot: ['--ember-hot', '#ff7a2f'],
  emberGlow: ['--ember-glow', '#ffb36b'],
  emberDeep: ['--ember-deep', '#a8340f'],
};

/** Reads brand colours from the CSS tokens so the GL layer never drifts from the palette. */
export function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const out = {};
  for (const [key, [name, fallback]] of Object.entries(TOKENS)) {
    const value = css.getPropertyValue(name).trim();
    out[key] = new Color(value || fallback);
  }
  return out;
}

/** Uniform block for the ember ramp, shared by reference across materials. */
export function emberUniforms(p) {
  return {
    uEmberDeep: { value: p.emberDeep },
    uEmber: { value: p.ember },
    uEmberHot: { value: p.emberHot },
    uEmberGlow: { value: p.emberGlow },
  };
}
