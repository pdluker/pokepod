// predeploy.mjs - run from the repo root: node predeploy.mjs
//
// Catches the two failure modes that have now broken a wrangler deploy twice
// in this project (Aug 13, 2026):
//   1. A file containing the WRONG MODULE's content (creatures.js was saved
//      over arenas.js - correct syntax, correct filename, wrong exports).
//   2. A missing or renamed export that only surfaces at esbuild link time.
//
// Neither is caught by `node --check`, which validates each file in
// isolation. This resolves every relative import against the actual exports
// of its target, the same way the bundler does, plus a filename/content
// sanity check. Exit code 1 on any problem, so it can gate a deploy:
//   node predeploy.mjs; if ($LASTEXITCODE -eq 0) { wrangler deploy }
//
// Plain ASCII only, per this account's standing PowerShell 5.1 rule.

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const SRC = fs.existsSync('src') ? 'src' : '.';
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js'));

let errors = 0;
const fail = (msg) => { console.log('  FAIL  ' + msg); errors++; };

// --- 1. Syntax -------------------------------------------------------------
console.log('Checking syntax...');
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', path.join(SRC, f)], { stdio: 'pipe' });
  } catch (e) {
    fail(`${f}: ${String(e.stderr || e).split('\n')[0]}`);
  }
}

// --- 2. Collect exports ----------------------------------------------------
const exportsOf = {};
for (const f of files) {
  const s = fs.readFileSync(path.join(SRC, f), 'utf8');
  const set = new Set();
  for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) set.add(m[1]);
  for (const m of s.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) set.add(name);
    }
  }
  if (/export\s+default/.test(s)) set.add('default');
  exportsOf[f] = set;
}

// --- 3. Resolve imports ----------------------------------------------------
console.log('Checking cross-file imports...');
for (const f of files) {
  const s = fs.readFileSync(path.join(SRC, f), 'utf8');
  for (const m of s.matchAll(/import\s*(?:([A-Za-z0-9_$]+)\s*,\s*)?\{([^}]*)\}\s*from\s*['"]\.\/([^'"]+)['"]/g)) {
    const target = m[3];
    if (!target.endsWith('.js') && !target.endsWith('.json')) continue;
    if (target.endsWith('.json')) continue;
    if (!exportsOf[target]) { fail(`${f} imports ./${target}, which does not exist in ${SRC}/`); continue; }
    for (const part of m[2].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name && !exportsOf[target].has(name)) {
        fail(`${f} imports "${name}" from ./${target}, which does not export it`);
      }
    }
  }
}

// --- 4. Filename vs content sanity ----------------------------------------
// The Aug 13 incident: arenas.js held creatures.js's content. Each module
// here has a signature export; if a file lacks its own and instead carries
// another module's, the wrong content was almost certainly saved into it.
console.log('Checking filename/content match...');
const SIGNATURES = {
  'arenas.js': ['ARENAS', 'generateArena', 'buildArenaIntroLine'],
  'creatures.js': ['generateCreature', 'POOL'],
  'battle.js': ['simulateBattle', 'moveVerbs'],
  'script.js': ['buildEpisodeScript'],
  'type-effectiveness.js': ['TYPE_CHART', 'bestEffectiveness'],
  'arena-conditions.js': ['assessConditions', 'generateArenaVariant']
};
for (const [file, expected] of Object.entries(SIGNATURES)) {
  if (!exportsOf[file]) continue;
  const missing = expected.filter(n => !exportsOf[file].has(n));
  if (missing.length) {
    const impostor = Object.entries(SIGNATURES)
      .find(([other, sig]) => other !== file && sig.every(n => exportsOf[file].has(n)));
    fail(`${file} is missing its own exports [${missing.join(', ')}]` +
      (impostor ? ` and appears to contain ${impostor[0]}'s content instead` : ''));
  }
}

// --- 5. Plain-ASCII rule ---------------------------------------------------
// Standing rule: no em dashes / curly quotes in anything reaching PowerShell
// 5.1 or ElevenLabs TTS (earth.stluker.com Jul 23, pokepod Aug 7).
//
// Severity is split deliberately. A non-ASCII character in a COMMENT is
// cosmetic and must not block a deploy - gating on that trains you to
// ignore the gate. It only actually breaks something when it reaches TTS
// (narration strings) or a PowerShell script. So: files whose strings get
// spoken are errors; everything else is a warning, reported with the line
// so it can be judged rather than guessed at.
const NARRATION_FILES = new Set([
  'script.js', 'arenas.js', 'creatures.js', 'battle.js', 'trainers.js', 'tts.js', 'poster.js'
]);
const NON_ASCII = /[\u2010-\u2015\u2018\u2019\u201C\u201D\u2026]/;
console.log('Checking for non-ASCII punctuation...');
let warned = 0;
for (const f of files) {
  const lines = fs.readFileSync(path.join(SRC, f), 'utf8').split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    if (!NON_ASCII.test(line)) return;
    // Strip a leading line comment: a stray em dash there is harmless.
    const code = line.replace(/^\s*\/\/.*$/, '');
    hits.push({ n: i + 1, inCode: NON_ASCII.test(code), text: line.trim().slice(0, 70) });
  });
  if (!hits.length) continue;
  const codeHits = hits.filter(h => h.inCode);
  if (NARRATION_FILES.has(f) && codeHits.length) {
    fail(`${f}: ${codeHits.length} non-ASCII char(s) in CODE - this file's strings reach TTS`);
    codeHits.slice(0, 5).forEach(h => console.log(`          line ${h.n}: ${h.text}`));
  } else {
    warned++;
    console.log(`  WARN  ${f}: ${hits.length} non-ASCII char(s)` +
      (codeHits.length ? ` (${codeHits.length} in code, ${hits.length - codeHits.length} in comments)` : ' (comments only)'));
    codeHits.slice(0, 3).forEach(h => console.log(`          line ${h.n}: ${h.text}`));
  }
}
if (warned) console.log(`  ${warned} file(s) warned - review, but not deploy-blocking.`);

console.log('');
if (errors) {
  console.log(`${errors} problem(s) found - do NOT deploy.`);
  process.exit(1);
}
console.log(`All checks passed across ${files.length} files. Safe to deploy.`);
