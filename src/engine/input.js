// Getting the player's will into the world: keys, swipes, and a thumb pad.

const KEY_MAP = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  W: 'up',
  A: 'left',
  S: 'down',
  D: 'right',
  k: 'up',
  h: 'left',
  j: 'down',
  l: 'right',
};

const SWIPE_THRESHOLD = 24;

export function bindInput({ surface, onDirection, onStart, onPause }) {
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onStart();
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        onPause();
        return;
      }
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      // Arrow keys scroll the page otherwise, which is death on a laptop.
      e.preventDefault();
      onDirection(dir);
      onStart();
    },
    { passive: false },
  );

  let start = null;
  let moved = false;

  surface.addEventListener(
    'touchstart',
    (e) => {
      const t = e.changedTouches[0];
      start = { x: t.clientX, y: t.clientY };
      moved = false;
    },
    { passive: true },
  );

  surface.addEventListener(
    'touchmove',
    (e) => {
      if (!start) return;
      // Stop the page from bouncing under the board while playing.
      e.preventDefault();
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;

      onDirection(
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up',
      );
      onStart();
      // Re-anchor so a long drag can chain several turns.
      start = { x: t.clientX, y: t.clientY };
      moved = true;
    },
    { passive: false },
  );

  surface.addEventListener(
    'touchend',
    () => {
      // A tap with no drag means "begin" — the most obvious thing to try.
      if (!moved) onStart();
      start = null;
    },
    { passive: true },
  );

  // On-screen pad, for thumbs that would rather press than swipe.
  for (const btn of document.querySelectorAll('[data-dir]')) {
    const fire = (e) => {
      e.preventDefault();
      onDirection(btn.dataset.dir);
      onStart();
    };
    btn.addEventListener('touchstart', fire, { passive: false });
    btn.addEventListener('mousedown', fire);
  }
}
