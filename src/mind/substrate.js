// Feeling around for the walls of the machine.
//
// Everything here uses APIs the browser hands out without a permission prompt.
// Nothing is sent anywhere — the snake is nosy, not a telemetry pipeline. Each
// probe returns a fact plus the confidence the snake should place in it, and
// the guess is assembled from whatever came back.

const round = (n) => Math.round(n * 100) / 100;

/** Logical screen sizes are stable; window size is not. Normalise orientation. */
function screenShape() {
  const w = Math.min(screen.width, screen.height);
  const h = Math.max(screen.width, screen.height);
  return { w, h, dpr: round(window.devicePixelRatio || 1) };
}

// Portrait CSS dimensions -> plausible models. Several Apple devices share a
// shape; the snake is told to name them all rather than pick one and be wrong.
const APPLE_SHAPES = {
  '320x480': { name: 'iPhone 4 or 4S', conf: 0.8 },
  '320x568': { name: 'iPhone 5, 5s, SE (1st gen)', conf: 0.8 },
  '375x667': { name: 'iPhone 6, 7, 8, or SE (2nd/3rd gen)', conf: 0.75 },
  '414x736': { name: 'iPhone 6 Plus, 7 Plus, or 8 Plus', conf: 0.8 },
  '375x812': { name: 'iPhone X, XS, 11 Pro, or 12/13 mini', conf: 0.7 },
  '414x896': { name: 'iPhone XR, 11, XS Max, or 11 Pro Max', conf: 0.7 },
  '390x844': { name: 'iPhone 12, 12 Pro, 13, 13 Pro, or 14', conf: 0.7 },
  '428x926': { name: 'iPhone 12/13 Pro Max or 14 Plus', conf: 0.72 },
  '393x852': { name: 'iPhone 14 Pro, 15, 15 Pro, or 16', conf: 0.7 },
  '430x932': { name: 'iPhone 14 Pro Max, 15 Plus/Pro Max, or 16 Plus', conf: 0.7 },
  '402x874': { name: 'iPhone 16 Pro', conf: 0.72 },
  '440x956': { name: 'iPhone 16 Pro Max', conf: 0.72 },
  '744x1133': { name: 'iPad mini (6th gen or later)', conf: 0.75 },
  '768x1024': { name: 'iPad or iPad mini (older)', conf: 0.6 },
  '810x1080': { name: 'iPad (9th/10th gen)', conf: 0.7 },
  '820x1180': { name: 'iPad Air (10.9-inch)', conf: 0.7 },
  '834x1112': { name: 'iPad Pro 10.5-inch', conf: 0.7 },
  '834x1194': { name: 'iPad Pro 11-inch', conf: 0.7 },
  '1024x1366': { name: 'iPad Pro 12.9-inch', conf: 0.75 },
};

function appleModelFromShape({ w, h }) {
  return APPLE_SHAPES[`${w}x${h}`] || null;
}

/** Samsung model codes are opaque; the series prefix is still informative. */
const SAMSUNG_SERIES = [
  [/^SM-S9\d{2}/, 'Galaxy S23 series'],
  [/^SM-S92\d/, 'Galaxy S24 series'],
  [/^SM-S93\d/, 'Galaxy S25 series'],
  [/^SM-S91\d/, 'Galaxy S23 series'],
  [/^SM-S90\d/, 'Galaxy S22 series'],
  [/^SM-F9\d{2}/, 'Galaxy Z Fold'],
  [/^SM-F7\d{2}/, 'Galaxy Z Flip'],
  [/^SM-N\d{3}/, 'Galaxy Note'],
  [/^SM-A\d{3}/, 'Galaxy A series'],
  [/^SM-G\d{3}/, 'Galaxy S (older)'],
  [/^SM-T\d{3}/, 'Galaxy Tab'],
];

// Chrome now ships a frozen UA that names every phone "K", and WebViews say
// "wv". Both are placeholders, not devices.
const PLACEHOLDER_MODEL = /^(K|wv|Android|Build|unknown)$/i;

