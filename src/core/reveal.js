import { gsap } from './Scroll.js';

/**
 * Shared scroll entrances. Call inside section.gsap(() => ...) so destroy() reverts them.
 * Entrances run once and animate transform and opacity only. Callers skip these for reduced motion.
 *
 * They use IntersectionObserver instead of one ScrollTrigger each: ScrollTrigger re-measures every trigger on
 * each refresh (a layout pass per trigger), which is what made the first seconds of the page heavy. The observer
 * costs nothing until the element arrives, and an element the visitor already scrolled past (deep links, reloads)
 * is shown at once instead of animating off screen.
 */

/** 'top 82%' (ScrollTrigger style) to a rootMargin that fires when the element's top crosses that line. */
function marginFor(start) {
  const percent = Number(/(\d+)%/.exec(start)?.[1] ?? 85);
  return `0px 0px ${-(100 - percent)}% 0px`;
}

/**
 * Call reveal(animate) the first time `trigger` reaches the `start` line.
 * animate is true when the element arrives from below, false when it is already behind the visitor.
 */
export function onceVisible(trigger, start, reveal) {
  if (!('IntersectionObserver' in window)) { reveal(false); return; }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const passed = entry.boundingClientRect.bottom < 0;
      if (!entry.isIntersecting && !passed) continue;
      io.disconnect();
      reveal(!passed);
      return;
    }
  }, { rootMargin: marginFor(start) });
  io.observe(trigger);
}

/** Rise-and-fade a set of elements, staggered, when their trigger enters the viewport. */
export function rise(targets, trigger, { y = 28, stagger = 0.09, duration = 0.9, start = 'top 82%', delay = 0 } = {}) {
  const items = gsap.utils.toArray(targets);
  if (!items.length) return;
  const moves = y !== 0; // y = 0: fade only, so elements placed with a CSS transform keep it
  gsap.set(items, moves ? { opacity: 0, y } : { opacity: 0 });
  onceVisible(trigger, start, (animate) => {
    if (!animate) { gsap.set(items, moves ? { opacity: 1, clearProps: 'transform' } : { opacity: 1 }); return; }
    gsap.to(items, moves
      ? { opacity: 1, y: 0, duration, delay, stagger, ease: 'power3.out', clearProps: 'transform' }
      : { opacity: 1, duration, delay, stagger, ease: 'power2.out' });
  });
}

/** Headline entrance: lines slide up out of their masks (markup: .line > span). */
export function lines(root, trigger, { start = 'top 82%', stagger = 0.12 } = {}) {
  const spans = gsap.utils.toArray(root.querySelectorAll('.line > span'));
  if (!spans.length) return;
  gsap.set(spans, { yPercent: 110 });
  onceVisible(trigger, start, (animate) => {
    if (!animate) { gsap.set(spans, { yPercent: 0 }); return; }
    gsap.to(spans, { yPercent: 0, duration: 1.1, stagger, ease: 'expo.out' });
  });
}
