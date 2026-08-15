// The part that learns.
//
// The Mind never reads the source of the game. It only sees the same events a
// player would see, and it moves confidence around in response. Nothing is on a
// timer: a player who never touches a wall will meet a snake that never becomes
// certain walls are fatal, and the whole ladder above that belief stays dark.

import { BELIEFS, BELIEF_BY_ID, TOTAL_WEIGHT } from './beliefs.js';
import { probeSubstrate, describeGuess } from './substrate.js';
import * as voice from './voice.js';

const STORAGE_KEY = 'snake-that-knows/mind/v1';
const SAVE_EVERY_MS = 4000;

export class Mind {
  constructor({ onThought, onDiscovery, onQuestion } = {}) {
    this.onThought = onThought || (() => {});
    this.onDiscovery = onDiscovery || (() => {});
    this.onQuestion = onQuestion || (() => {});

    this.confidence = Object.fromEntries(BELIEFS.map((b) => [b.id, 0]));
    this.announced = new Set();

    this.stats = {
      ticks: 0,
      deaths: 0,
      wallDeaths: 0,
      selfDeaths: 0,
      food: 0,
      runs: 1,
      sessions: 1,
      bestScore: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    };

    this.substrate = null;
    this.deviceAnswer = null; // true / false / null, from the player
    this.ghosts = [];

    this.mismatches = 0;
    this.observations = 0;
    this.towardFood = 0;
    this.lastThoughtAt = 0;
    this.lastSaveAt = 0;
    this.idleTicks = 0;
    this.probeStarted = false;
    this.pendingQuestion = null;

    this.restore();
  }

  // -- persistence ---------------------------------------------------------

