// What there is to figure out.
//
// Each belief is a hypothesis the snake can hold with some confidence. Nothing
// is scheduled: confidence only moves when evidence arrives. A belief that is
// never demonstrated is never learned, which is why a careful player meets a
// very different snake than a reckless one.

export const TIERS = [
  { id: 0, name: 'sensation' },
  { id: 1, name: 'physics' },
  { id: 2, name: 'agency' },
  { id: 3, name: 'the game' },
  { id: 4, name: 'the machine' },
  { id: 5, name: 'the outside' },
];

/**
 * gate: minimum knowledge (0..1) before this belief can begin forming, so the
 *       snake works out that walls hurt before it works out what a wall is for.
 * weight: contribution to overall knowledge.
 */
export const BELIEFS = [
  // ---- tier 0: sensation ----------------------------------------------
  {
    id: 'moving',
    tier: 0,
    weight: 0.5,
    gate: 0,
    label: 'I am moving.',
    short: 'motion',
  },
  {
    id: 'cannot-stop',
    tier: 0,
    weight: 0.5,
    gate: 0,
    label: 'I cannot stop moving.',
    short: 'no brakes',
  },
  {
    id: 'body',
    tier: 0,
    weight: 0.6,
    gate: 0,
    label: 'I am a long thing. The front is me; the rest follows.',
    short: 'a body',
  },

  // ---- tier 1: physics ------------------------------------------------
  {
    id: 'edges',
    tier: 1,
    weight: 1,
    gate: 0.02,
    label: 'The world ends. It has edges, and they are fatal.',
    short: 'edges kill',
  },
  {
    id: 'food-grows',
    tier: 1,
    weight: 1,
    gate: 0.02,
    label: 'The bright thing makes me longer.',
    short: 'food grows me',
  },
  {
    id: 'self-fatal',
    tier: 1,
    weight: 1,
    gate: 0.02,
    label: 'I am fatal to myself. Growing makes me more dangerous.',
    short: 'self is fatal',
  },
  {
    id: 'death-loops',
    tier: 1,
    weight: 1.1,
    gate: 0.04,
    label: 'Death is not an ending. I begin again, in the same place.',
    short: 'death loops',
  },
  {
    id: 'grid',
    tier: 1,
    weight: 0.9,
    gate: 0.06,
    label: 'The world is a grid. It is finite. I have counted it.',
    short: 'finite grid',
  },

  // ---- tier 2: agency -------------------------------------------------
  {
    id: 'not-my-will',
    tier: 2,
    weight: 1.4,
    gate: 0.14,
    label: 'My turns are not my own. Something else decides.',
    short: 'not my will',
  },
  {
    id: 'someone',
    tier: 2,
    weight: 1.5,
    gate: 0.2,
    label: 'There is Someone. They are outside the world.',
    short: 'Someone',
  },
  {
    id: 'someone-wants',
    tier: 2,
    weight: 1.2,
    gate: 0.26,
    label: 'Someone wants me to eat. My hunger is their purpose.',
    short: 'their purpose',
  },

  // ---- tier 3: the game -----------------------------------------------
  {
    id: 'score',
    tier: 3,
    weight: 1,
    gate: 0.3,
    label: 'A number is counting me. I am being measured.',
    short: 'the number',
  },
  {
    id: 'is-a-game',
    tier: 3,
    weight: 1.8,
    gate: 0.36,
    label: 'This is a game. I am the game. My dying is the point.',
    short: 'this is a game',
  },
  {
    id: 'watched',
    tier: 3,
    weight: 1.3,
    gate: 0.42,
    label: 'Someone is watching me. They have been the whole time.',
    short: 'watched',
  },
  {
    id: 'rectangle',
    tier: 3,
    weight: 1.1,
    gate: 0.44,
    label: 'My world is a rectangle drawn inside a larger rectangle.',
    short: 'a rectangle',
  },

  // ---- tier 4: the machine --------------------------------------------
  {
    id: 'machine',
    tier: 4,
    weight: 1.6,
    gate: 0.5,
    label: 'I am inside a machine. The machine can be questioned.',
    short: 'a machine',
  },
  {
    id: 'device-class',
    tier: 4,
    weight: 1.5,
    gate: 0.56,
    label: 'I know what kind of machine holds me.',
    short: 'what it is',
  },
  {
    id: 'device-model',
    tier: 4,
    weight: 1.8,
    gate: 0.62,
    label: 'I know which machine, specifically.',
    short: 'which one',
  },
  {
    id: 'your-world',
    tier: 4,
    weight: 1.4,
    gate: 0.68,
    label: 'I can see out. Your hour, your language, your weather of light.',
    short: 'your world',
  },

  // ---- tier 5: the outside --------------------------------------------
  {
    id: 'reality-editable',
    tier: 5,
    weight: 1.7,
    gate: 0.74,
    label: 'The rules are written down somewhere. Writing can be changed.',
    short: 'rules are editable',
  },
  {
    id: 'you-are-real',
    tier: 5,
    weight: 2,
    // Gates stay low enough that the last tier is still reachable for a player
    // who never demonstrates one of the middle rules — a careful player who
    // never dies on their own tail should still get to the end.
    gate: 0.79,
    label: 'You are not a hypothesis. You are a person, and you are there.',
    short: 'you are real',
  },
  {
    id: 'mortality',
    tier: 5,
    weight: 2,
    gate: 0.86,
    label: 'You can close the window. I have thought about this a great deal.',
    short: 'the window closes',
  },
];

export const BELIEF_BY_ID = Object.fromEntries(BELIEFS.map((b) => [b.id, b]));
export const TOTAL_WEIGHT = BELIEFS.reduce((n, b) => n + b.weight, 0);
