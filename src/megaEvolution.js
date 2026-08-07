// megaEvolution.js
// Adds a chance for either creature to "mega evolve" partway through the
// battle - a temporary stat/power spike plus a narrative beat, not a
// permanent creature change. Designed to be called from inside battle.js's
// turn loop.
//
// Fixed 2026-08-07: previously ANY creature could mega evolve into a
// generic "Mega <Name>" - inauthentic for the ~90% of real Pokemon with no
// actual Mega Form (e.g. the old pipeline let Alakazam "Mega Evolve," which
// doesn't exist). Now gated on creature.canMegaEvolve (set by creatures.js
// from real @pkmn/dex data) and uses the real Mega Form name
// (creature.megaFormName, e.g. "Charizard-Mega-X") instead of inventing one.

const MEGA_CHANCE_PER_TURN = 0.12; // ~12% per turn once eligible; tune to taste
const MIN_TURN_FOR_MEGA = 2;       // no mega-ing out on turn 1 - let the fight breathe first
const STAT_MULTIPLIER = 1.5;       // temporary boost to attack/power for the rest of the battle

const MEGA_FLAVOR = [
  "erupts in a blinding surge of raw energy",
  "is suddenly wreathed in crackling, unstable power",
  "lets out an earth-shaking roar as its form begins to shift",
  "glows white-hot as its silhouette twists and grows",
  "is engulfed in a pulse of light that forces the crowd to shield their eyes"
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Call once per turn, per creature, inside battle.js's turn loop.
 * @param {object} creature - must have .stats, .hasMegaEvolved, .name,
 *   .canMegaEvolve, .megaFormName (the latter two set by creatures.js)
 * @param {number} turnNumber - current turn (1-indexed)
 * @returns {object|null} - a narrative event to splice into the battle log, or null if no mega happened
 */
export function maybeTriggerMegaEvolution(creature, turnNumber) {
  if (!creature.canMegaEvolve || !creature.megaFormName) return null; // most Pokemon have no real Mega Form
  if (creature.hasMegaEvolved) return null;      // one mega per creature per battle
  if (turnNumber < MIN_TURN_FOR_MEGA) return null;
  if (Math.random() > MEGA_CHANCE_PER_TURN) return null;

  const before = { ...creature.stats };
  creature.stats.attack = Math.round((creature.stats.attack ?? 10) * STAT_MULTIPLIER);
  creature.stats.speed = Math.round((creature.stats.speed ?? 10) * STAT_MULTIPLIER);
  creature.hasMegaEvolved = true;

  // Real Mega Form display name, e.g. "Mega Charizard X" instead of the
  // dex's internal "Charizard-Mega-X" hyphenated form.
  const displayMegaName = creature.megaFormName.replace(
    new RegExp(`^${creature.name}-Mega(-[A-Z])?$`),
    (_, suffix) => `Mega ${creature.name}${suffix ? ' ' + suffix.slice(1) : ''}`
  );
  creature.displayName = displayMegaName;

  return {
    type: "mega_evolution",
    turn: turnNumber,
    creature: creature.name,
    line: `${creature.name} ${pick(MEGA_FLAVOR)} - it's Mega Evolved into ${displayMegaName}! ` +
      `Its attack and speed have surged!`,
    statsBefore: before,
    statsAfter: { ...creature.stats }
  };
}
