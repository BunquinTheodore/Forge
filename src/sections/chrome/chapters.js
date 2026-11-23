/**
 * Chapter map shared by the chrome (menu, rail) and the footer nav.
 * Ids match the data-section attributes on the homepage, in page order. Other pages have no rail.
 */
const NAMES = [
  ['hero', 'The forum'],
  ['why', 'Why FORGE'],
  ['journey', 'The journey'],
  ['startup', 'An event as a startup'],
  ['join', 'Join FORGE'],
];

export const CHAPTERS = Object.freeze(
  NAMES.map(([id, name], i) => Object.freeze({ id, name, num: String(i + 1).padStart(2, '0') })),
);

export { chapterEl, focusChapter, goToChapter } from '../../core/navigation.js';
