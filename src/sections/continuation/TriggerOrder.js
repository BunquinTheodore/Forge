import { ScrollTrigger } from '../../core/BaseSection.js';

const FOLLOWING = 4; // Node.DOCUMENT_POSITION_FOLLOWING

/**
 * Sections init in page order, but matchMedia rebuilds after 'ready' create triggers late, not in page order, so pinned
 * ScrollTriggers can be refreshed before the pins above them exist. Sorting every
 * trigger into document order before a refresh keeps pin spacing correct.
 */
export class TriggerOrder {
  static byDocument(a, b) {
    const ea = a.trigger;
    const eb = b.trigger;
    if (!ea || !eb || ea === eb) return (b.vars.refreshPriority || 0) - (a.vars.refreshPriority || 0);
    return ea.compareDocumentPosition(eb) & FOLLOWING ? -1 : 1;
  }

  static apply(refresh = false) {
    ScrollTrigger.sort(TriggerOrder.byDocument);
    if (refresh) ScrollTrigger.refresh();
  }
}
