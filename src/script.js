import { moveVerbs, critLines, missLines } from './battle.js';
import { generateTrainer, buildTrainerIntroLine } from './trainers.js';
import { generateArena, buildArenaIntroLine } from './arenas.js';

// RECONSTRUCTED 2026-07-30 — the version of this file that actually
// generated episodes 7-9 (Duke/Doc hosts, trainer intros, arena
// scene-setting) was lost — a deploy on 7-30 silently reverted this file to
// an older, simpler version with no host personas or trainer/arena
// integration at all. Rebuilt from real episode 7-9 transcripts.
//
// Exclusion + pool-expansion pass, 2026-07-31: every phrase bank here used
// a plain pick() with zero memory of what was said in a prior episode -
// same root cause as the creature-habitat repetition already fixed in
// creatures.js, but worse in a few spots because several of the most
// noticeable banks (victoryColorNotes, signoffAsides, finalSignoffs) only
// had 3 entries each. A 3-entry pool repeats on a predictable ~1-in-3 cycle
// even with perfect exclusion - there's no amount of "smarter random" that
// fixes too few options, so those banks got real content added alongside
// the exclusion logic. pickIndexed() tracks *which index* was chosen (not
// the rendered string, since these are template functions) so callers can
// persist a rolling history and pass it back in as `exclude` next episode.
// buildEpisodeScript() now returns `usedIndices` (what was picked this
// episode) plus the trainer/arena objects actually used, so index.js can
// record all of it into a single history ledger.

const HOSTS = { pbp: 'Duke', color: 'Doc' };

// Picks a random index from arr, skipping any index in excludeIndices
// (a Set of numbers) unless doing so would empty the pool entirely - in
// which case it falls back to the full range rather than throwing.
function pickIndexed(arr, excludeIndices) {
  let indices = arr.map((_, i) => i);
  if (excludeIndices && excludeIndices.size) {
    const filtered = indices.filter((i) => !excludeIndices.has(i));
    if (filtered.length > 0) indices = filtered;
  }
  const idx = indices[Math.floor(Math.random() * indices.length)];
  return { item: arr[idx], index: idx };
}

// Convenience for call sites that don't need to track the index (banks with
// no cross-episode history requirement, or one-off internal picks).
function pick(arr, excludeIndices) {
  return pickIndexed(arr, excludeIndices).item;
}

function typeLine(creature) {
  return creature.secondaryType
    ? `${creature.primaryType.name} and ${creature.secondaryType.name} type`
    : `${creature.primaryType.name} type`;
}

// --- Color commentary flavor banks -----------------------------------

