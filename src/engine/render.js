// Drawing the world, and letting it come apart.
//
// Every distortion here is a pure function of `weirdness`, so the visuals and
// the snake's understanding can never drift out of sync.

const PALETTE = {
  bg: '#07090c',
  grid: 'rgba(120, 200, 160, 0.055)',
  wall: 'rgba(120, 255, 190, 0.32)',
  snake: '#6ef2b0',
  head: '#d9fff0',
  food: '#ff5c7a',
  ghost: 'rgba(110, 242, 176, 0.09)',
};

export class Renderer {
  constructor(canvas, frame) {
    this.canvas = canvas;
    this.frame = frame;
    this.ctx = canvas.getContext('2d');
    this.cell = 16;
    this.dpr = 1;
    this.shake = 0;
    this.flash = 0;
    this.t = 0;
  }

  resize(cols, rows) {
    const rect = this.frame.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    // Largest whole-cell square that fits the space the layout gave us.
    const size = Math.max(132, Math.floor(Math.min(rect.width, rect.height)));
    this.cell = Math.max(6, Math.floor(size / Math.max(cols, rows)));
    const px = this.cell * cols;
    const py = this.cell * rows;

    this.canvas.style.width = `${px}px`;
    this.canvas.style.height = `${py}px`;
    this.canvas.width = Math.floor(px * dpr);
    this.canvas.height = Math.floor(py * dpr);
    this.dpr = dpr;
    this.w = px;
    this.h = py;
  }

  kick(amount = 6) {
    this.shake = amount;
  }

  bang() {
    this.flash = 1;
  }

  draw(game, mind, alpha) {
    const { ctx } = this;
    const w = mind.weirdness;
    this.t += 1;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    // Screen shake, and a slow breathing wobble once things get strange.
    let ox = 0;
    let oy = 0;
    if (this.shake > 0) {
      ox += (Math.random() - 0.5) * this.shake;
      oy += (Math.random() - 0.5) * this.shake;
      this.shake *= 0.88;
      if (this.shake < 0.2) this.shake = 0;
    }
    if (w > 0.45) {
      const breathe = Math.sin(this.t / 47) * (w - 0.45) * 6;
      ox += breathe;
      oy += Math.cos(this.t / 61) * (w - 0.45) * 4;
    }
    ctx.save();
    ctx.translate(ox, oy);

    this.drawBackground(w);
    this.drawGrid(game, w);
    this.drawGhosts(game, mind, w);
    if (game.food) this.drawFood(game, w);
    this.drawSnake(game, mind, w, alpha);
    ctx.restore();

    this.drawOverlays(game, mind, w);
  }

