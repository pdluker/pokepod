// creatures.js - real-Pokemon generator, matching the ACTUAL schema
// index.js and script.js expect (primaryType/secondaryType with
// color+emoji, a real ability, height/weight, stats.{hp,attack,defense,speed}).
//
// Replaces the original fictional generator (habitat/behavior/trait/power
// templates -> "...it has captivated researchers for generations.") with
// real species pulled from pokemon-pool-final.json.
//
// Fixed 2026-08-07 (deploy failure): this file originally used Node's
// fs/path + require() to load the pool at runtime - that fails in
// Cloudflare Workers (no real filesystem, and the rest of this codebase
// is ES modules, not CommonJS - index.js/script.js/battle.js/arenas.js/
// trainers.js/megaEvolution.js all use import/export already). Now
// imports the JSON directly so esbuild/wrangler bundles it into the
// Worker at build time - no runtime file access needed at all, and no
// nodejs_compat flag required.

import POOL from './pokemon-pool-final.json';

const TYPE_COLORS = {
  Normal: '#A8A77A', Fire: '#EE8130', Water: '#6390F0', Electric: '#F7D02C',
  Grass: '#7AC74C', Ice: '#96D9D6', Fighting: '#C22E28', Poison: '#A33EA1',
  Ground: '#E2BF65', Flying: '#A98FF3', Psychic: '#F95587', Bug: '#A6B91A',
  Rock: '#B6A136', Ghost: '#735797', Dragon: '#6F35FC', Dark: '#705746',
  Steel: '#B7B7CE', Fairy: '#D685AD'
};
const TYPE_EMOJIS = {
  Normal: '⚪', Fire: '🔥', Water: '💧', Electric: '⚡', Grass: '🌿', Ice: '❄️',
  Fighting: '🥊', Poison: '☠️', Ground: '⛰️', Flying: '🌪️', Psychic: '🔮',
  Bug: '🐛', Rock: '🪨', Ghost: '👻', Dragon: '🐉', Dark: '🌑', Steel: '⚙️', Fairy: '✨'
};

// script.js's abilityInsights bank only has commentary for a fixed list of
// abilities. Preferring those (when the real Pokemon has one as an option)
// gives richer commentary; otherwise we fall back to any real ability and
// script.js's generic fallback line still handles it fine.
const KNOWN_ABILITIES = new Set([
  'Blaze', 'Torrent', 'Overgrow', 'Static', 'Intimidate', 'Levitate',
  'Flash Fire', 'Water Absorb', 'Volt Absorb', 'Pressure', 'Thick Fat',
  'Adaptability', 'Swift Swim', 'Regenerator', 'Magic Guard', 'Multiscale',
  'Sturdy', 'Iron Fist', 'Sheer Force', 'Prism Armor', 'Unaware', 'Moxie',
  'Sand Veil', 'Snow Cloak', 'Poison Heal', 'Rough Skin', 'Tinted Lens', 'Wonder Skin'
]);

// Real color/silhouette conventions per type, described generically - no
// reference to any specific existing character design. Feeds
// visualDescription below, which poster.js's image-generation prompt
// consumes directly (poster.js was never touched by the Pokemon-authenticity
// fix - this field was simply missing, so every poster prompt since then
// has silently contained the literal string "undefined").
const TYPE_VISUAL_STYLE = {
  Fire: 'warm orange-and-red coloring, faint ember glow along its edges, a lean predatory build',
  Water: 'deep blue-and-teal coloring, a sleek streamlined body built for speed through water',
  Grass: 'vivid green coloring with leaf-like or vine-like accents, a sturdy rooted stance',
  Electric: 'bright yellow coloring with dark accent stripes, a compact build crackling with static energy',
  Ice: 'pale blue-white coloring, faint frost crystals forming at its extremities',
  Fighting: 'muscular humanoid build, earthy red-brown coloring, a combat-ready stance',
  Poison: 'deep purple coloring with darker mottled patterns, an unsettling toxic sheen',
  Ground: 'sandy tan-and-brown coloring, a low powerful stance built for digging',
  Flying: 'wide feathered or membranous wings, light coloring built for aerial grace',
  Psychic: 'pastel pink-and-lavender coloring, an aura of faint glowing energy around its head',
  Bug: 'a chitinous armored exoskeleton, iridescent green-and-black coloring',
  Rock: 'jagged stone-textured hide, muted gray-and-brown coloring, a heavy grounded build',
  Ghost: 'a wispy semi-transparent form, deep purple-and-black coloring, faint glowing eyes',
  Dragon: 'a powerful scaled body, deep blue-and-gold coloring, an aura of ancient authority',
  Dark: 'sleek black coloring with sharp angular features, a shadow-wreathed silhouette',
  Steel: 'a metallic silver-and-blue plated hide, sharp geometric edges',
  Fairy: 'soft pastel pink-and-white coloring, a faint sparkling shimmer in the air around it',
  Normal: 'warm earth-tone coloring, a balanced athletic build'
};

function buildVisualDescription(sp) {
  const primary = TYPE_VISUAL_STYLE[sp.types[0]] || 'distinctive, vividly colored features';
  if (sp.types[1]) {
    const secondary = TYPE_VISUAL_STYLE[sp.types[1]] || '';
    return `an original fantasy creature with ${primary}, accented with ${secondary}.`;
  }
  return `an original fantasy creature with ${primary}.`;
}
function pickAbility(sp) {
  const preferred = sp.abilities.filter(a => KNOWN_ABILITIES.has(a));
  const from = preferred.length ? preferred : sp.abilities;
  return from[Math.floor(Math.random() * from.length)];
}

