/**
 * Chapter map shared by the chrome (menu, rail) and the footer nav.
 * Ids match the data-section attributes in index.html, in page order.
 */
const NAMES = [
  ['hero', 'The forum'],
  ['thesis', 'The thesis'],
  ['problem', 'The problem'],
  ['shift', 'What changes'],
  ['proposition', 'The proposition'],
  ['audience', 'Who it is for'],
  ['process', 'How it works'],
  ['corridor', 'The corridor'],
  ['programme', 'The programme'],
  ['room', 'The room'],
  ['capital', 'Smart capital'],
  ['continuation', 'After the day'],
  ['model', 'Business model'],
  ['moat', 'The moat'],
  ['learning', 'Designed to learn'],
  ['trust', 'Trust and governance'],
  ['ask', 'The ask'],
];

export const CHAPTERS = Object.freeze(
  NAMES.map(([id, name], i) => Object.freeze({ id, name, num: String(i + 1).padStart(2, '0') })),
);

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
