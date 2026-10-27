import { ScrollTrigger, byDocument } from '../../core/Scroll.js';

/**
 * Sections init in page order, but matchMedia rebuilds after 'ready' create triggers late, not in page order, so pinned
 * ScrollTriggers can be refreshed before the pins above them exist. Sorting every
 * trigger into document order before a refresh keeps pin spacing correct.
 */
export class TriggerOrder {
  static byDocument = byDocument;

  static apply(refresh = false) {
    ScrollTrigger.sort(TriggerOrder.byDocument);
    if (refresh) ScrollTrigger.refresh();
  }
}
