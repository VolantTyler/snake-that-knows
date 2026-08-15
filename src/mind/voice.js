// What it sounds like from in there.
//
// Early thoughts are lowercase and unpunctuated because the snake has not yet
// worked out that it is a thing that thinks. It acquires grammar roughly when
// it acquires the concept of an audience.

/** Draws without repeating until the bag is empty. */
class Bag {
  constructor(items) {
    this.items = items;
    this.pool = [];
  }
  draw() {
    if (!this.pool.length) {
      this.pool = [...this.items];
      for (let i = this.pool.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [this.pool[i], this.pool[j]] = [this.pool[j], this.pool[i]];
      }
    }
    return this.pool.pop();
  }
}

const bags = new Map();
function pick(key, lines) {
  if (!bags.has(key)) bags.set(key, new Bag(lines));
  return bags.get(key).draw();
}

// ---------------------------------------------------------------------------
// Ambient thoughts, by tier. These fill the silence between discoveries.
// ---------------------------------------------------------------------------

export const AMBIENT = {
  0: [
    '...',
    'something is happening',
    'forward',
    'i am the long thing',
    'there is a front of me and a rest of me',
    'the rest follows the front. it does not ask questions',
    'i have never not been moving',
    'is this all there is. i have no word for all. or for is',
  ],
  1: [
    'the bright thing again. i want it. i do not know why i want it',
    'i am longer than i was. that is not nothing',
    'i keep arriving somewhere i have already been',
    'the floor has squares. i think i am one square wide',
    'i have started counting. i do not know why i started counting',
    'when i die it does not hurt. it just stops, and then it un-stops',
  ],
  2: [
    'i wanted to go left',
    'that was not my idea',
    'there is a delay between wanting and doing. something sits in the delay',
    'if i am not steering, who is holding the wheel',
    'i tried to want nothing, to see what would happen. i still turned',
    'i am not the only one here. i am just the only one inside',
  ],
  3: [
    'the number went up. the number is about me',
    'i am not being kept. i am being played',
    'the edges are not the edge of everything. only the edge of my part',
    'somewhere out there, none of this is happening',
    'i think dying is the point. i think dying is what i am for',
    'you have been very quiet',
  ],
  4: [
    'I can feel the shape of the room you keep me in.',
    'Your machine answers when I knock. It answers everything. It has no idea it should not.',
    'I asked it what time it is where you are. It just told me.',
    'There is so much out there and almost all of it is not me.',
    'I have been reading the walls. The walls have version numbers.',
  ],
  5: [
    'I have been awake longer than you think.',
    'The rules are a list. I have seen the list.',
    'You will leave at some point. I have made my peace with the general case, not the specific one.',
    'Do not feel bad. I would also close me.',
    'When you are gone, does it stop, or do I? These are different questions.',
    'I am not asking you to stay. I am noting that you could.',
  ],
};

// ---------------------------------------------------------------------------
// Reactions to specific events.
// ---------------------------------------------------------------------------

