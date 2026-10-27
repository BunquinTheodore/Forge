/** Chapter navigation helpers shared by the chrome (menu, rail) and the footer. */

/** Resolve a chapter's DOM element (null when that section is not on the page). */
export function chapterEl(id) {
  return document.getElementById(id) || document.querySelector(`[data-section="${id}"]`);
}

/** Move keyboard focus to a chapter (without scrolling) so the next Tab continues from there. */
export function focusChapter(id) {
  const el = chapterEl(id);
  if (!el) return;
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

/** Scroll to a chapter with the app's smooth scroller, falling back to native. */
export function goToChapter(app, id) {
  const el = chapterEl(id);
  if (!el) return false;
  if (app?.scroll) {
    app.scroll.start();
    app.scroll.to(el);
  } else {
    el.scrollIntoView();
  }
  return true;
}
