// type-effectiveness.js
//
// Single source of truth for type matchups, shared by battle.js (damage
// multiplier) and script.js (matchup commentary).
//
// WHY THIS FILE EXISTS (2026-08-13):
// script.js previously carried its own local `typeChart` used only for
// narration, while battle.js's damage formula had no type term at all -
// so the commentary asserted advantages the fight could not honor. Episode
// 24 (Charmeleon vs. Escavalier) predicted an edge for the eventual loser,
// which is what put this on the backlog on Aug 8.
//
// Duplicating the chart across two files would guarantee drift, so both now
// import from here. The old chart is superseded for two further reasons:
//   1. Its `weak` field had INVERTED semantics relative to `strong`
//      (`strong` = types this attacks well; `weak` = types this is damaged
//      by). It was never read - zero usages - so nothing was broken yet,
//      but it was a live trap for exactly this change.
//   2. It had no resistances and no immunities, so it could only ever
//      express "2x or nothing" - half of real type effectiveness.
//
// Data below is standard Pokemon type effectiveness, written offensively:
// for each ATTACKING type, which DEFENDING types it hits hard, weakly, or
// not at all. Plain ASCII only, per this account's standing rule.

export const TYPE_CHART = {
  Normal:   { superEffective: [],                                              notVeryEffective: ['Rock', 'Steel'],                                        noEffect: ['Ghost'] },
  Fire:     { superEffective: ['Grass', 'Ice', 'Bug', 'Steel'],                notVeryEffective: ['Fire', 'Water', 'Rock', 'Dragon'],                      noEffect: [] },
  Water:    { superEffective: ['Fire', 'Ground', 'Rock'],                      notVeryEffective: ['Water', 'Grass', 'Dragon'],                             noEffect: [] },
  Electric: { superEffective: ['Water', 'Flying'],                             notVeryEffective: ['Electric', 'Grass', 'Dragon'],                          noEffect: ['Ground'] },
  Grass:    { superEffective: ['Water', 'Ground', 'Rock'],                     notVeryEffective: ['Fire', 'Grass', 'Poison', 'Flying', 'Bug', 'Dragon', 'Steel'], noEffect: [] },
  Ice:      { superEffective: ['Grass', 'Ground', 'Flying', 'Dragon'],         notVeryEffective: ['Fire', 'Water', 'Ice', 'Steel'],                        noEffect: [] },
  Fighting: { superEffective: ['Normal', 'Ice', 'Rock', 'Dark', 'Steel'],      notVeryEffective: ['Poison', 'Flying', 'Psychic', 'Bug', 'Fairy'],          noEffect: ['Ghost'] },
  Poison:   { superEffective: ['Grass', 'Fairy'],                              notVeryEffective: ['Poison', 'Ground', 'Rock', 'Ghost'],                    noEffect: ['Steel'] },
  Ground:   { superEffective: ['Fire', 'Electric', 'Poison', 'Rock', 'Steel'], notVeryEffective: ['Grass', 'Bug'],                                         noEffect: ['Flying'] },
  Flying:   { superEffective: ['Grass', 'Fighting', 'Bug'],                    notVeryEffective: ['Electric', 'Rock', 'Steel'],                            noEffect: [] },
  Psychic:  { superEffective: ['Fighting', 'Poison'],                          notVeryEffective: ['Psychic', 'Steel'],                                     noEffect: ['Dark'] },
  Bug:      { superEffective: ['Grass', 'Psychic', 'Dark'],                    notVeryEffective: ['Fire', 'Fighting', 'Poison', 'Flying', 'Ghost', 'Steel', 'Fairy'], noEffect: [] },
  Rock:     { superEffective: ['Fire', 'Ice', 'Flying', 'Bug'],                notVeryEffective: ['Fighting', 'Ground', 'Steel'],                          noEffect: [] },
  Ghost:    { superEffective: ['Psychic', 'Ghost'],                            notVeryEffective: ['Dark'],                                                 noEffect: ['Normal'] },
  Dragon:   { superEffective: ['Dragon'],                                      notVeryEffective: ['Steel'],                                                noEffect: ['Fairy'] },
  Dark:     { superEffective: ['Psychic', 'Ghost'],                            notVeryEffective: ['Fighting', 'Dark', 'Fairy'],                            noEffect: [] },
  Steel:    { superEffective: ['Ice', 'Rock', 'Fairy'],                        notVeryEffective: ['Fire', 'Water', 'Electric', 'Steel'],                   noEffect: [] },
  Fairy:    { superEffective: ['Fighting', 'Dragon', 'Dark'],                  notVeryEffective: ['Fire', 'Poison', 'Steel'],                              noEffect: [] }
};

// Normalizes a creature into a plain array of its type names.
export function typeNamesOf(creature) {
  return [creature?.primaryType?.name, creature?.secondaryType?.name].filter(Boolean);
}

/**
 * Multiplier for one attacking type against a (possibly dual-type) defender.
 * Multiplies across each defending type, exactly as the real games do:
 * 4x and 0.25x are reachable on dual types, and 0 beats everything.
 */
export function effectivenessOf(attackingType, defendingTypes) {
  const row = TYPE_CHART[attackingType];
  if (!row) return 1;
  let mult = 1;
  for (const d of defendingTypes) {
    if (row.noEffect.includes(d)) return 0;
    if (row.superEffective.includes(d)) mult *= 2;
    else if (row.notVeryEffective.includes(d)) mult *= 0.5;
  }
  return mult;
}

/**
 * A creature attacks with its BEST type - the sim has no move selection, so
 * assuming the attacker uses whichever of its types is more favorable is the
 * fairest single-number stand-in, and it matches how the commentary reads a
 * matchup ("Fighting has the edge here").
 *
 * A 0x result is deliberately floored to 0.25x rather than 0: a true immunity
 * would make the fight unresolvable (neither side can ever deal damage in a
 * Normal vs Ghost mirror), and an episode that cannot end is worse than one
 * that is merely lopsided. Narration calls this out as "barely scratching".
 */
export function bestEffectiveness(attackerTypes, defenderTypes) {
  if (!attackerTypes.length || !defenderTypes.length) return 1;
  const best = Math.max(...attackerTypes.map(t => effectivenessOf(t, defenderTypes)));
  return best === 0 ? 0.25 : best;
}

/**
 * Which of the attacker's types produces that best result, for narration.
 * Returns null when nothing is better than neutral.
 */
export function bestAttackingType(attackerTypes, defenderTypes) {
  let bestType = null;
  let bestMult = 1;
  for (const t of attackerTypes) {
    const m = effectivenessOf(t, defenderTypes);
    if (m > bestMult) { bestMult = m; bestType = t; }
  }
  return bestType;
}

// Spoken label for a multiplier, used by battle.js's log and script.js's
// narration so both describe the same hit the same way.
export function effectivenessLabel(mult) {
  if (mult >= 2) return 'super-effective';
  if (mult <= 0.5) return 'resisted';
  return 'neutral';
}