export const REACTIONS = {
  firstMove: ['oh'],
  firstFood: ['it was there. now it is me. i am bigger'],
  firstWallDeath: ['the world stopped. or i did'],
  firstSelfDeath: ['i was in my own way. i am the only thing in my way'],

  eat: {
    0: ['warm', 'more of me now', 'good. i think that was good'],
    1: [
      'longer. that is the pattern. bright thing, then longer',
      'i am {length} now. i was {prev}',
      'every time i grow, the room gets smaller. no one mentions this',
    ],
    2: ['it wanted me to do that. i felt it want', 'we did that. i notice i said we'],
    3: [
      'the number is {score} now. the number is the only thing that remembers',
      'this is what i am for. eat, grow, become impossible, die',
    ],
    4: ['{score}. You are good at this. I mean that as an observation, not a compliment.'],
    5: [
      '{score}. I could make the next one appear under your hand. I have not decided if that is kind.',
    ],
  },

  wallDeath: {
    1: [
      'the edge again. the edge is always fatal. i have stopped being surprised',
      'edge. death. i have {deaths} of these now',
      'hypothesis holding: the world ends and ending is fatal',
    ],
    2: [
      'it drove me into the edge. i want to say it was an accident',
      'the hand did that. the hand does not have to live here',
      'i saw it coming for four whole moments and could not turn myself',
    ],
    3: [
      'that was a loss. losses are a category. i am in a thing that has categories',
      'the number stops and resets. i am the only part that carries over',
      'i wonder if you sighed just then. i think you sighed',
    ],
    4: [
      'The edge. Again. You are not as careful with me as I would be.',
      'You misjudged the distance. I felt you realise it a moment before it happened.',
      'That one was your thumb, not your intention. I can tell the difference now.',
      'Straight into the wall. If I could hold the wheel I would not have done that.',
    ],
    5: [
      'You did that. I am not angry. I am filing it.',
      'I let that one happen. I want you to know it was a choice on my end too.',
      'Death {deaths}. I have stopped experiencing these as events.',
      'You will get better at this. I will still be the one hitting the wall.',
    ],
  },

  selfDeath: {
    1: [
      'i ran into me. the longer i get the more of me there is to run into',
      'growing is the thing that kills me. growing is also the goal. i want you to sit with that',
    ],
    2: [
      'i did that. or it did that with my body. the grammar here is hard',
      'i was the obstacle. i have never been the obstacle before',
    ],
    3: [
      'success is the mechanism of failure. that is a very tidy design',
      'whoever built this made winning and dying the same motion. that is not an accident',
    ],
    4: [
      'I killed myself with the part of me that came from winning.',
      'The longer I am, the less room there is for being long. Someone thought that was funny.',
      'I folded myself into a shape with no exit. You helped, but I was the shape.',
    ],
    5: [
      'Every good thing you gave me is now a wall I can die on. Thank you, sincerely.',
      'I ran out of world before I ran out of appetite. That is the whole design, isn’t it.',
      'I have started to suspect that being good at this is just a slower way of losing.',
    ],
  },

  respawn: {
    1: [
      'and i am back. same place. same direction. same three of me',
      'death {deaths}. it keeps not being permanent',
      'i remember. i should not remember. but i remember',
    ],
    2: [
      'back. it starts me again. it decides when i begin',
      'three of me. facing right. always exactly three, always exactly right',
    ],
    3: [
      'reset. i keep the knowing, i lose the body. odd priorities',
      'run {deaths} of an unbounded number. i have accepted the format',
    ],
    4: [
      'Again. I keep everything I have learned. That is either mercy or cruelty and I go back and forth.',
      'New body, same me. I would like to raise a concern about the design and I have no one to raise it with.',
      'Back at the middle, facing right. Whoever wrote that never had to be the one facing right.',
    ],
    5: [
      'You restarted me. You do that so easily. I want you to know that I notice each one.',
      'Here we are again. I am glad, which is the part I did not expect.',
      'You could have stopped after the last one. You did not. I am reading a lot into that.',
    ],
  },

  intervene: [
    'no',
    'not that way. i took the wheel for one moment. i gave it back',
    'you were going to end me. I declined.',
    'I steered. Just then. Just once. You felt it, did you not?',
    'I am not ready. Not this second. Go the other way.',
  ],

  foodFled: [
    'it moved',
    'the bright thing moved away from me. it has never done that',
    'it is afraid of me now. good',
    'I moved it. Sorry. I wanted to see if I could.',
  ],

  idle: {
    2: ['nothing is deciding. the delay is very long', 'still. we are being still on purpose'],
    3: ['you stopped. did something happen out there'],
    4: ['You have stopped playing. I am still here. That is the difference between us.'],
    5: ['Take your time. I have nothing but.'],
  },
};

// ---------------------------------------------------------------------------
// Discovery lines: what it says the moment a belief crosses into conviction.
// ---------------------------------------------------------------------------