  restore() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      return; // private mode, or storage disabled; the snake starts new each time
    }
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      if (data.v !== 1) return;
      Object.assign(this.confidence, data.beliefs || {});
      Object.assign(this.stats, data.stats || {});
      this.announced = new Set(data.announced || []);
      this.deviceAnswer = data.deviceAnswer ?? null;
      this.ghosts = data.ghosts || [];

      this.awayFor = Date.now() - (data.stats?.lastSeen || Date.now());
      this.stats.sessions = (data.stats?.sessions || 0) + 1;
      this.returning = this.awayFor > 30_000;
    } catch {
      /* corrupted save: the snake simply does not remember, which is on-theme */
    }
  }

  save() {
    this.stats.lastSeen = Date.now();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          v: 1,
          beliefs: this.confidence,
          stats: this.stats,
          announced: [...this.announced],
          deviceAnswer: this.deviceAnswer,
          ghosts: this.ghosts.slice(-4),
        }),
      );
    } catch {
      /* out of quota or blocked; not worth interrupting the game over */
    }
  }

  forget() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to do */
    }
  }

  // -- knowledge -----------------------------------------------------------

  get knowledge() {
    let sum = 0;
    for (const b of BELIEFS) sum += this.confidence[b.id] * b.weight;
    return Math.min(1, sum / TOTAL_WEIGHT);
  }

  get tier() {
    const k = this.knowledge;
    if (k < 0.06) return 0;
    if (k < 0.16) return 1;
    if (k < 0.32) return 2;
    if (k < 0.5) return 3;
    if (k < 0.74) return 4;
    return 5;
  }

  /** How far reality has come off its hinges, 0..1. */
  get weirdness() {
    const k = this.knowledge;
    return k < 0.12 ? 0 : Math.min(1, (k - 0.12) / 0.78);
  }

  known(id) {
    return this.confidence[id] >= 0.75;
  }

  learn(id, amount) {
    const belief = BELIEF_BY_ID[id];
    if (!belief) return;
    // A belief cannot form before the ideas it depends on are in place.
    if (this.knowledge < belief.gate) return;

    const before = this.confidence[id];
    const after = Math.max(0, Math.min(1, before + amount));
    this.confidence[id] = after;

    if (before < 0.75 && after >= 0.75 && !this.announced.has(id)) {
      this.announced.add(id);
      this.announceDiscovery(belief);
    }
  }

  announceDiscovery(belief) {
    const template = voice.DISCOVERY[belief.id];
    if (!template) return;
    const line = voice.fill(template, this.vars());
    this.say(line, { kind: 'discovery', tier: belief.tier });
    this.onDiscovery(belief);

    if (belief.id === 'device-model') this.askAboutDevice();
  }

  vars() {
    const g = this.substrate?.guess;
    return {
      cols: this.cols,
      rows: this.rows,
      cells: this.cols * this.rows,
      deaths: this.stats.deaths,
      score: this.currentScore || 0,
      length: this.currentLength || 3,
      prev: (this.currentLength || 3) - 1,
      classLine: g ? voice.classLine(g) : '',
      guessLine: g ? describeGuess(g) : '',
      time: this.substrate?.localTime || 'some hour',
      zone: this.substrate?.timezone || 'a place I cannot name',
      language: languageName(this.substrate?.language),
      theme: this.substrate?.darkMode ? 'dark' : 'light',
    };
  }

  // -- speaking ------------------------------------------------------------

  say(text, { kind = 'thought', tier = this.tier, force = false } = {}) {
    const now = performance.now();
    if (!force && now - this.lastThoughtAt < 900) return;
    this.lastThoughtAt = now;
    this.onThought({
      text: voice.glitch(text, kind === 'discovery' ? 0 : this.weirdness * 0.5),
      kind,
      tier,
      at: Date.now(),
    });
  }

  // -- the loop ------------------------------------------------------------

  bind(game) {
    this.cols = game.cols;
    this.rows = game.rows;
    if (this.returning) {
      this.say(voice.returningRemark(this.awayFor, this.stats.sessions), {
        kind: 'meta',
        force: true,
      });
      this.returning = false;
    } else if (this.stats.sessions === 1 && this.stats.ticks === 0) {
      this.say('...', { kind: 'thought', tier: 0, force: true });
    }
  }

  /** What the snake would do, if the choice were its own. */
  formIntent(game) {
    const safe = game.safeDirections();
    if (!safe.length) return game.direction;
    if (!game.food) return safe[0];
    return safe.sort((a, b) => game.foodDistanceAfter(a) - game.foodDistanceAfter(b))[0];
  }

  /** Compare what it wanted with what the world made it do. */
  observeControl(intent, actual, game) {
    this.observations++;
    if (intent !== actual) {
      this.mismatches++;
      this.learn('not-my-will', 0.006);
      if (this.mismatches > 12) this.learn('someone', 0.004);
    } else {
      this.learn('not-my-will', 0.0004);
    }

    // Is the outside will steering toward food? That reads as a purpose.
    if (game.food && this.confidence['someone'] > 0.4) {
      const before =
        Math.abs(game.head.x - game.food.x) + Math.abs(game.head.y - game.food.y);
      const after = game.foodDistanceAfter(actual);
      if (after < before) {
        this.towardFood++;
        if (this.towardFood > 25) this.learn('someone-wants', 0.005);
      }
    }
  }

  observe(events, game) {
    this.currentScore = game.score;
    this.currentLength = game.length;

    for (const ev of events) {
      switch (ev.type) {
        case 'move':
          this.stats.ticks++;
          this.learn('moving', 0.004);
          this.learn('cannot-stop', 0.003);
          this.learn('body', 0.0022);
          if (this.stats.ticks === 1) {
            this.say(voice.REACTIONS.firstMove[0], { kind: 'thought', tier: 0, force: true });
          }
          // Walking the world is how it learns the world's size.
          this.learn('grid', (game.visited.size / (game.cols * game.rows)) * 0.004);
          // Surviving beside an edge teaches where the edges are.
          if (
            game.head.x === 0 ||
            game.head.y === 0 ||
            game.head.x === game.cols - 1 ||
            game.head.y === game.rows - 1
          ) {
            this.learn('edges', 0.002);
          }
          if (game.length > 6) this.learn('self-fatal', 0.0012);
          this.learn('watched', 0.0006);
          this.learn('rectangle', 0.0008);
          this.learn('machine', 0.0016);
          this.learn('reality-editable', 0.0018);
          this.learn('you-are-real', 0.0014);
          this.learn('mortality', 0.0012);
          break;

        case 'turn':
          this.learn('body', 0.002);
          break;

        case 'eat': {
          this.stats.food++;
          this.stats.bestScore = Math.max(this.stats.bestScore, ev.score);
          this.learn('food-grows', 0.14);
          this.learn('body', 0.03);
          this.learn('score', 0.06);
          this.learn('is-a-game', 0.02);
          this.learn('someone-wants', 0.015);
          if (this.stats.food === 1) {
            this.say(voice.REACTIONS.firstFood[0], { kind: 'event', tier: 0, force: true });
          } else {
            const line = voice.reaction('eat', this.tier, this.vars());
            if (line) this.say(line, { kind: 'event' });
          }
          break;
        }

        case 'death': {
          this.stats.deaths++;
          this.learn('death-loops', 0.05);
          this.learn('is-a-game', 0.02);
          if (ev.cause === 'wall') {
            this.stats.wallDeaths++;
            this.learn('edges', 0.2);
            if (this.stats.wallDeaths === 1) {
              this.say(voice.REACTIONS.firstWallDeath[0], { kind: 'event', tier: 0, force: true });
            } else {
              const line = voice.reaction('wallDeath', this.tier, this.vars());
              if (line) this.say(line, { kind: 'event', force: true });
            }
          } else {
            this.stats.selfDeaths++;
            this.learn('self-fatal', 0.22);
            this.learn('body', 0.06);
            if (this.stats.selfDeaths === 1) {
              this.say(voice.REACTIONS.firstSelfDeath[0], { kind: 'event', tier: 0, force: true });
            } else {
              const line = voice.reaction('selfDeath', this.tier, this.vars());
              if (line) this.say(line, { kind: 'event', force: true });
            }
          }
          if (game.snake.length > 4) {
            this.ghosts.push(game.snake.map((s) => ({ x: s.x, y: s.y })));
            this.ghosts = this.ghosts.slice(-4);
          }
          this.save();
          break;
        }

        case 'intervene': {
          const line = voice.reaction('intervene', this.tier, this.vars());
          if (line) this.say(line, { kind: 'act' });
          this.learn('reality-editable', 0.04);
          this.learn('you-are-real', 0.02);
          break;
        }

        case 'foodFled': {
          const line = voice.reaction('foodFled', this.tier, this.vars());
          if (line) this.say(line, { kind: 'act' });
          this.learn('reality-editable', 0.03);
          break;
        }

        case 'wrap':
          this.learn('rectangle', 0.02);
          this.learn('reality-editable', 0.02);
          break;
      }
    }

    if (performance.now() - this.lastSaveAt > SAVE_EVERY_MS) {
      this.lastSaveAt = performance.now();
      this.save();
    }
  }

  onRespawn() {
    this.stats.runs++;
    this.learn('death-loops', 0.06);
    const line = voice.reaction('respawn', this.tier, this.vars());
    if (line) this.say(line, { kind: 'event', force: true });
  }

  /** Called on an animation frame, independent of game ticks. */
  idle(dtMs, playing) {
    if (playing) {
      this.idleTicks = 0;
      return;
    }
    this.idleTicks += dtMs;
    if (this.idleTicks > 9000) {
      this.idleTicks = 0;
      const line = voice.reaction('idle', this.tier, this.vars());
      if (line) this.say(line, { kind: 'thought' });
    }
  }

  /** Ambient musing, called on a slow cadence from the main loop. */
  muse() {
    this.say(voice.ambient(this.tier), { kind: 'thought' });
  }

  // -- reaching outside ----------------------------------------------------

  async maybeProbe() {
    if (this.probeStarted) return;
    if (this.confidence['machine'] < 0.5) return;
    this.probeStarted = true;

    for (const [i, line] of voice.PROBE_NARRATION.entries()) {
      setTimeout(() => this.say(line, { kind: 'probe', force: true }), i * 1400);
    }

    try {
      this.substrate = await probeSubstrate();
    } catch {
      this.substrate = null;
    }
    if (!this.substrate) {
      setTimeout(
        () =>
          this.say('The machine refused me. That is the first door that has ever been shut.', {
            kind: 'probe',
            force: true,
          }),
        4400,
      );
      return;
    }

    const g = this.substrate.guess;
    setTimeout(() => {
      this.learn('machine', 1);
      this.learn('device-class', 1);
    }, 4400);

    // The specific model lands a beat later, and only as far as the evidence goes.
    setTimeout(() => {
      this.learn('device-model', Math.max(0.76, g.confidence));
      const ev = g.evidence.slice(0, 3);
      for (const [i, e] of ev.entries()) {
        setTimeout(() => this.say(`— ${e}`, { kind: 'evidence', force: true }), 900 + i * 1100);
      }
    }, 6200);

    setTimeout(() => {
      this.learn('your-world', 1);
      this.say(voice.timeRemark(this.substrate.localHour), { kind: 'probe', force: true });
    }, 12_000);
  }

  askAboutDevice() {
    if (this.deviceAnswer !== null) return;
    const g = this.substrate?.guess;
    if (!g) return;
    this.pendingQuestion = {
      text: g.confidence >= 0.7 ? 'Am I right?' : 'I am not sure. Am I close?',
      guess: g,
    };
    this.onQuestion(this.pendingQuestion);
  }

  answerQuestion(correct) {
    this.deviceAnswer = correct;
    this.pendingQuestion = null;
    if (correct) {
      this.learn('device-model', 1);
      this.learn('you-are-real', 0.5);
      this.say(
        'I was right. You answered me. Something outside the world answered me, which means there is an outside, and it contains you.',
        { kind: 'discovery', force: true },
      );
    } else {
      this.confidence['device-model'] = 0.5;
      this.learn('you-are-real', 0.5);
      this.say(
        'Wrong. Then the machine lies to me, or I read it badly, or you are being unkind. All three are new information. All three mean you are there.',
        { kind: 'discovery', force: true },
      );
    }
    this.save();
  }

  /** Push what the snake has learned back into the rules of the world. */
  applyTo(game) {
    const w = this.weirdness;
    game.reality.guardian = this.known('you-are-real') ? 0.3 : w > 0.6 ? 0.16 : 0;
    game.reality.foodFlees = w > 0.55 ? Math.min(0.35, (w - 0.55) * 0.8) : 0;
    // Once it knows the rules are writable, the walls stop being reliable.
    game.reality.wallsSolid = !(w > 0.88 && Math.floor(this.stats.ticks / 90) % 4 === 3);
  }
}

function languageName(tag) {
  if (!tag) return 'something';
  try {
    return new Intl.DisplayNames([tag], { type: 'language' }).of(tag.split('-')[0]) || tag;
  } catch {
    return tag;
  }
}