function pickRandom(arr, excludeNames) {
  let candidates = arr;
  if (excludeNames && excludeNames.size) {
    const filtered = arr.filter(sp => !excludeNames.has(sp.name));
    if (filtered.length > 0) candidates = filtered;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Real Pokedex-style flavor line, built from actual type/stat identity
// instead of the old habitat/behavior/trait/power template - no more
// "captivated researchers for generations" boilerplate.
// Fixed 2026-08-12: this previously ranked across ALL six real base stats,
// including spa/spd - so episode 26 introduced Porygon2 as "well known for
// its exceptional Special Attack" in a sim that has no special-attack stat
// at all. battle.js's damage formula only reads hp/attack/defense/speed
// (the four surfaced in toCreature's `stats` object below), so a creature's
// spoken identity must be drawn from that same four, or the commentary
// promises a strength the fight can never demonstrate. Same root problem as
// the open type-effectiveness question: narration citing mechanics the
// simulation doesn't model.
const SIM_STATS = ['hp', 'atk', 'def', 'spe'];

function buildDescription(sp) {
  const statEntries = Object.entries(sp.baseStats)
    .filter(([k]) => SIM_STATS.includes(k))
    .sort((a, b) => b[1] - a[1]);
  const statNames = { hp: 'HP', atk: 'physical Attack', def: 'physical Defense', spe: 'Speed' };
  const topStat = statNames[statEntries[0][0]];
  const categoryLine = {
    starter: 'One of the most recognizable partner Pokemon in the world, ',
    'fan-favorite': 'A longtime fan favorite, ',
    filler: ''
  }[sp.category] || '';
  return `${categoryLine}${sp.name} is well known among trainers for its exceptional ${topStat}, backed by a base stat total of ${sp.total}.`;
}

// Maps a pool entry into the exact shape index.js/script.js consume.
// NOTE: this intentionally does NOT include habitat/behavior/trait/power/
// renown/bodyType/facialFeature/distinctiveFeature/colorPattern - those
// were flavor-pool fields specific to the old fictional generator.
function toCreature(sp) {
  const [primaryName, secondaryName] = sp.types;
  return {
    name: sp.name,
    pokedexNumber: sp.id,
    height: sp.heightFt,
    weight: sp.weightLbs,
    primaryType: { name: primaryName, color: TYPE_COLORS[primaryName], emoji: TYPE_EMOJIS[primaryName] },
    secondaryType: secondaryName
      ? { name: secondaryName, color: TYPE_COLORS[secondaryName], emoji: TYPE_EMOJIS[secondaryName] }
      : null,
    ability: pickAbility(sp),
    description: buildDescription(sp),
    visualDescription: buildVisualDescription(sp), // for poster.js's image-gen prompt - generic, type-based, no species name/likeness
    stats: {
      hp: sp.baseStats.hp,
      attack: sp.baseStats.atk,
      defense: sp.baseStats.def,
      speed: sp.baseStats.spe,
    },
    canMegaEvolve: sp.canMegaEvolve,
    megaFormName: sp.megaFormName || null, // e.g. "Charizard-Mega-X" - real Mega Form, only set if canMegaEvolve
    moves: sp.moves, // real damaging moves from this species' actual learnset, STAB-preferred
    category: sp.category,
  };
}

// index.js calls generateCreature(excludeSet) expecting name-based
// cross-episode exclusion (a Set of recently-used Pokemon names).
export function generateCreature(excludeNames) {
  const sp = pickRandom(POOL, excludeNames);
  return toCreature(sp);
}

// --- Matchmaking (added 2026-08-13) ----------------------------------------
//
// Episode 29 paired Tepig (308 BST, a first-stage starter) against Urshifu
// (550 BST, a legendary-tier fighter). Urshifu one-shot it: 113 damage into
// 65 HP, one landed attack, episode over. That is not a card, it is a
// formality - and because the two creatures were drawn independently from a
// pool spanning roughly 175 to 720 BST, it will keep happening at a steady
// rate without a proximity check.
//
// This is the highest-leverage change available to the show right now: the
// grammar fixes make episodes read correctly, but this one makes them worth
// listening to. script.js's new blowout banks handle the mismatches that
// still slip through honestly; this reduces how often they occur at all.
//
// Approach: draw creature A freely (so the full pool stays reachable and no
// species is effectively banned), then draw B from those within BAND of A's
// BST. The band widens progressively if nothing qualifies, and falls back
// to a free draw rather than ever failing - a slightly lopsided episode is
// far better than no episode.
const BST_BANDS = [60, 100, 150, 250];

export function generateMatchedPair(excludeNames) {
  const spA = pickRandom(POOL, excludeNames);

  // Exclude A itself so a creature never fights a mirror of itself.
  const taken = new Set(excludeNames || []);
  taken.add(spA.name);

  for (const band of BST_BANDS) {
    const candidates = POOL.filter(sp =>
      !taken.has(sp.name) && Math.abs(sp.total - spA.total) <= band
    );
    if (candidates.length > 0) {
      const spB = candidates[Math.floor(Math.random() * candidates.length)];
      return [toCreature(spA), toCreature(spB)];
    }
  }

  // Nothing within even the widest band (only possible at the extreme ends
  // of the pool) - fall back to an unconstrained draw.
  return [toCreature(spA), toCreature(pickRandom(POOL, taken))];
}

export { POOL };
