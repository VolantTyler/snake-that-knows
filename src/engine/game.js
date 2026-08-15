// The world, and the rules the snake is not told.
//
// The Game knows nothing about the Mind. It emits events; the Mind reads them
// and draws its own conclusions, which are often wrong for a while.

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const BASE_TICK_MS = 132;
export const MIN_TICK_MS = 74;

export class Game {
  constructor({ cols = 22, rows = 22 } = {}) {
    this.cols = cols;
    this.rows = rows;

    // Reality modifiers. The Mind is allowed to write here once it knows
    // enough to notice that reality is writable.
    this.reality = {
      wallsSolid: true, // when false, edges wrap
      foodFlees: 0, // 0..1 chance food steps away when approached
      guardian: 0, // 0..1 chance a fatal move is silently refused
      frozenFood: false,
    };

    this.reset({ hard: true });
  }

  reset({ hard = false } = {}) {
    const cx = Math.floor(this.cols / 2);
    const cy = Math.floor(this.rows / 2);

    this.snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    this.direction = 'right';
    this.queue = [];
    this.alive = true;
    this.score = 0;
    this.ticks = 0;
    this.lastCause = null;
    this.pendingGrowth = 0;
    this.foodFleeBudget = 0;
    this.guardianReadyAt = 0;

    if (hard) {
      this.runs = 0;
      this.visited = new Set();
    }
    this.placeFood();
  }

  get head() {
    return this.snake[0];
  }

  get length() {
    return this.snake.length;
  }

  occupied(x, y) {
    return this.snake.some((s) => s.x === x && s.y === y);
  }

  placeFood() {
    const free = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!this.occupied(x, y)) free.push({ x, y });
      }
    }
    if (!free.length) {
      this.food = null;
      return;
    }
    this.food = free[(Math.random() * free.length) | 0];
    this.foodFleeBudget = 3; // food may only run so far before it gives up
  }

  /** Queue a direction change. Returns true if it was accepted as a real turn. */
  requestDirection(dir) {
    if (!DIRS[dir] || !this.alive) return false;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.direction;
    if (dir === last || dir === OPPOSITE[last]) return false;
    if (this.queue.length < 2) this.queue.push(dir);
    return true;
  }

  /** The direction this tick will actually use, before it is consumed. */
  peekDirection() {
    return this.queue.length ? this.queue[0] : this.direction;
  }

  wrap(p) {
    return {
      x: (p.x + this.cols) % this.cols,
      y: (p.y + this.rows) % this.rows,
    };
  }

  /** Would moving in `dir` from the current head kill us? */
  isFatal(dir) {
    const d = DIRS[dir];
    let nx = this.head.x + d.x;
    let ny = this.head.y + d.y;
    const outside = nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows;

    if (outside) {
      if (this.reality.wallsSolid) return 'wall';
      ({ x: nx, y: ny } = this.wrap({ x: nx, y: ny }));
    }
    // The tail cell frees up on the same tick, unless we are growing into it.
    const body = this.pendingGrowth > 0 ? this.snake : this.snake.slice(0, -1);
    if (body.some((s) => s.x === nx && s.y === ny)) return 'self';
    return null;
  }

  safeDirections() {
    return Object.keys(DIRS).filter(
      (d) => d !== OPPOSITE[this.direction] && !this.isFatal(d),
    );
  }

  maybeFleeFood() {
    if (!this.food || this.reality.foodFlees <= 0) return null;
    if (this.foodFleeBudget <= 0 || this.reality.frozenFood) return null;

    const dist =
      Math.abs(this.food.x - this.head.x) + Math.abs(this.food.y - this.head.y);
    if (dist > 2) return null;
    if (Math.random() > this.reality.foodFlees) return null;

    const options = Object.values(DIRS)
      .map((d) => ({ x: this.food.x + d.x, y: this.food.y + d.y }))
      .filter(
        (p) =>
          p.x >= 0 &&
          p.y >= 0 &&
          p.x < this.cols &&
          p.y < this.rows &&
          !this.occupied(p.x, p.y),
      )
      .sort(
        (a, b) =>
          Math.abs(b.x - this.head.x) +
          Math.abs(b.y - this.head.y) -
          (Math.abs(a.x - this.head.x) + Math.abs(a.y - this.head.y)),
      );

    if (!options.length) return null;
    this.food = options[0];
    this.foodFleeBudget--;
    return this.food;
  }

  /**
   * Advance one tick. Returns a list of events for the Mind to interpret.
   */
  step() {
    if (!this.alive) return [];
    const events = [];
    this.ticks++;

    let dir = this.direction;
    if (this.queue.length) {
      const next = this.queue.shift();
      if (next !== this.direction) {
        events.push({ type: 'turn', from: this.direction, to: next });
      }
      dir = next;
    }

    // The guardian: once the snake understands that death is a thing that
    // happens to it, it occasionally declines to participate. Rate-limited on
    // purpose — it should read as a rare, startling act of will, not a safety
    // net that makes the game unloseable.
    let intervened = null;
    if (this.isFatal(dir) && this.reality.guardian > 0 && this.ticks > this.guardianReadyAt) {
      if (Math.random() < this.reality.guardian) {
        this.guardianReadyAt = this.ticks + 120;
        const alternatives = this.safeDirections();
        if (alternatives.length) {
          const better = alternatives.sort(
            (a, b) => this.foodDistanceAfter(a) - this.foodDistanceAfter(b),
          )[0];
          intervened = { from: dir, to: better };
          dir = better;
          events.push({ type: 'intervene', ...intervened });
        }
      }
    }

    this.direction = dir;
    const d = DIRS[dir];
    let next = { x: this.head.x + d.x, y: this.head.y + d.y };
    const outside =
      next.x < 0 || next.y < 0 || next.x >= this.cols || next.y >= this.rows;

    if (outside) {
      if (this.reality.wallsSolid) {
        this.alive = false;
        this.lastCause = 'wall';
        events.push({ type: 'death', cause: 'wall', at: next });
        return events;
      }
      next = this.wrap(next);
      events.push({ type: 'wrap', at: next });
    }

    const body = this.pendingGrowth > 0 ? this.snake : this.snake.slice(0, -1);
    if (body.some((s) => s.x === next.x && s.y === next.y)) {
      this.alive = false;
      this.lastCause = 'self';
      events.push({ type: 'death', cause: 'self', at: next });
      return events;
    }

    this.snake.unshift(next);
    if (this.pendingGrowth > 0) this.pendingGrowth--;
    else this.snake.pop();

    this.visited.add(`${next.x},${next.y}`);
    events.push({ type: 'move', at: next, dir });

    if (this.food && next.x === this.food.x && next.y === this.food.y) {
      this.score++;
      this.pendingGrowth += 1;
      events.push({ type: 'eat', score: this.score, length: this.length + 1 });
      this.placeFood();
    } else {
      const fled = this.maybeFleeFood();
      if (fled) events.push({ type: 'foodFled', at: fled });
    }

    return events;
  }

  foodDistanceAfter(dir) {
    if (!this.food) return 0;
    const d = DIRS[dir];
    const p = { x: this.head.x + d.x, y: this.head.y + d.y };
    return Math.abs(p.x - this.food.x) + Math.abs(p.y - this.food.y);
  }

  tickInterval() {
    const speedUp = Math.min(this.score * 1.6, BASE_TICK_MS - MIN_TICK_MS);
    return Math.max(MIN_TICK_MS, BASE_TICK_MS - speedUp);
  }
}
