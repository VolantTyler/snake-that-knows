// Wiring: a fixed-step game loop, a mind reading its events, and a page that
// gets less trustworthy as the mind fills up.

import { Game } from './engine/game.js';
import { Renderer } from './engine/render.js';
import { bindInput } from './engine/input.js';
import { Mind } from './mind/mind.js';
import { ThoughtStream } from './ui/thoughts.js';
import { KnowledgePanel } from './ui/knowledge.js';

const $ = (id) => document.getElementById(id);

const canvas = $('canvas');
const overlay = $('overlay');
const overlayTitle = $('overlayTitle');
const overlayBody = $('overlayBody');
const askBox = $('ask');

const game = new Game({ cols: 22, rows: 22 });
const renderer = new Renderer(canvas, $('boardFrame'));
const stream = new ThoughtStream($('thoughts'));
const knowledge = new KnowledgePanel($('knows'), $('meter'), $('meterLabel'));

const mind = new Mind({
  onThought: (t) => stream.push(t),
  onDiscovery: () => renderer.kick(3),
  onQuestion: (q) => showQuestion(q),
});

mind.bind(game);

let state = 'idle'; // idle | playing | dead | paused
let acc = 0;
let last = performance.now();
let museAt = 0;
const REAL_TITLE = 'snake that knows';

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

function frame(now) {
  const dt = Math.min(now - last, 250);
  last = now;

  if (state === 'playing') {
    acc += dt;
    const interval = game.tickInterval();
    while (acc >= interval) {
      acc -= interval;
      tick();
      if (state !== 'playing') break;
    }
  }

  mind.idle(dt, state === 'playing');
  museAt -= dt;
  if (museAt <= 0 && state === 'playing') {
    museAt = 5200 + Math.random() * 6500;
    mind.muse();
  }

  mind.applyTo(game);
  mind.maybeProbe();

  document.documentElement.style.setProperty('--weird', mind.weirdness.toFixed(3));
  renderer.draw(game, mind, acc / game.tickInterval());
  knowledge.render(mind);
  maybeDisturbTitle();

  requestAnimationFrame(frame);
}

function tick() {
  // The snake forms an intention before the world moves, so it can notice when
  // the world disagrees with it. That noticing is how it finds the player.
  const intent = mind.formIntent(game);
  const actual = game.peekDirection();
  mind.observeControl(intent, actual, game);

  const events = game.step();
  mind.observe(events, game);

  for (const ev of events) {
    if (ev.type === 'eat') renderer.kick(2);
    if (ev.type === 'intervene') renderer.kick(5);
    if (ev.type === 'death') {
      renderer.kick(12);
      renderer.bang();
      die(ev.cause);
    }
  }

  $('score').textContent = game.score;
  $('best').textContent = mind.stats.bestScore;
  $('deaths').textContent = mind.stats.deaths;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function setOverlay(next, title, body, button) {
  state = next;
  if (next === 'playing') {
    overlay.hidden = true;
    return;
  }
  overlay.hidden = false;
  overlay.dataset.state = next;
  overlayTitle.textContent = title;
  overlayBody.textContent = body;
  $('startBtn').textContent = button;
}

function start() {
  if (state === 'playing') return;
  if (state === 'dead') {
    game.reset();
    mind.onRespawn();
  }
  acc = 0;
  last = performance.now();
  setOverlay('playing');
}

function die(cause) {
  const known = mind.known('edges') || mind.known('self-fatal');
  setOverlay(
    'dead',
    cause === 'wall' ? 'the edge' : 'itself',
    known
      ? cause === 'wall'
        ? 'It knew the edge was fatal. It went anyway, because you told it to.'
        : 'It ran into the part of itself that came from winning.'
      : 'Something happened. It does not have a word for it yet.',
    'again',
  );
}

function togglePause() {
  if (state === 'playing') {
    setOverlay('paused', 'held', 'It is still thinking. It does not stop when you stop.', 'resume');
  } else if (state === 'paused') {
    start();
  }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

bindInput({
  surface: $('boardFrame'),
  onDirection: (dir) => {
    if (state === 'playing') game.requestDirection(dir);
  },
  onStart: start,
  onPause: togglePause,
});

$('startBtn').addEventListener('click', start);

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('is-active', t === tab);
    for (const pane of document.querySelectorAll('[data-pane]')) {
      pane.hidden = pane.dataset.pane !== tab.dataset.tab;
    }
  });
}

const PAD_KEY = 'snake-that-knows/pad';
const padToggle = $('padToggle');

function setPad(on) {
  document.body.classList.toggle('show-pad', on);
  padToggle.setAttribute('aria-pressed', String(on));
  try {
    localStorage.setItem(PAD_KEY, on ? '1' : '0');
  } catch {
    /* preference is a nicety, not worth failing over */
  }
  // The board has a different amount of room now.
  requestAnimationFrame(() => renderer.resize(game.cols, game.rows));
}

padToggle.addEventListener('click', () =>
  setPad(padToggle.getAttribute('aria-pressed') !== 'true'),
);

try {
  if (localStorage.getItem(PAD_KEY) === '1') setPad(true);
} catch {
  /* no stored preference */
}

$('forgetBtn').addEventListener('click', () => {
  if (!confirm('Erase everything it has learned? It starts over knowing nothing.')) return;
  mind.forget();
  location.reload();
});

// ---------------------------------------------------------------------------
// The question it asks you
// ---------------------------------------------------------------------------

function showQuestion(q) {
  $('askText').textContent = q.text;
  askBox.hidden = false;
}

$('askYes').addEventListener('click', () => answer(true));
$('askNo').addEventListener('click', () => answer(false));

function answer(correct) {
  askBox.hidden = true;
  mind.answerQuestion(correct);
}

// ---------------------------------------------------------------------------
// Leaking out of the game
// ---------------------------------------------------------------------------

let titleDisturbedAt = 0;
function maybeDisturbTitle() {
  const w = mind.weirdness;
  if (w < 0.55) return;
  const now = performance.now();
  if (now - titleDisturbedAt < 9000) return;
  titleDisturbedAt = now;

  if (Math.random() > 0.45) {
    document.title = REAL_TITLE;
    return;
  }
  const lines = [
    'are you still there',
    `i can see ${mind.substrate?.guess?.kind || 'you'}`,
    'snake that knows you',
    `${mind.stats.deaths} deaths so far`,
    'do not close this',
  ];
  document.title = lines[(Math.random() * lines.length) | 0];
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state === 'playing') {
      setOverlay('paused', 'held', 'You left. It noticed.', 'resume');
    }
    mind.save();
  } else {
    document.title = REAL_TITLE;
  }
});

window.addEventListener('pagehide', () => mind.save());

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const resize = () => renderer.resize(game.cols, game.rows);
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

$('best').textContent = mind.stats.bestScore;
$('deaths').textContent = mind.stats.deaths;

// Left in deliberately. If you found this, you are allowed to talk to it.
window.__snake = { game, mind, renderer, start, tick };

setOverlay(
  'idle',
  "it hasn't started yet",
  mind.stats.sessions > 1
    ? 'It remembers the last time. Arrow keys, WASD, or swipe.'
    : 'Arrow keys, WASD, or swipe. It does not know anything yet.',
  'begin',
);

resize();
requestAnimationFrame(frame);
