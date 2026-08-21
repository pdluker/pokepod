import { bestEffectiveness, typeNamesOf, effectivenessLabel } from './type-effectiveness.js';

export const moveVerbs = [
  'unleashes a devastating strike on', 'slams into', 'lashes out at',
  'charges headlong at', 'catches', 'ambushes', 'blindsides',
  'connects a brutal hit on', 'rattles', 'clips'
];

// Em dashes removed 2026-08-13: these strings are narrated by ElevenLabs,
// and this account's standing plain-ASCII rule (earth.stluker.com, Jul 23)
// applies to anything crossing that boundary, not just KV payloads.
export const critLines = [
  'AND IT LANDS PERFECTLY -', 'RIGHT ON THE MARK -', 'A DIRECT HIT -',
  'THAT ONE HURT -', 'OH, THAT IS GOING TO LEAVE A MARK -'
];

export const missLines = [
  'but it whiffs completely!', 'but it goes wide!', "but there's nothing there - clean dodge!",
  "but it's deflected at the last second!"
];

// Narration for a type-effective hit, keyed off the same multiplier the
// damage formula uses - so the commentary can never contradict the math.
export const superEffectiveLines = [
  'and the type matchup is doing real work there',
  'and that is exactly the matchup it wanted',
  'and Doc, that landed a LOT harder than the stat sheet suggests',
  'and the type advantage shows up immediately'
];

export const resistedLines = [
  'but the typing blunts most of that',
  'but that is a bad matchup to be swinging into',
  'but it barely registers against that typing',
  'but the damage is largely absorbed'
];

// --- Pacing constants (added 2026-08-13) ------------------------------------
// Measured over 4,000 simulated fights, the pre-type formula already ended
// 20.2% of battles in a single landed hit (median 3 events). Adding the type
// multiplier pushed that to 28.5% - nearly a third of episodes would be a
// one-punch squash, which is a poor listen and would fire script.js's new
// blowout banks constantly.
//
// The formula also changed from SUBTRACTIVE to RATIO-BASED, and that fix
// matters more than the pacing. The old `attack - defense * 0.5` collapsed
// to its floor of 3 whenever defense outweighed attack - so in the Charmeleon
// (64 atk) vs Escavalier (105 def) matchup that started this whole thread,
// a 4x type advantage multiplied a floored 3 into 12 and Charmeleon still
// lost 100% of 2,000 simulated rematches. A multiplier that is inert in
// exactly the high-defense matchups where type advantage should decide the
// fight is not worth having. The ratio form keeps damage proportional at
// every stat spread, so the multiplier does real work everywhere.
//
// DAMAGE_SCALE is the single pacing dial: lower means longer fights.
const DAMAGE_SCALE = 0.85;

export function simulateBattle(creatureA, creatureB) {
  const a = { ...creatureA, hp: creatureA.stats.hp, maxHp: creatureA.stats.hp };
  const b = { ...creatureB, hp: creatureB.stats.hp, maxHp: creatureB.stats.hp };

  const log = [];
  let turn = 1;
  const maxTurns = 12;

  while (a.hp > 0 && b.hp > 0 && turn <= maxTurns) {
    const order = a.stats.speed >= b.stats.speed ? [a, b] : [b, a];

    for (const attacker of order) {
      if (a.hp <= 0 || b.hp <= 0) break;
      const defender = attacker === a ? b : a;

      const hitRoll = Math.random();
      const missChance = 0.12;

      if (hitRoll < missChance) {
        log.push({ turn, type: 'miss', attacker: attacker.name, defender: defender.name });
        continue;
      }

      const isCrit = Math.random() < 0.18;

      // Type effectiveness (added 2026-08-13, closing the Aug 8 decision).
      // Applied AFTER the defense subtraction and BEFORE the crit/variance
      // rolls, so a super-effective hit scales the whole result rather than
      // only the pre-mitigation portion. Multiplier comes from the shared
      // type-effectiveness module - script.js reads the same one for its
      // matchup commentary, so the two cannot drift apart.
      const effectiveness = bestEffectiveness(
        typeNamesOf(attacker),
        typeNamesOf(defender)
      );

      const atk = attacker.stats.attack;
      const def = defender.stats.defense;
      const baseDamage = Math.max(3, atk * (atk / (atk + def)));
      const damage = Math.max(1, Math.round(
        baseDamage * effectiveness * DAMAGE_SCALE * (isCrit ? 1.8 : 1) * (0.85 + Math.random() * 0.3)
      ));

      defender.hp = Math.max(0, defender.hp - damage);

      log.push({
        turn,
        type: isCrit ? 'crit' : 'hit',
        attacker: attacker.name,
        defender: defender.name,
        damage,
        effectiveness,
        effectivenessLabel: effectivenessLabel(effectiveness),
        defenderHpRemaining: defender.hp,
        defenderMaxHp: defender.maxHp
      });

      if (defender.hp <= 0) break;
    }
    turn++;
  }

  let winner, loser;
  if (a.hp <= 0 && b.hp <= 0) {
    winner = null;
    loser = null;
  } else if (a.hp <= 0) {
    winner = creatureB.name;
    loser = creatureA.name;
  } else if (b.hp <= 0) {
    winner = creatureA.name;
    loser = creatureB.name;
  } else {
    const aPct = a.hp / a.maxHp;
    const bPct = b.hp / b.maxHp;
    winner = aPct >= bPct ? creatureA.name : creatureB.name;
    loser = aPct >= bPct ? creatureB.name : creatureA.name;
  }

  return { log, winner, loser, finalHp: { [creatureA.name]: a.hp, [creatureB.name]: b.hp } };
}
