export const moveVerbs = [
  'unleashes a devastating strike on', 'slams into', 'lashes out at',
  'charges headlong at', 'catches', 'ambushes', 'blindsides',
  'connects a brutal hit on', 'rattles', 'clips'
];

export const critLines = [
  'AND IT LANDS PERFECTLY —', 'RIGHT ON THE MARK —', 'A DIRECT HIT —',
  'THAT ONE HURT —', 'OH, THAT IS GOING TO LEAVE A MARK —'
];

export const missLines = [
  'but it whiffs completely!', 'but it goes wide!', "but there's nothing there — clean dodge!",
  "but it's deflected at the last second!"
];

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
      const baseDamage = Math.max(3, attacker.stats.attack - defender.stats.defense * 0.5);
      const damage = Math.round(baseDamage * (isCrit ? 1.8 : 1) * (0.85 + Math.random() * 0.3));

      defender.hp = Math.max(0, defender.hp - damage);

      log.push({
        turn,
        type: isCrit ? 'crit' : 'hit',
        attacker: attacker.name,
        defender: defender.name,
        damage,
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
