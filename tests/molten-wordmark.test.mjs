import test from 'node:test';
import assert from 'node:assert/strict';
import { MoltenWordmark } from '../src/sections/footer/MoltenWordmark.js';

// The wordmark registers listeners on `window`; the fake section below swallows them.
globalThis.window ??= {};

const FRAME = 1 / 60;
const WORD = { width: 1300, height: 230 };
let rect = { ...WORD };

/** Minimal stand in for the footer DOM: counts every CSS variable write on the word. */
function setup() {
  rect = { ...WORD };
  const handlers = {};
  const writes = { count: 0 };
  const word = {
    getBoundingClientRect: () => ({ left: 40, top: 500, ...rect }),
    style: { setProperty: (name) => { if (name !== '--ox') writes.count += 1; } },
  };
  const letters = [0, 1, 2, 3, 4].map((i) => ({ offsetLeft: i * 260, style: { setProperty() {} } }));
  const mark = {
    querySelector: () => word,
    querySelectorAll: () => letters,
  };
  const section = {
    reducedMotion: false,
    listen: (target, type, fn) => { handlers[type] = fn; },
  };
  const wordmark = new MoltenWordmark(section, mark);
  const run = (seconds, { scrolling = false, frame = FRAME } = {}) => {
    const before = writes.count;
    for (let i = 0; i < Math.round(seconds / frame); i += 1) {
      if (scrolling) handlers.scroll();
      wordmark.update(frame);
    }
    return writes.count - before;
  };
  return { wordmark, handlers, run, writes };
}

test('does not drift while the page is scrolling', () => {
  const { run } = setup();
  run(FRAME, { scrolling: true });          // the first frame writes the starting values
  assert.equal(run(2, { scrolling: true }), 0);
});

test('drifts once scrolling stops, at no more than 30 frames a second', () => {
  const { run } = setup();
  run(1, { scrolling: true });
  const writes = run(2);
  assert.ok(writes > 0, 'the heat should wander when the visitor is idle');
  assert.ok(writes <= 3 * 30 * 2, `expected at most 180 writes in 2s, got ${writes}`);
});

test('settles and stops writing after the drift budget is used', () => {
  const { run } = setup();
  run(12);                       // 1.8s idle delay + 8s of drift + time to ease to a stop
  assert.equal(run(5), 0);
});

test('a pointer wakes the heat again, and follows it every frame', () => {
  const { run, handlers } = setup();
  run(12);
  handlers.pointermove({ clientX: 300, clientY: 600 });
  const writes = run(1);
  assert.ok(writes > 30, `steering should write on most frames, got ${writes}`);
});

test('wake() gives the drift a fresh budget when the footer returns', () => {
  const { run, wordmark } = setup();
  run(12);
  assert.equal(run(2), 0);
  wordmark.wake();
  assert.ok(run(2) > 0);
});

test('reads the word box once per frame while steering, not once per pointer event', () => {
  const { run, handlers, wordmark } = setup();
  let reads = 0;
  const box = wordmark.word.getBoundingClientRect;
  wordmark.word.getBoundingClientRect = () => { reads += 1; return box(); };
  for (let i = 0; i < 20; i += 1) handlers.pointermove({ clientX: 100 + i, clientY: 600 });
  assert.equal(reads, 0, 'pointer events must not force a layout read');
  run(FRAME);
  assert.equal(reads, 1);
});

test('holds the heat still while the page scrolls under a resting cursor', () => {
  const { run, handlers, wordmark } = setup();
  run(1);
  handlers.pointermove({ clientX: 300, clientY: 600 });
  run(3);                        // let the heat finish easing to the cursor
  let reads = 0;
  const box = wordmark.word.getBoundingClientRect;
  wordmark.word.getBoundingClientRect = () => { reads += 1; return box(); };
  assert.equal(run(1, { scrolling: true }), 0, 'no repaint while scrolling');
  assert.equal(reads, 0, 'no layout read while scrolling');
});

test('a resize with the same size leaves a settled heat alone', () => {
  const { run, handlers } = setup();
  run(12);
  handlers.resize();
  assert.equal(run(3), 0);
});

test('a resize to a new size keeps the heat in the same relative place', () => {
  const { run, handlers, wordmark } = setup();
  run(12);
  const before = { x: wordmark.tx / wordmark.w, y: wordmark.ty / wordmark.h };
  rect = { width: 650, height: 115 };
  handlers.resize();
  assert.ok(Math.abs(wordmark.tx / wordmark.w - before.x) < 1e-9);
  assert.ok(Math.abs(wordmark.ty / wordmark.h - before.y) < 1e-9);
});

test('drift still updates about 30 times a second on a 45 fps laptop', () => {
  const { run } = setup();
  run(0.5);
  const frames45 = 1 / 45;
  const writes = run(1, { frame: frames45 });
  // A tick writes about 1.5 of the 3 variables. 30 ticks a second is about 45 writes; a plain
  // "wait 1/30 s" throttle would only tick every other frame at 45 fps (22 Hz, about 33 writes).
  assert.ok(writes >= 45, `expected at least 30 ticks a second, got ${writes} writes`);
});