const abilityInsights = {
  Blaze: 'That ability lets it punch above its weight the lower its HP gets — dangerous in a long fight.',
  Torrent: 'Same story as Blaze, just the water-flavored version — expect a late surge if this goes the distance.',
  Overgrow: 'A slow-burn ability. If this fight drags on, watch for a second-wind moment.',
  Static: 'Passive disruption — nothing flashy, but it quietly punishes aggressive opponents.',
  Intimidate: "That's a mental-game ability as much as a stat one. Sets the tone before a single hit lands.",
  Levitate: "Full immunity to an entire attack category. That's a free defensive floor most competitors don't get.",
  'Flash Fire': 'A hard counter if the opponent leans on fire — turns a weakness into a buff outright.',
  'Water Absorb': 'Same idea, different element. If the opposing kit is water-heavy, this is a real problem for them.',
  'Volt Absorb': "Electric immunity plus a heal. That's not a small thing in a close fight.",
  Pressure: "A war-of-attrition ability — this favors whoever's more patient, not whoever's flashier.",
  'Thick Fat': 'Passive damage reduction against two whole categories. Quietly one of the best defensive abilities in the game.',
  Adaptability: 'Every point of same-type offense hits harder than the stat sheet suggests.',
  'Swift Swim': "Conditional, but when it's active, the speed stat on the sheet stops mattering.",
  Regenerator: 'Free sustain most competitors would kill for — makes every exchange less costly than it looks.',
  'Magic Guard': 'Zero incidental damage taken. Whatever happens here, it only takes damage from a direct hit.',
  Multiscale: "Full health is doing real work right now — that first hit is going to matter less than you'd think.",
  Sturdy: "Can't be dropped in one shot no matter the damage — that safety net changes how aggressively it can play.",
  'Iron Fist': 'A quiet damage buff on top of everything else — punches harder than the base numbers suggest.',
  'Sheer Force': 'Trades some consistency for raw power on the right move — high ceiling, real risk.',
  'Prism Armor': "Reduces incoming supereffective damage — exactly the kind of ability that neutralizes a bad matchup.",
  Unaware: 'Ignores stat changes entirely — any attempt to out-boost this one is dead on arrival.',
  Moxie: 'Gets stronger with every knockout — the longer it stays alive, the scarier it gets.',
  'Sand Veil': 'Conditional evasion — situational, but can make this a nightmare to pin down in the right arena.',
  'Snow Cloak': 'Same idea as Sand Veil, just for the cold — arena conditions could matter a lot tonight.',
  'Poison Heal': 'Turns a normally harmful status into free healing — a genuinely backwards-feeling ability that works.',
  'Rough Skin': 'Punishes direct contact automatically — aggressive opponents pay a tax just for engaging.',
  'Tinted Lens': "Weak-matchup moves stop being weak — flattens out what would otherwise be an obvious type disadvantage.",
  'Wonder Skin': 'Makes status moves far less reliable against it — a real answer to a stall-heavy opponent.'
};

