import { gsap } from './Scroll.js';

/**
 * Shared scroll entrances. Call inside section.gsap(() => ...) so destroy() reverts them.
 * Everything runs once and animates transform and opacity only. Callers skip these for reduced motion.
 */

/** Rise-and-fade a set of elements, staggered, when their trigger enters the viewport. */
export function rise(targets, trigger, { y = 28, stagger = 0.09, duration = 0.9, start = 'top 82%', delay = 0 } = {}) {
  const items = gsap.utils.toArray(targets);
  if (!items.length) return null;
  return gsap.from(items, {
    opacity: 0, y, duration, delay, stagger, ease: 'power3.out', clearProps: 'transform',
    scrollTrigger: { trigger, start, once: true },
  });
}

/** Headline entrance: lines slide up out of their masks (markup: .line > span). */
export function lines(root, trigger, { start = 'top 82%', stagger = 0.12 } = {}) {
  const spans = gsap.utils.toArray(root.querySelectorAll('.line > span'));
  if (!spans.length) return null;
  return gsap.from(spans, {
    yPercent: 110, duration: 1.1, stagger, ease: 'expo.out',
    scrollTrigger: { trigger, start, once: true },
  });
}
