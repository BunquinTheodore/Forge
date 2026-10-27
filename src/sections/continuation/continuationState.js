/**
 * Shared state between ContinuationScenes (writer) and ContinuationAct (reader).
 * Plain JS instead of DOM data attributes so the GL frame never reads back a style-invalidating write.
 */
export const continuationState = {
  heat: 0,          // 0..1 film / flow progress that drives the ember field
  mode: 'static',   // 'film' | 'flow' | 'static'
  trigger: null,    // the pinned film ScrollTrigger while in film mode
};