const typeChart = {
  Fire: { strong: ['Grass', 'Bug', 'Ice', 'Steel'], weak: ['Water', 'Rock', 'Ground'] },
  Water: { strong: ['Fire', 'Rock', 'Ground'], weak: ['Grass', 'Electric'] },
  Grass: { strong: ['Water', 'Rock', 'Ground'], weak: ['Fire', 'Ice', 'Bug', 'Flying'] },
  Electric: { strong: ['Water', 'Flying'], weak: ['Ground'] },
  Ice: { strong: ['Grass', 'Ground', 'Flying', 'Dragon'], weak: ['Fire', 'Fighting', 'Rock', 'Steel'] },
  Fighting: { strong: ['Ice', 'Rock', 'Dark', 'Steel'], weak: ['Flying', 'Psychic', 'Fairy'] },
  Poison: { strong: ['Grass', 'Fairy'], weak: ['Ground', 'Psychic'] },
  Ground: { strong: ['Fire', 'Electric', 'Poison', 'Rock', 'Steel'], weak: ['Water', 'Grass', 'Ice'] },
  Flying: { strong: ['Grass', 'Fighting', 'Bug'], weak: ['Electric', 'Ice', 'Rock'] },
  Psychic: { strong: ['Fighting', 'Poison'], weak: ['Bug', 'Ghost', 'Dark'] },
  Bug: { strong: ['Grass', 'Psychic', 'Dark'], weak: ['Fire', 'Flying', 'Rock'] },
  Rock: { strong: ['Fire', 'Ice', 'Flying', 'Bug'], weak: ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'] },
  Ghost: { strong: ['Psychic', 'Ghost'], weak: ['Ghost', 'Dark'] },
  Dragon: { strong: ['Dragon'], weak: ['Ice', 'Dragon', 'Fairy'] },
  Dark: { strong: ['Psychic', 'Ghost'], weak: ['Fighting', 'Bug', 'Fairy'] },
  Steel: { strong: ['Ice', 'Rock', 'Fairy'], weak: ['Fire', 'Fighting', 'Ground'] },
  Fairy: { strong: ['Fighting', 'Dragon', 'Dark'], weak: ['Poison', 'Steel'] }
};

function typeMatchupNote(a, b) {
  const aTypes = [a.primaryType.name, a.secondaryType?.name].filter(Boolean);
  const bTypes = [b.primaryType.name, b.secondaryType?.name].filter(Boolean);

  for (const at of aTypes) {
    const chart = typeChart[at];
    if (!chart) continue;
    for (const bt of bTypes) {
      if (chart.strong.includes(bt)) {
        return `On paper, ${at} has the edge over ${bt} — if ${a.name} presses that advantage early, this could get lopsided fast.`;
      }
    }
  }
  for (const bt of bTypes) {
    const chart = typeChart[bt];
    if (!chart) continue;
    for (const at of aTypes) {
      if (chart.strong.includes(at)) {
        return `Type-wise, ${bt} actually has the favorable matchup here against ${at} — don't sleep on ${b.name} early.`;
      }
    }
  }
  return `No clean type advantage either direction here — this one's likely going to come down to the raw stat sheet, not the matchup chart.`;
}

const statInsightPhrases = [
  (winner, statName) => `${winner} simply outclassed the field in ${statName} tonight, and it showed.`,
  (winner, statName) => `When you break down the numbers, ${winner}'s ${statName} was the real difference-maker.`,
  (winner, statName) => `That's a ${statName} advantage translating directly into a result — nothing lucky about it.`
];

function decisiveStatNote(winnerCreature, loserCreature, exclude) {
  const stats = ['hp', 'attack', 'defense', 'speed'];
  const statLabels = { hp: 'HP', attack: 'attack', defense: 'defense', speed: 'speed' };
  let biggestGap = null;
  for (const s of stats) {
    const gap = winnerCreature.stats[s] - loserCreature.stats[s];
    if (!biggestGap || gap > biggestGap.gap) biggestGap = { stat: s, gap };
  }
  if (biggestGap.gap <= 0) {
    return { text: `Statistically this was close to even — ${winnerCreature.name} won this one on execution, not raw numbers.`, index: null };
  }
  const { item, index } = pickIndexed(statInsightPhrases, exclude);
  return { text: item(winnerCreature.name, statLabels[biggestGap.stat]), index };
}

// --- Duke & Doc banter banks --------------------------------------------
// Expanded 2026-07-31: coldOpens, victoryLines, victoryColorNotes,
// signoffAsides, and finalSignoffs all grew from their original 3-5 entries
// - those were the banks most likely to feel repetitive since every single
// episode uses exactly one line from each of them.

const coldOpens = [
  (showName, n, date) => `Welcome back to ${showName}, episode ${n}, recorded ${date}! Folks, we have got an absolute showdown lined up for you today.`,
  (showName, n, date) => `${showName} is officially live. ${HOSTS.pbp} here with ${HOSTS.color}, and I don't say this every night — but tonight feels different. Episode ${n}, recorded ${date}.`,
  (showName, n, date) => `${showName} is live, ${HOSTS.color}'s in the booth, I'm ${HOSTS.pbp}, and we are NOT wasting any time getting into this one. Episode ${n}, recorded ${date}.`,
  (showName, n, date) => `Here we go — ${showName}, episode ${n}, recorded ${date}. ${HOSTS.pbp} and ${HOSTS.color} back at it again, and tonight's matchup is a genuinely good one.`,
  (showName, n, date) => `Episode ${n} of ${showName}, recorded ${date} — and folks, ${HOSTS.pbp} has been talking about this matchup all week.`,
  (showName, n, date) => `${HOSTS.color} and I have seen a lot of fights together, but episode ${n} of ${showName} might be the one people are still talking about tomorrow. Recorded ${date}.`,
  (showName, n, date) => `You know the drill by now — ${showName}, ${HOSTS.pbp} and ${HOSTS.color}, and a fight that's got the whole booth buzzing before we've even started. Episode ${n}, recorded ${date}.`,
  (showName, n, date) => `Grab a seat, this is ${showName} episode ${n}, recorded ${date} — ${HOSTS.pbp} here, and tonight's card does not disappoint.`
];

const creatureAReveals = [
  (a) => `In one corner, standing ${a.height} feet tall and weighing in at ${a.weight} pounds... give it up for ${a.name}!`,
  (a) => `In one corner — standing ${a.height} feet, ${a.weight} pounds — it's ${a.name}!`,
  (a) => `Let's meet our first competitor: ${a.height} feet tall, ${a.weight} pounds, please welcome ${a.name}!`
];

const creatureBReveals = [
  (b) => `And stepping up to challenge them, standing ${b.height} feet tall, weighing ${b.weight} pounds... it's ${b.name}!`,
  (b) => `And across the way — ${b.height} feet, ${b.weight} pounds — challenging tonight, ${b.name}!`,
  (b) => `Their opponent tonight: ${b.height} feet tall, ${b.weight} pounds, it's ${b.name}!`
];

const askDocAboutA = [
  (aName) => `Before we go any further, ${HOSTS.color} — sell me on ${aName}. What am I missing?`,
  (aName) => `${HOSTS.color}, before I even get to the tale of the tape — what's your first read on ${aName}?`,
  (aName) => `Break it down for me, ${HOSTS.color} — what do you see in ${aName} that the numbers won't show?`
];

const docAsideAfterA = [
  () => `— and honestly, ${HOSTS.pbp}, I like how that ability shapes the whole pace of a fight.`,
  () => `— worth watching how that plays out over the course of the fight, ${HOSTS.pbp}.`,
  () => `— that's the kind of detail casual viewers miss, but it matters a lot tonight.`
];

const docAsideAfterB = [
  (aName, bName) => `That's a real answer to what ${aName} brings, ${HOSTS.pbp}.`,
  (aName, bName) => `Genuinely one of the more interesting counter-styles we've seen matched up against ${aName} in a while.`,
  (aName, bName) => `${bName} did not get here by accident — that's a real answer on paper.`
];

const preBattleBanter = [
  () => `Somebody's excited tonight. Might want to pace yourself, ${HOSTS.pbp}.`,
  () => `${HOSTS.pbp}'s already picked a winner and we haven't even hit the bell. Classic.`,
  () => `Easy there, ${HOSTS.pbp} — let the poor creature walk out before you crown it.`,
  () => `${HOSTS.pbp}'s already excited, and I haven't even given my full read yet.`
];

const readyForAction = [
  () => `Alright, we've heard the breakdown — let's get to the action!`,
  () => `Alright — we've heard the breakdown. Let's get into it!`,
  () => `That's the tale of the tape. Let's drop the flag on this one!`
];

const victoryLines = [
  (winner, loser) => `AND THAT'S IT — ${winner.toUpperCase()} TAKES THE VICTORY, sending ${loser} to the mat!`,
  (winner, loser) => `AND THAT'S ALL SHE WROTE — ${winner} puts ${loser} away for good!`,
  (winner, loser) => `IT'S OVER! ${winner.toUpperCase()} closes it out, and ${loser} just could not find an answer tonight!`,
  (winner, loser) => `THAT'S YOUR WINNER — ${winner.toUpperCase()}! ${HOSTS.color}, tell the people what we just watched!`,
  (winner, loser) => `AND THAT'S THE BALLGAME — ${winner.toUpperCase()} GETS IT DONE, ${loser} HAS NOTHING LEFT!`,
  (winner, loser) => `THERE'S THE FINAL BLOW — ${winner.toUpperCase()} takes this one, and ${loser} goes down swinging!`,
  (winner, loser) => `CALL IT — ${winner.toUpperCase()} WINS IT, and ${loser} has absolutely nothing left to answer with!`,
  (winner, loser) => `AND ${winner.toUpperCase()} SEALS IT RIGHT THERE — ${loser} could not weather that last exchange!`
];

const victoryColorNotes = [
  (winner) => `What I'll remember from this one is ${winner} never panicked. That's the difference at this level.`,
  (winner) => `That's about as clean a performance as you'll see. ${winner} in complete control the whole way.`,
  (winner) => `${winner} fought smart, took the openings when they came, and never gave the opponent a real window back in.`,
  (winner) => `${winner} finishes that barely even breathing hard. That's a statement, not just a win.`,
  (winner) => `Credit where it's due — ${winner} read every exchange a half-step ahead tonight.`,
  (winner) => `You don't get a finish like that without discipline. ${winner} earned every bit of it.`
];

const signoffAsides = [
  () => `As always, ${HOSTS.pbp} — pleasure calling this one alongside you.`,
  () => `${HOSTS.pbp}, this is why I still love doing this with you every single night.`,
  () => `Congratulations to the winner and their trainer on a hard-fought result.`,
  () => `Another good one in the books, ${HOSTS.pbp}. Same time tomorrow?`,
  () => `${HOSTS.pbp}, I say it every night and I'll say it again — this is the best seat in the house.`,
  () => `Solid card tonight. Nobody in that arena left anything unanswered.`
];

const finalSignoffs = [
  (showName) => `That's the bell, that's the battle, and that's another episode of ${showName} in the books. Until next time... train hard, battle smart, and we'll see you tomorrow!`,
  (showName) => `${HOSTS.color}, ${HOSTS.pbp}, ${showName} — signing off. Go tell a friend, a brand new battle drops tomorrow!`,
  (showName) => `That's the bell, that's the fight, that's another ${showName} in the books. For ${HOSTS.color}, I'm ${HOSTS.pbp} — we'll see you tomorrow!`,
  (showName) => `From all of us at ${showName} — that's a wrap on tonight. For ${HOSTS.color}, I'm ${HOSTS.pbp}, see you next time!`,
  (showName) => `That'll do it for tonight's ${showName}. ${HOSTS.pbp} and ${HOSTS.color}, signing off — same time tomorrow.`,
  (showName) => `And that's a wrap on another ${showName}. For ${HOSTS.color}, I'm ${HOSTS.pbp} — go rest up, tomorrow's card is already looking good.`
];

// --- Beat builders ------------------------------------------------------

function introBeats(showName, episodeNumber, dateStr, a, b, trainerA, trainerB, arena, exclude, used) {
  const beats = [];

  const coldOpen = pickIndexed(coldOpens, exclude.coldOpens);
  used.coldOpens = coldOpen.index;
  beats.push({ speaker: 'pbp', text: coldOpen.item(showName, episodeNumber, dateStr) });

  beats.push({ speaker: 'pbp', text: pick(creatureAReveals)(a) });
  beats.push({ speaker: 'pbp', text: pick(askDocAboutA)(a.name) });

  beats.push({ speaker: 'color', text:
    `${a.name} is a ${typeLine(a)} running ${a.ability}. ${a.description} ${abilityInsights[a.ability] || 'Worth watching how that ability shapes the pacing of this fight.'} ${pick(docAsideAfterA)()}` });

  beats.push({ speaker: 'pbp', text: buildTrainerIntroLine(trainerA, a.name) });
  beats.push({ speaker: 'color', text:
    `Little bit of color on ${trainerA.name} — out of ${trainerA.hometown}, and ${trainerA.quirk}.` });

  beats.push({ speaker: 'pbp', text: pick(creatureBReveals)(b) });

  beats.push({ speaker: 'color', text:
    `${b.name}, ${typeLine(b)}, carrying ${b.ability}. ${b.description} ${abilityInsights[b.ability] || "That's going to be a factor as this fight develops."} ${pick(docAsideAfterB)(a.name, b.name)}` });

  beats.push({ speaker: 'pbp', text: buildTrainerIntroLine(trainerB, b.name) });
  beats.push({ speaker: 'color', text:
    `And ${trainerB.name} — comes to us from ${trainerB.hometown}, and ${trainerB.quirk}.` });

  beats.push({ speaker: 'color', text: `${buildArenaIntroLine(arena)} Bit of history on this venue: it's ${arena.legend}.` });

  beats.push({ speaker: 'color', text:
    `Quick numbers before the bell — ${a.name}: ${a.stats.hp} HP, ${a.stats.attack} attack, ${a.stats.defense} defense, ${a.stats.speed} speed. ${b.name}: ${b.stats.hp} HP, ${b.stats.attack} attack, ${b.stats.defense} defense, ${b.stats.speed} speed. ${a.stats.speed >= b.stats.speed ? a.name : b.name} gets first tempo — that matters more than people give it credit for.` });

  beats.push({ speaker: 'color', text: typeMatchupNote(a, b) });

  beats.push({ speaker: 'pbp', text: pick(preBattleBanter)() });
  beats.push({ speaker: 'pbp', text: pick(readyForAction)() });

  return beats;
}

function battleBeats(battleResult, a, b, exclude, used) {
  const { log, winner, loser } = battleResult;
  const beats = [{ speaker: 'pbp', text: 'THE BELL RINGS AND WE ARE UNDERWAY!' }];

  const crits = log.filter(e => e.type === 'crit');
  const firstFew = log.slice(0, 2);
  const lastFew = log.slice(-3);

  const highlightSet = new Set();
  const highlights = [];
  [...firstFew, ...crits, ...lastFew].forEach(e => {
    const key = `${e.turn}-${e.attacker}-${e.defender}-${e.damage || 'm'}`;
    if (!highlightSet.has(key)) {
      highlightSet.add(key);
      highlights.push(e);
    }
  });

  const dangerCalled = new Set(); // avoid repeating a safety call for the same creature

  highlights.forEach(event => {
    if (event.type === 'miss') {
      beats.push({ speaker: 'pbp', text:
        `${event.attacker} ${pick(moveVerbs)} ${event.defender}... ${pick(missLines)}` });
      return;
    }

    if (event.type === 'crit') {
      beats.push({ speaker: 'pbp', text:
        `${event.attacker} ${pick(moveVerbs)} ${event.defender}! ${pick(critLines)} a massive ${event.damage} damage! ${event.defender} is down to ${event.defenderHpRemaining} out of ${event.defenderMaxHp} HP!` });
      beats.push({ speaker: 'color', text:
        `That's the kind of hit that swings a stat-sheet prediction. A critical like that isn't random noise — it's exactly the kind of variance that separates a close matchup from a rout.` });
    } else {
      beats.push({ speaker: 'pbp', text:
        `${event.attacker} ${pick(moveVerbs)} ${event.defender} for ${event.damage} damage. ${event.defender} sits at ${event.defenderHpRemaining} out of ${event.defenderMaxHp} HP.` });
    }

    const hpPct = event.defenderHpRemaining / event.defenderMaxHp;
    if (hpPct <= 0.3 && hpPct > 0 && !dangerCalled.has(event.defender)) {
      dangerCalled.add(event.defender);
      beats.push({ speaker: 'color', text:
        `Officials are watching closely now — ${event.defender} has dropped into the danger zone, under thirty percent. One more clean hit like that last one likely ends this.` });
    }
  });

  if (winner) {
    const victoryLine = pickIndexed(victoryLines, exclude.victoryLines);
    used.victoryLines = victoryLine.index;
    beats.push({ speaker: 'pbp', text: victoryLine.item(winner, loser) });

    const victoryColorNote = pickIndexed(victoryColorNotes, exclude.victoryColorNotes);
    used.victoryColorNotes = victoryColorNote.index;

    const winnerCreature = winner === a.name ? a : b;
    const loserCreature = winner === a.name ? b : a;
    const statNote = decisiveStatNote(winnerCreature, loserCreature, exclude.statInsightPhrases);
    used.statInsightPhrases = statNote.index;

    beats.push({ speaker: 'color', text: `${victoryColorNote.item(winner)} ${statNote.text}` });
  } else {
    beats.push({ speaker: 'pbp', text:
      `UNBELIEVABLE — both competitors go down in the same exchange! I have never seen anything like it!` });
    beats.push({ speaker: 'color', text:
      `A genuine double knockout. Statistically these two were about as evenly matched as it gets tonight, and the result backs that up.` });
  }

  return beats;
}

function signoffBeats(showName, winner, exclude, used) {
  const aside = pickIndexed(signoffAsides, exclude.signoffAsides);
  used.signoffAsides = aside.index;

  const final = pickIndexed(finalSignoffs, exclude.finalSignoffs);
  used.finalSignoffs = final.index;

  return [
    { speaker: 'pbp', text: `What a battle. ${winner ? `${winner} fought smart, ${winner} fought hard, and tonight ${winner} fought to win.` : 'A wild one to end on today.'}` },
    { speaker: 'color', text: aside.item() },
    { speaker: 'pbp', text: final.item(showName) }
  ];
}

// MMA-style hype taglines for episode titles.
const fightHypeTaglines = [
  'Power meets power. Something\'s got to give.',
  'The stakes have never been higher.',
  'One walks out. One does not.',
  'Two contenders. One night. No mercy.',
  'This is the matchup nobody saw coming.',
  'Only one leaves with the belt.',
  'Everything on the line, nothing held back.',
  'The hype is real. Tonight, we find out why.',
  'A collision course three months in the making.',
  'No rankings. No rematch. Just war.',
  'History gets written tonight.',
  'The gloves are off, literally and figuratively.',
  'Two styles that should never have to meet - and now they do.',
  "This one settles an argument that's been brewing for weeks.",
  'Winner takes all. Loser takes the walk of shame.'
];

const doubleKOTaglines = [
  'Nobody walks away unscathed.',
  'Two warriors, zero survivors.',
  'Sometimes there is no winner - only witnesses.',
  'The rarest result in the sport: both down, none standing.',
  'A war with no victor, only a legacy.'
];

// `exclude` (all optional): { coldOpens, victoryLines, victoryColorNotes,
// signoffAsides, finalSignoffs, statInsightPhrases, fightHypeTaglines,
// doubleKOTaglines, arenaNames, trainerA, trainerB } - the phrase-bank
// entries are each a Set of indices to avoid; arenaNames/trainerA/trainerB
// are passed straight through to generateArena()/generateTrainer() in their
// existing value-based exclude shape. Returns `usedIndices` (what was
// actually picked this episode, for the caller to persist) alongside the
// existing title/beats/trainerA/trainerB/arena.
export function buildEpisodeScript({ showName, episodeNumber, dateStr, creatureA, creatureB, battleResult, exclude = {} }) {
  const trainerA = generateTrainer(exclude.trainerA || {});
  const trainerB = generateTrainer(exclude.trainerB || {});
  const arena = generateArena(exclude.arenaNames);

  const used = {};

  const beats = [
    ...introBeats(showName, episodeNumber, dateStr, creatureA, creatureB, trainerA, trainerB, arena, exclude, used),
    ...battleBeats(battleResult, creatureA, creatureB, exclude, used),
    ...signoffBeats(showName, battleResult.winner, exclude, used)
  ];

  const taglinePool = battleResult.winner ? fightHypeTaglines : doubleKOTaglines;
  const taglineExclude = battleResult.winner ? exclude.fightHypeTaglines : exclude.doubleKOTaglines;
  const tagline = pickIndexed(taglinePool, taglineExclude);
  used[battleResult.winner ? 'fightHypeTaglines' : 'doubleKOTaglines'] = tagline.index;

  const title = `${creatureA.name} vs ${creatureB.name} - ${tagline.item}`;

  return { title, beats, trainerA, trainerB, arena, usedIndices: used };
}
