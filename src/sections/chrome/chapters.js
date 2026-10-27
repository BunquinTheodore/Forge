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

export { chapterEl, focusChapter, goToChapter } from '../../core/navigation.js';