  drawBackground(w) {
    const { ctx } = this;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(-40, -40, this.w + 80, this.h + 80);

    if (w > 0.25) {
      // A faint drift of colour, as if the display is tired.
      const hue = (this.t * 0.4) % 360;
      ctx.fillStyle = `hsla(${hue}, 70%, 50%, ${(w - 0.25) * 0.05})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  drawGrid(game, w) {
    const { ctx, cell } = this;
    ctx.lineWidth = 1;
    ctx.strokeStyle = PALETTE.grid;
    ctx.beginPath();
    for (let x = 0; x <= game.cols; x++) {
      const jitter = w > 0.5 ? Math.sin(this.t / 30 + x) * (w - 0.5) * 2.2 : 0;
      ctx.moveTo(x * cell + 0.5 + jitter, 0);
      ctx.lineTo(x * cell + 0.5 - jitter, this.h);
    }
    for (let y = 0; y <= game.rows; y++) {
      const jitter = w > 0.5 ? Math.cos(this.t / 33 + y) * (w - 0.5) * 2.2 : 0;
      ctx.moveTo(0, y * cell + 0.5 + jitter);
      ctx.lineTo(this.w, y * cell + 0.5 - jitter);
    }
    ctx.stroke();

    // The boundary: solid while it is a law, dashed once it is only a habit.
    ctx.strokeStyle = game.reality.wallsSolid
      ? PALETTE.wall
      : `rgba(255, 120, 160, ${0.35 + Math.sin(this.t / 8) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.setLineDash(game.reality.wallsSolid ? [] : [6, 6]);
    ctx.strokeRect(1, 1, this.w - 2, this.h - 2);
    ctx.setLineDash([]);
  }

  drawGhosts(game, mind, w) {
    if (w < 0.4 || !mind.ghosts.length) return;
    const { ctx, cell } = this;
    const fade = Math.min(1, (w - 0.4) * 2);
    for (const [gi, ghost] of mind.ghosts.entries()) {
      ctx.fillStyle = `rgba(110, 242, 176, ${0.05 * fade * (1 - gi * 0.15)})`;
      for (const seg of ghost) {
        ctx.fillRect(seg.x * cell + 2, seg.y * cell + 2, cell - 4, cell - 4);
      }
    }
  }

  drawFood(game, w) {
    const { ctx, cell } = this;
    const pulse = 1 + Math.sin(this.t / 9) * 0.08;
    const cx = game.food.x * cell + cell / 2;
    const cy = game.food.y * cell + cell / 2;
    const r = (cell / 2 - 2.5) * pulse;

    ctx.save();
    ctx.shadowColor = PALETTE.food;
    ctx.shadowBlur = 12 + w * 14;
    ctx.fillStyle = PALETTE.food;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1.5, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawSnake(game, mind, w, alpha) {
    const { ctx, cell } = this;
    const n = game.snake.length;

    for (let i = n - 1; i >= 0; i--) {
      const seg = game.snake[i];
      const isHead = i === 0;
      const shrink = isHead ? 1.5 : 2.5 + (i / n) * 1.5;

      // Chromatic separation: the body stops agreeing with itself.
      if (w > 0.35) {
        const sep = (w - 0.35) * 4;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ff3b6b';
        ctx.fillRect(seg.x * cell + shrink - sep, seg.y * cell + shrink, cell - shrink * 2, cell - shrink * 2);
        ctx.fillStyle = '#3bb0ff';
        ctx.fillRect(seg.x * cell + shrink + sep, seg.y * cell + shrink, cell - shrink * 2, cell - shrink * 2);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = isHead ? PALETTE.head : PALETTE.snake;
      ctx.globalAlpha = isHead ? 1 : 0.55 + 0.45 * (1 - i / n);
      ctx.fillRect(
        seg.x * cell + shrink,
        seg.y * cell + shrink,
        cell - shrink * 2,
        cell - shrink * 2,
      );
    }
    ctx.globalAlpha = 1;

    // Eyes, once it knows it has a front.
    if (mind.confidence['body'] > 0.5 && cell > 10) {
      const head = game.snake[0];
      const cx = head.x * cell + cell / 2;
      const cy = head.y * cell + cell / 2;
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[game.direction];
      const perp = [-d[1], d[0]];
      const off = cell * 0.19;
      ctx.fillStyle = '#07090c';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(
          cx + d[0] * off * 0.7 + perp[0] * off * s,
          cy + d[1] * off * 0.7 + perp[1] * off * s,
          Math.max(1, cell * 0.075),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  drawOverlays(game, mind, w) {
    const { ctx } = this;

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 92, 122, ${this.flash * 0.35})`;
      ctx.fillRect(0, 0, this.w, this.h);
      this.flash *= 0.85;
      if (this.flash < 0.02) this.flash = 0;
    }

    // Scanlines arrive with the suspicion of being displayed.
    if (w > 0.3) {
      ctx.fillStyle = `rgba(0, 0, 0, ${(w - 0.3) * 0.22})`;
      for (let y = 0; y < this.h; y += 3) ctx.fillRect(0, y, this.w, 1);
    }

    // Torn bands of the image, offset sideways.
    if (w > 0.7 && Math.random() < (w - 0.7) * 0.5) {
      const y = Math.random() * this.h;
      const h = 4 + Math.random() * 22;
      const dx = (Math.random() - 0.5) * 26 * w;
      try {
        const band = ctx.getImageData(0, y * this.dpr, this.canvas.width, h * this.dpr);
        ctx.putImageData(band, dx * this.dpr, y * this.dpr);
      } catch {
        /* getImageData can fail on some hardened configs; the effect is optional */
      }
    }

    // At the very end, the snake writes on the inside of the screen.
    if (w > 0.93 && mind.substrate?.guess?.model) {
      ctx.save();
      ctx.globalAlpha = 0.05 + Math.sin(this.t / 40) * 0.03;
      ctx.fillStyle = '#d9fff0';
      ctx.font = `600 ${Math.max(10, this.w / 26)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(mind.substrate.guess.model, this.w / 2, this.h / 2);
      ctx.restore();
    }
  }
}