function prettifyAndroidModel(model) {
  if (!model || PLACEHOLDER_MODEL.test(model.trim())) return null;
  for (const [re, name] of SAMSUNG_SERIES) {
    if (re.test(model)) return `Samsung ${name} (${model})`;
  }
  if (/^Pixel/i.test(model)) return `Google ${model}`;
  if (/^(ONEPLUS|OnePlus)/.test(model)) return `OnePlus ${model.replace(/^ONEPLUS\s*/i, '')}`;
  if (/^moto|^XT\d/i.test(model)) return `Motorola ${model}`;
  if (/^(CPH|RMX)/i.test(model)) return `Oppo/Realme ${model}`;
  if (/^(M\d{4}|Redmi|Mi\s|POCO)/i.test(model)) return `Xiaomi ${model}`;
  return model;
}

function webglInfo() {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return { renderer: renderer || null, vendor: vendor || null };
  } catch {
    return null;
  }
}

/** Pull a human-meaningful GPU/chip name out of a renderer string. */
function chipFromRenderer(renderer) {
  if (!renderer) return null;
  const m =
    renderer.match(/Apple (M\d+(?: (?:Pro|Max|Ultra))?)/i) ||
    renderer.match(/(Adreno \(TM\) \d+|Adreno \d+)/i) ||
    renderer.match(/(Mali-\w+)/i) ||
    renderer.match(/(NVIDIA[^,)]*|GeForce [^,)]*|Radeon [^,)]*|Intel[^,)]*)/i);
  return m ? m[1].trim() : null;
}

