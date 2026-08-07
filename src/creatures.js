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
function buildDescription(sp) {
  const statEntries = Object.entries(sp.baseStats).sort((a, b) => b[1] - a[1]);
  const statNames = { hp: 'HP', atk: 'physical Attack', def: 'physical Defense', spa: 'Special Attack', spd: 'Special Defense', spe: 'Speed' };
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

export { POOL };
