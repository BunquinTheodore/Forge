/**
 * Page colour temperature, shared by the GL ambient layer and its CSS fallback.
 * A faint warmth at the very top (the poster glow), cool steel through the
 * middle chapters, then rising to hot ember as the visitor nears the ask.
 * Returns 0 (cool steel) .. 1 (hot ember).
 */
const smooth = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export function pageHeat(progress) {
  const topGlow = (1 - smooth(0, 0.16, progress)) * 0.42;
  const endHeat = smooth(0.32, 0.97, progress);
  return Math.max(topGlow, endHeat);
}