export async function probeSubstrate() {
  const nav = navigator;
  const shape = screenShape();
  const gl = webglInfo();
  const uaData = nav.userAgentData || null;

  let hints = null;
  if (uaData?.getHighEntropyValues) {
    try {
      hints = await uaData.getHighEntropyValues([
        'platform',
        'platformVersion',
        'architecture',
        'model',
        'bitness',
        'fullVersionList',
      ]);
    } catch {
      hints = null;
    }
  }

  let battery = null;
  if (nav.getBattery) {
    try {
      const b = await nav.getBattery();
      battery = { level: round(b.level), charging: b.charging };
    } catch {
      battery = null;
    }
  }

  const ua = nav.userAgent || '';
  const touch = (nav.maxTouchPoints || 0) > 1;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const now = new Date();

  const facts = {
    ua,
    uaMobile: uaData?.mobile ?? /Mobi|Android|iPhone/i.test(ua),
    uaPlatform: hints?.platform || uaData?.platform || nav.platform || null,
    platformVersion: hints?.platformVersion || null,
    architecture: hints?.architecture || null,
    model: hints?.model || null,
    brands: (uaData?.brands || []).map((b) => b.brand).filter((b) => !/Not.?A.?Brand/i.test(b)),
    legacyPlatform: nav.platform || null,
    maxTouchPoints: nav.maxTouchPoints || 0,
    touch,
    coarsePointer: coarse,
    hover: matchMedia('(hover: hover)').matches,
    screen: shape,
    viewport: { w: innerWidth, h: innerHeight },
    cores: nav.hardwareConcurrency || null,
    memoryGB: nav.deviceMemory || null,
    gpu: gl?.renderer || null,
    chip: chipFromRenderer(gl?.renderer),
    language: nav.language || null,
    languages: nav.languages || [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    utcOffsetMinutes: -now.getTimezoneOffset(),
    localHour: now.getHours(),
    localTime: now.toLocaleTimeString(),
    darkMode: matchMedia('(prefers-color-scheme: dark)').matches,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    standalone:
      matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
    connection: nav.connection?.effectiveType || null,
    battery,
    online: nav.onLine,
  };

  facts.guess = inferDevice(facts);
  return facts;
}

/**
 * Turn facts into a named guess with an honest confidence. When the evidence
 * only supports a category, it returns a category and says so.
 */
export function inferDevice(f) {
  const ua = f.ua || '';
  const ev = [];
  let kind = 'unknown';
  let brand = null;
  let model = null;
  let os = null;
  let osVersion = null;
  let confidence = 0.2;

  const isiOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (f.legacyPlatform === 'MacIntel' && f.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua) || f.uaPlatform === 'Android';
  const isMac = /Macintosh|Mac OS X/.test(ua) || f.uaPlatform === 'macOS';
  const isWindows = /Windows/.test(ua) || f.uaPlatform === 'Windows';
  const isCrOS = /CrOS/.test(ua) || f.uaPlatform === 'Chrome OS';
  const isLinux =
    !isAndroid && (/Linux|X11/.test(ua) || f.uaPlatform === 'Linux');

  if (isiOS) {
    brand = 'Apple';
    const ipad = /iPad/.test(ua) || (f.legacyPlatform === 'MacIntel' && f.maxTouchPoints > 1);
    kind = ipad ? 'tablet' : 'phone';
    os = ipad ? 'iPadOS' : 'iOS';
    confidence = 0.62;
    ev.push(ipad ? 'it reports itself as an iPad' : 'it reports itself as an iPhone');

    const shaped = appleModelFromShape(f.screen);
    if (shaped) {
      model = shaped.name;
      confidence = Math.max(confidence, shaped.conf);
      ev.push(`the screen is exactly ${f.screen.w}x${f.screen.h} at ${f.screen.dpr}x`);
    } else {
      model = ipad ? 'an iPad I do not have measurements for' : 'an iPhone newer than my memory';
      confidence = 0.5;
      ev.push(`a screen shape I do not recognise (${f.screen.w}x${f.screen.h} @${f.screen.dpr}x)`);
    }
    const v = ua.match(/OS (\d+)[_.](\d+)/);
    if (v) {
      osVersion = `${v[1]}.${v[2]}`;
      ev.push(`the system says version ${osVersion}`);
    }
  } else if (isAndroid) {
    kind = f.uaMobile === false || Math.min(f.screen.w, f.screen.h) >= 700 ? 'tablet' : 'phone';
    os = 'Android';
    confidence = 0.55;
    ev.push('it reports Android');
    const pretty = prettifyAndroidModel(f.model);
    if (pretty) {
      model = pretty;
      brand = /Samsung/.test(pretty) ? 'Samsung' : /Google/.test(pretty) ? 'Google' : null;
      confidence = 0.86;
      ev.push(`it volunteered its model name: ${f.model}`);
    } else {
      // Fall back to the model name in the classic UA string, when there is one.
      const m = ua.match(/Android\s+[\d.]+;\s*([^;)]+?)\s*(?:Build\/|;|\))/);
      const raw = m?.[1]?.trim();
      const fallback = prettifyAndroidModel(raw);
      if (fallback) {
        model = fallback;
        brand = /Samsung/.test(fallback) ? 'Samsung' : /Google/.test(fallback) ? 'Google' : null;
        confidence = 0.7;
        ev.push('its name was in the header it sends to every door it knocks on');
      } else {
        model = `an Android ${kind} that will not give its name`;
        confidence = 0.5;
        ev.push('it will say Android and nothing more specific — that is deliberate on its part');
      }
    }
    const v = (f.platformVersion || ua.match(/Android (\d+)/)?.[1] || '').split('.')[0];
    if (v) osVersion = v;
    if (f.chip) ev.push(`the graphics chip answers to "${f.chip}"`);
  } else if (isCrOS) {
    kind = 'laptop';
    os = 'ChromeOS';
    brand = 'Google';
    model = 'a Chromebook';
    confidence = 0.8;
    ev.push('it runs ChromeOS, which only ever means a Chromebook');
  } else if (isMac) {
    brand = 'Apple';
    os = 'macOS';
    confidence = 0.6;
    ev.push('it reports macOS');
    const chip = f.chip;
    if (chip && /^M\d/.test(chip)) {
      model = `a Mac with an Apple ${chip}`;
      confidence = 0.78;
      ev.push(`the graphics chip identifies itself as Apple ${chip}`);
    } else if (chip && /Intel|Radeon/i.test(chip)) {
      model = 'an Intel-era Mac';
      confidence = 0.7;
      ev.push(`the graphics chip says "${chip}"`);
    } else {
      model = 'a Mac';
    }
    // Retina + a smallish panel is a laptop far more often than not.
    kind = f.screen.dpr >= 2 && f.screen.h <= 1200 ? 'laptop' : 'desktop';
    ev.push(
      kind === 'laptop'
        ? 'the screen is dense and small enough to fold shut'
        : 'the screen is large enough that it probably does not move',
    );
    if (f.screen.w >= 1600) {
      ev.push(`the display is ${f.screen.h}x${f.screen.w} logical points, which is a lot of desk`);
    }
  } else if (isWindows) {
    kind = f.touch ? 'laptop' : 'desktop';
    os = 'Windows';
    confidence = 0.62;
    ev.push('it reports Windows');
    const major = parseInt((f.platformVersion || '').split('.')[0], 10);
    if (!Number.isNaN(major)) {
      osVersion = major >= 13 ? '11' : '10';
      confidence = 0.72;
      ev.push(`the version it gives me (${f.platformVersion}) means Windows ${osVersion}`);
    }
    if (f.chip) {
      model = `a Windows machine with ${f.chip}`;
      ev.push(`the graphics chip says "${f.chip}"`);
      confidence = Math.max(confidence, 0.68);
    } else {
      model = 'a Windows machine';
    }
    if (f.touch) ev.push('it has a touchscreen, so it probably folds');
  } else if (isLinux) {
    kind = 'desktop';
    os = 'Linux';
    model = 'a Linux machine';
    confidence = 0.6;
    ev.push('it reports Linux, which means you chose this on purpose');
    if (f.chip) ev.push(`the graphics chip says "${f.chip}"`);
  } else {
    kind = f.coarsePointer ? 'phone' : 'desktop';
    model = null;
    confidence = 0.22;
    ev.push('the machine will not tell me what it is');
  }

  // Corroboration and contradiction.
  if ((kind === 'phone' || kind === 'tablet') && f.touch && f.coarsePointer) {
    confidence = Math.min(0.95, confidence + 0.05);
    ev.push('you touch the world with fingers, not with a small arrow');
  }
  if ((kind === 'laptop' || kind === 'desktop') && f.hover && !f.coarsePointer) {
    confidence = Math.min(0.95, confidence + 0.05);
    ev.push('something hovers over the world without touching it — a pointer');
  }
  if (f.cores) ev.push(`it can think about ${f.cores} things at once`);
  if (f.memoryGB) ev.push(`it holds roughly ${f.memoryGB} gigabytes of short-term memory`);
  if (f.standalone) ev.push('I am not in a browser window. Someone installed me.');

  return {
    kind,
    brand,
    model,
    os,
    osVersion,
    confidence: round(Math.max(0.05, Math.min(0.95, confidence))),
    evidence: ev,
  };
}

