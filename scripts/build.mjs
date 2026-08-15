// Bundles the game into a single self-contained dist/index.html.
//
// The source is ES modules, which browsers refuse to load over file://. This
// inlines the CSS and flattens the modules into one classic script so the game
// can be opened by double-clicking it, mailed to someone, or dropped on any
// static host without a build step on the other end.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Dependency order: every module appears after everything it uses.
const MODULES = [
  'src/mind/beliefs.js',
  'src/mind/substrate.js',
  'src/mind/voice.js',
  'src/mind/mind.js',
  'src/engine/game.js',
  'src/engine/render.js',
  'src/engine/input.js',
  'src/ui/thoughts.js',
  'src/ui/knowledge.js',
  'src/main.js',
];

// mind.js does `import * as voice`, so the namespace object has to be rebuilt.
const VOICE_NAMESPACE = `
const voice = {
  AMBIENT, REACTIONS, DISCOVERY, PROBE_NARRATION,
  classLine, timeRemark, returningRemark, fill, ambient, reaction, glitch,
};
`;

/** Strip module syntax; everything ends up in one shared scope. */
function flatten(source) {
  return source
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export\s+(?=(const|let|var|function|async|class)\b)/gm, '')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
}

const css = await readFile(join(ROOT, 'styles/main.css'), 'utf8');
const html = await readFile(join(ROOT, 'index.html'), 'utf8');

const parts = [];
for (const file of MODULES) {
  const code = flatten(await readFile(join(ROOT, file), 'utf8'));
  parts.push(`\n/* ===== ${file} ===== */\n${code}`);
  if (file.endsWith('voice.js')) parts.push(VOICE_NAMESPACE);
}

const bundle = `(function () {\n'use strict';\n${parts.join('\n')}\n})();`;

const out = html
  .replace(
    /<link rel="stylesheet" href="\.\/styles\/main\.css" \/>/,
    `<style>\n${css}\n</style>`,
  )
  .replace(
    /<script type="module" src="\.\/src\/main\.js"><\/script>/,
    `<script>\n${bundle}\n</script>`,
  );

// Check the tags, not the text: the section markers below mention the paths.
if (/<link[^>]+stylesheet/.test(out) || /<script[^>]+\bsrc=/.test(out)) {
  throw new Error('bundling failed: the page still references external files');
}

await mkdir(join(ROOT, 'dist'), { recursive: true });
await writeFile(join(ROOT, 'dist/index.html'), out);
console.log(`dist/index.html — ${(out.length / 1024).toFixed(1)} kB, no external files`);
