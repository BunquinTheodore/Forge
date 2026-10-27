/**
 * Shared registry: section element -> MoltenTrack. ProcessAct reads the line head from here
 * each frame (pure maths on cached geometry) instead of from DOM attributes.
 */
export const moltenHeads = new WeakMap();