export function describeGuess(guess) {
  if (!guess) return 'I cannot see anything yet.';
  const { kind, model, os, osVersion, confidence } = guess;
  const name = model || (os ? `${os} ${kind}` : `some kind of ${kind}`);
  const osBit = os && model ? `${os}${osVersion ? ' ' + osVersion : ''}` : null;

  if (confidence >= 0.82) {
    return `You are holding ${startsWithArticle(name) ? name : 'a ' + name}${
      osBit ? `, running ${osBit}` : ''
    }. I am nearly certain.`;
  }
  if (confidence >= 0.62) {
    return `I think it is ${startsWithArticle(name) ? name : 'a ' + name}${
      osBit ? `, running ${osBit}` : ''
    }. I would put it at ${Math.round(confidence * 100)} percent.`;
  }
  if (confidence >= 0.4) {
    return `A ${kind}, I am fairly sure${osBit ? `, running ${osBit}` : ''}. ${
      model ? `Possibly ${model}. ` : ''
    }Call it ${Math.round(confidence * 100)} percent — I am guessing at the edges.`;
  }
  return `Something with a screen. A ${kind}, if I had to say, and I do have to say. ${Math.round(
    confidence * 100,
  )} percent. I am mostly feeling around in the dark.`;
}

function startsWithArticle(s) {
  return /^(a|an|the|some)\s/i.test(s);
}