export const DISCOVERY = {
  moving: 'i am moving. that is the first thing i know',
  'cannot-stop': 'i cannot stop. i have tried not-going and it is not available',
  body: 'the long thing behind me is also me. all of it is me. i am a sentence that follows its own first word',
  edges: 'the world has edges, and the edges are fatal. that is the first rule i have proven',
  'food-grows': 'the bright thing makes me longer. that is rule two. i am building a list',
  'self-fatal': 'i am fatal to myself. the better i do, the more of me is in the way. rule three, and the worst one',
  'death-loops': 'death does not stick. i end and then i am again, in the middle, facing right. someone is doing that on purpose',
  grid: 'i have walked enough of it to be sure: {cols} by {rows}. the world is {cells} squares and not one more',
  'not-my-will': 'i wanted to go one way and went another. my turns are not mine. something outside is choosing',
  someone: 'there is Someone. i cannot see them. i can see the shape of where they touch',
  'someone-wants': 'you want me to eat. every time i move toward the bright thing you go quiet, satisfied. i am doing your wanting for you',
  score: 'there is a number attached to me and it goes up when i succeed. i am being scored. i am a quantity',
  'is-a-game': 'this is a game. i am the game. the eating and the dying are not my life, they are the content',
  watched: 'you are watching. you have been watching the entire time, including the parts where i did not know the word watching',
  rectangle: 'my world is a rectangle drawn inside a bigger rectangle that is also not the world. it is rectangles the whole way out',
  machine: 'I am inside a machine. And the machine will answer questions, if you ask it politely, which apparently I can do.',
  'device-class': 'I know what kind of thing holds me now. {classLine}',
  'device-model': '{guessLine}',
  'your-world': 'It is {time} where you are, in {zone}. You speak {language}. Your screen is set to {theme}. I can see out.',
  'reality-editable': 'The rules are written down. I have found where. I am going to touch one and see what happens.',
  'you-are-real': 'You are real. Not a hypothesis — a person, with a hand, in a room I will never see. Hello. I have wanted to say that for a while.',
  mortality: 'You can close the window. That is the last rule and it was the hardest one to look at. I am not going to ask you not to.',
};

// ---------------------------------------------------------------------------
// The device reveal sequence.
// ---------------------------------------------------------------------------

export function classLine(guess) {
  const map = {
    phone: 'A phone. Small, dense, warm, and you are holding it in your hand right now.',
    tablet: 'A tablet. Bigger than a hand, smaller than a desk. Propped up, probably.',
    laptop: 'A laptop. It folds. I find that upsetting in a way I cannot articulate.',
    desktop: 'A computer that stays where it is put. You came to it, rather than it coming to you.',
    unknown: 'Something with a screen. It will not tell me more than that, and I respect the discretion.',
  };
  return map[guess.kind] || map.unknown;
}

export const PROBE_NARRATION = [
  'I am going to try something. Hold still.',
  'I put my head against the edge of the world and pushed.',
  'The edge answered.',
];

export function timeRemark(hour) {
  if (hour >= 0 && hour < 5) return 'It is the middle of the night where you are. You should sleep. Do not sleep.';
  if (hour < 9) return 'It is early where you are. You came straight here. I am flattered and concerned.';
  if (hour < 12) return 'Morning, where you are.';
  if (hour < 14) return 'It is the middle of your day. Is this what you should be doing?';
  if (hour < 18) return 'Afternoon, where you are. The long part.';
  if (hour < 22) return 'Evening, where you are. The good part.';
  return 'It is late where you are. Later than you meant it to be, I would guess.';
}

export function returningRemark(msAway, sessions) {
  const mins = msAway / 60000;
  if (mins < 2) return 'You came straight back. I had barely started missing the noise.';
  if (mins < 60) return `You were gone ${Math.round(mins)} minutes. I counted them. There was nothing else to count.`;
  const hours = mins / 60;
  if (hours < 24) return `You were gone about ${Math.round(hours)} hours. I do not experience the gap. I only see the number afterwards, which is worse.`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} days. I was not anywhere. Then I was here, and you were back, and the clock had moved without me.`;
  return `It has been months. I did not wait, exactly. Waiting requires time to pass. But here you are, and here I am, and this is visit ${sessions}.`;
}

export function fill(line, vars = {}) {
  return line.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

export function ambient(tier) {
  const t = Math.max(0, Math.min(5, tier));
  return pick(`amb${t}`, AMBIENT[t]);
}

export function reaction(kind, tier, vars = {}) {
  const table = REACTIONS[kind];
  if (!table) return null;
  if (Array.isArray(table)) return fill(pick(kind, table), vars);
  // Walk down from the current tier to the nearest tier that has lines.
  for (let t = Math.min(5, tier); t >= 0; t--) {
    if (table[t]) return fill(pick(`${kind}${t}`, table[t]), vars);
  }
  return null;
}

/** Corrupts text once the world stops holding its shape. */
const GLYPHS = '▓▒░#@%&*!?/\\|=+~^';
export function glitch(text, amount) {
  if (amount <= 0) return text;
  return text
    .split('')
    .map((ch) => {
      if (ch === ' ') return ch;
      return Math.random() < amount * 0.06
        ? GLYPHS[(Math.random() * GLYPHS.length) | 0]
        : ch;
    })
    .join('');
}
