import { moveVerbs, critLines, missLines, superEffectiveLines, resistedLines } from './battle.js';
import { typeNamesOf, bestEffectiveness, bestAttackingType } from './type-effectiveness.js';
import { generateTrainer, buildTrainerIntroLine } from './trainers.js';
import { generateArena, buildArenaIntroLine } from './arenas.js';

// NEW: Import condition-aware narration helpers (Tier 3A)
import { buildConditionIntroLine } from './arena-conditions.js';

// OVERHAULED 2026-08-08 - moved from a two-host sportscast format (Duke on
// play-by-play, Doc on color commentary) to a single narrator delivering a
// nightly news-style report. Kids consistently preferred the color-
// commentary voice/tone (explanatory, personality-driven, insight-focused)
// over the frantic play-by-play shouting - so that's now the ONLY voice.
// Every beat carries `speaker: 'narrator'`. The external contract
// (buildEpisodeScript's input/output shape, the exclude/used phrase-bank
// keys) is UNCHANGED from the previous version on purpose, so index.js's
// history-tracking machinery keeps working without modification - only its
// speakerLabel display map needs a one-line update (see integration notes).
//
// Also added: a pronunciation layer (speakable()) for the ~13 real Pokemon
// names in the pool with hyphens/colons/apostrophes that trip up TTS
// (Ho-Oh, Type: Null, Kommo-o, Sirfetch'd, etc.) - applied only to spoken
// text, never to the underlying creature.name used for battle-log matching,
// the episode title, or the poster/RSS keys.
//
// NEW (Tier 3A): Added buildCommentaryWithEnvironment() to layer environmental
// flavor onto battle commentary based on real-world conditions from EARTH_KV
// and SPACE_KV. This aligns narration with battle outcomes without changing
// the actual simulation logic.

const NARRATOR = 'Doc';

// --- Pronunciation layer -------------------------------------------------
// Real display name (creature.name) stays untouched everywhere else - this
// only rewrites the text actually sent to TTS, so titles/RSS/poster keys
// remain the accurate species name.
const SPEAKABLE_NAME_OVERRIDES = {
  'Porygon2': 'Porygon Two',
  'Porygon-Z': 'Porygon Zee',
  'Ho-Oh': 'Ho Oh',
  'Type: Null': 'Type Null',
  'Jangmo-o': 'Jangmo Oh',
  'Hakamo-o': 'Hakamo Oh',
  'Kommo-o': 'Kommo Oh',
  "Sirfetch\u2019d": "Sirfetch'd",
  'Mr. Rime': 'Mister Rime',
  'Wo-Chien': 'Wo Chien',
  'Chien-Pao': 'Chien Pao',
  'Ting-Lu': 'Ting Lu',
  'Chi-Yu': 'Chi Yu'
};

function speakable(name) {
  return SPEAKABLE_NAME_OVERRIDES[name] || name;
}

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

function pick(arr, excludeIndices) {
  return pickIndexed(arr, excludeIndices).item;
}

function typeLine(creature) {
  return creature.secondaryType
    ? `${creature.primaryType.name} and ${creature.secondaryType.name} type`
    : `${creature.primaryType.name} type`;
}

// Words whose SPOKEN form opens with a vowel sound despite a consonant
// letter - "HP" is narrated "aitch-pee", so it takes "an". This matters
// because these strings go to TTS, where the letter is irrelevant and only
// the sound is heard. (Episode 29 shipped "That's a attack advantage";
// without this the same fix would have produced "a HP advantage" instead.)
const VOWEL_SOUND_INITIALS = /^(HP|MP|F|H|L|M|N|R|S|X)$/;

function article(word) {
  const w = String(word || '');
  if (VOWEL_SOUND_INITIALS.test(w)) return 'an';
  return /^[aeiou]/i.test(w) ? 'an' : 'a';
}

// creature.description (built once in creatures.js) embeds the raw
// creature.name - speakable() never touches it since it's generated
// upstream. Rewrite that one occurrence before narrating it.
function speakableDescription(creature) {
  return creature.description.split(creature.name).join(speakable(creature.name));
}

// --- Insight banks (unchanged in substance, just no longer handed off
// between two hosts - these already read fine as solo analyst lines) ------

// Reworded 2026-08-13. Every line here previously made a MECHANICAL claim
// that battle.js does not implement - "punch above its weight the lower its
// HP gets", "the speed stat on the sheet stops mattering", "can't be dropped
// in one shot". battle.js's damage formula reads only hp/attack/defense/
// speed; no ability is consulted anywhere in it. Episode 29 promised Blaze
// would matter "in a long fight" and Tepig was knocked out by the first
// landed attack.
//
// Rather than implement 28 abilities in the sim, these are now framed as
// REPUTATION - what the ability is known for among trainers, which is true
// of the real Pokemon and makes no promise about tonight's outcome. The
// listener still learns something real; the narrator just stops forecasting
// mechanics the fight can't deliver. (Type effectiveness is the one
// exception worth actually wiring into battle.js - it's cheap, the audience
// can verify it, and the typeChart already exists in this file.)
const abilityInsights = {
  Blaze: 'Blaze is the classic Fire-starter trait - the kind of reputation that makes opponents wary of letting things drag on.',
  Torrent: 'Torrent is the water-flavored cousin of Blaze, and it carries the same reputation for late-fight comebacks.',
  Overgrow: 'Overgrow has a slow-burn reputation among trainers - a name you hear in stories about long, grinding matches.',
  Static: 'Static has a reputation for quiet disruption - nothing flashy, but aggressive opponents tend to respect it.',
  Intimidate: "Intimidate is as much a reputation as an ability - opponents know the name before the match even starts.",
  Levitate: "Levitate is famous for shrugging off an entire attack category - a reputation few competitors can claim.",
  'Flash Fire': 'Flash Fire is known as a hard counter to fire-heavy opponents - the kind of name that changes how a card is scouted.',
  'Water Absorb': 'Water Absorb has the same reputation on the water side - a real headache for a water-leaning opponent.',
  'Volt Absorb': "Volt Absorb is known for turning electric attacks into an advantage - a reputation worth respecting.",
  Pressure: "Pressure has a war-of-attrition reputation - a name associated with patient fighters, not flashy ones.",
  'Thick Fat': 'Thick Fat is quietly one of the most respected defensive names in the game.',
  Adaptability: 'Adaptability is known for making same-type offense hit harder than a stat sheet would suggest.',
  'Swift Swim': "Swift Swim has a reputation for making speed numbers look misleading under the right conditions.",
  Regenerator: 'Regenerator is known for sustain - the sort of ability other trainers openly envy.',
  'Magic Guard': 'Magic Guard has a reputation for shrugging off everything that is not a direct hit.',
  Multiscale: "Multiscale is known for making that opening hit less frightening than it looks.",
  Sturdy: "Sturdy carries a reputation for refusing to go down easily - a name that shapes how opponents plan.",
  'Iron Fist': 'Iron Fist is known for hitting harder than the base numbers suggest.',
  'Sheer Force': 'Sheer Force has a high-ceiling reputation - trainers who run it tend to like living dangerously.',
  'Prism Armor': "Prism Armor is known for blunting bad matchups - a rare and well-regarded name.",
  Unaware: 'Unaware has a reputation for ignoring stat games entirely - opponents who like to boost find it frustrating.',
  Moxie: 'Moxie is known for snowballing - a name that gets more attention the longer a fighter stays undefeated.',
  'Sand Veil': 'Sand Veil is known for being a nightmare to pin down in the right terrain.',
  'Snow Cloak': 'Snow Cloak has the same reputation as Sand Veil, just for the cold end of the map.',
  'Poison Heal': 'Poison Heal is famous for turning something harmful into an advantage - a genuinely backwards-feeling name.',
  'Rough Skin': 'Rough Skin has a reputation for punishing opponents who like to get close.',
  'Tinted Lens': "Tinted Lens is known for flattening out matchups that ought to look one-sided.",
  'Wonder Skin': 'Wonder Skin is known as a real answer to status-heavy opponents.'
};

// The local typeChart that used to live here has been REPLACED by the
// shared ./type-effectiveness.js module (2026-08-13). It was narration-only
// while battle.js had no type term at all, which is what produced the
// episode 24 Charmeleon/Escavalier contradiction. Its `weak` field also had
// inverted semantics vs `strong` and was never read - see the note in the
// new module. Both files now read the same data.


function typeMatchupNote(a, b) {
  const aTypes = typeNamesOf(a);
  const bTypes = typeNamesOf(b);

  // Now reads the SAME multiplier battle.js applies to damage, rather than a
  // parallel chart. Whatever this line predicts, the fight will honor.
  const aMult = bestEffectiveness(aTypes, bTypes);
  const bMult = bestEffectiveness(bTypes, aTypes);

  // Report whichever side has the larger genuine edge, so a mutual-advantage
  // matchup doesn't silently favor whoever happens to be creature A.
  if (aMult > 1 && aMult >= bMult) {
    const at = bestAttackingType(aTypes, bTypes);
    const emphasis = aMult >= 4 ? 'a massive' : 'a real';
    return `On paper that is ${emphasis} type advantage for ${speakable(a.name)} - ${at} hits this matchup hard, and if it presses that early this could get lopsided fast.`;
  }
  if (bMult > 1) {
    const bt = bestAttackingType(bTypes, aTypes);
    const emphasis = bMult >= 4 ? 'a massive' : 'a real';
    return `Type-wise ${speakable(b.name)} has ${emphasis} edge here - ${bt} is a bad matchup for the other side of this card.`;
  }
  if (aMult < 1 && bMult < 1) {
    return `Both of these are swinging into unfavorable typing tonight - expect a grind rather than a quick finish.`;
  }
  return `No clean type advantage either direction here - this one likely comes down to the raw stat sheet, not the matchup chart.`;
}

// --- Blowout handling (added 2026-08-13) -----------------------------------
//
// Episode 29 (Tepig 308 BST vs Urshifu 550 BST) ended in a single hit: 113
// damage into 65 HP. The narration still called it "a card that does not
// disappoint", "What a battle", and "a genuinely well-fought match on both
// sides" - because every phrase bank in this file was written assuming a
// competitive fight, and nothing here knew otherwise. These banks give the
// narrator honest language for a squash, which is a better listen than
// false suspense: kids notice when the commentary disagrees with what just
// happened.
//
// A fight is a blowout if it ended fast AND the loser never meaningfully
// threatened - both conditions, so a genuine back-and-forth that happens to
// end quickly doesn't get downgraded.
function isBlowout(log, winnerCreature, loserCreature) {
  if (!Array.isArray(log) || !log.length) return false;
  const landed = log.filter(e => e.type !== 'miss');
  if (landed.length > 3) return false;

  // Did the loser ever land damage on the winner?
  const damageToWinner = landed
    .filter(e => e.attacker === loserCreature.name)
    .reduce((sum, e) => sum + (e.damage || 0), 0);
  const winnerHp = winnerCreature.stats.hp || 1;
  return (damageToWinner / winnerHp) < 0.25;
}

const blowoutVictoryColorNotes = [
  (winner, loser) => `There is no other way to describe that: ${winner} was simply operating at a different level tonight.`,
  (winner, loser) => `That was over before it started. ${winner} did not give ${loser} a single opening to work with.`,
  (winner, loser) => `One-sided from the opening bell - ${winner} ended it at the first real opportunity.`,
  (winner, loser) => `${winner} needed one clean look and took it. ${loser} never got to show what it came in with.`
];

const blowoutAsides = [
  () => `Short night in the arena, but a decisive one.`,
  () => `Not every card goes the distance - some are settled in a single exchange.`,
  () => `A mismatch on paper, and it played out that way.`,
  () => `Quick work tonight. We will see a closer one soon enough.`
];

// REMOVED 2026-08-22 (Episode 38 review): blowoutSignoffRecaps used to
// supply this beat's recap line on a blowout - "came in with the advantage
// and never let the question get asked" - which restates the exact claim
// battleBeats already made two beats earlier via blowoutVictoryColorNotes
// ("did not give a single opening to work with"). Both banks independently
// assert "this was one-sided" with no awareness of each other, which is
// what produced Episode 38's four consecutive one-sided-restating
// sentences. signoffBeats() below no longer manufactures a second
// dominance claim - see the blowout branch there.

const statInsightPhrases = [
  (winner, statName) => `${winner} simply outclassed the field in ${statName} tonight, and it showed.`,
  (winner, statName) => `Break down the numbers and ${winner}'s ${statName} was the real difference-maker.`,
  (winner, statName) => `That's ${article(statName)} ${statName} advantage translating directly into a result - nothing lucky about it.`
];

// A stat lead only gets credit for the result if it is actually large enough
// to have plausibly mattered. Previously this took the single largest raw
// diff regardless of size, which produced episode 26's claim that Porygon2
// "outclassed the field in HP" off an 85-vs-80 edge - while ignoring that it
// was OUT-statted 80-vs-120 on attack and lost the speed tempo. Two guards
// now: an absolute floor and a relative floor, both of which must clear.
const MIN_STAT_GAP = 15;      // raw points
const MIN_STAT_GAP_PCT = 0.18; // relative to the loser's value

// If the fight actually turned on whiffed attacks rather than the stat sheet,
// say so - crediting a stat lead in a miss-decided fight is the same class of
// wrong answer as crediting a 5-point HP edge.
function missDecided(log) {
  if (!Array.isArray(log) || !log.length) return false;
  const misses = log.filter(e => e.type === 'miss').length;
  return misses >= 2 && misses / log.length >= 0.4;
}

function decisiveStatNote(winnerCreature, loserCreature, exclude, log) {
  const winnerSpeakable = speakable(winnerCreature.name);

  if (missDecided(log)) {
    return { text: `The stat sheet did not decide this one - ${winnerSpeakable} stayed composed while the attacks that mattered sailed wide.`, index: null };
  }

  const stats = ['hp', 'attack', 'defense', 'speed'];
  const statLabels = { hp: 'HP', attack: 'attack', defense: 'defense', speed: 'speed' };
  let biggestGap = null;
  for (const s of stats) {
    const gap = winnerCreature.stats[s] - loserCreature.stats[s];
    const pct = loserCreature.stats[s] > 0 ? gap / loserCreature.stats[s] : 0;
    if (gap < MIN_STAT_GAP || pct < MIN_STAT_GAP_PCT) continue;
    if (!biggestGap || gap > biggestGap.gap) biggestGap = { stat: s, gap };
  }

  if (!biggestGap) {
    return { text: `Statistically this was close to even - ${winnerSpeakable} won this one on execution, not raw numbers.`, index: null };
  }

  const { item, index } = pickIndexed(statInsightPhrases, exclude);
  return { text: item(winnerSpeakable, statLabels[biggestGap.stat]), index };
}

// --- NEW: Environment-aware commentary builder (Tier 3A) ---
/**
 * Layers environmental flavor onto battle commentary based on real-world
 * conditions, without changing the actual battle outcome.
 * Only adds flavor when it makes narrative sense.
 */
function buildCommentaryWithEnvironment(winnerSpeakable, loserSpeakable, winnerCreature, loserCreature, conditions) {
  if (!conditions || (!conditions.earthData && !conditions.spaceData)) {
    return ''; // No conditions available, no environmental flavor
  }

  const { earthData, spaceData, earth, space } = conditions;

  // EARTHQUAKE: Ground-types gain narrative advantage
  if (earth === 'earthquake-active' && winnerCreature.primaryType.name === 'Ground') {
    return ` The tremors beneath the arena gave ${winnerSpeakable} the edge - instability that Ground-types master.`;
  }

  // VOLCANO: Fire-types get narrative boost; Water-types struggle
  if (earth === 'volcano-active') {
    if (winnerCreature.primaryType.name === 'Fire') {
      return ` The volcanic heat seemed to feed ${winnerSpeakable}'s intensity.`;
    }
  }

  // WILDFIRE: Fire or Flying types
  if (earth === 'wildfire-active') {
    if (winnerCreature.primaryType.name === 'Fire') {
      return ` The distant wildfire's energy seemed to embolden ${winnerSpeakable}'s offense.`;
    }
    if (winnerCreature.primaryType.name === 'Flying') {
      return ` ${winnerSpeakable}'s mastery of the smoke-filled skies proved decisive.`;
    }
  }

  // STORM: Electric-types shine
  if (earth === 'storm-active' && winnerCreature.primaryType.name === 'Electric') {
    return ` The charged atmosphere amplified every Electric-type move from ${winnerSpeakable}.`;
  }

  // LAUNCH WINDOW (immediate): Flying types
  if (space === 'launch-window-immediate' && winnerCreature.primaryType.name === 'Flying') {
    return ` With a rocket launching within hours, the sky itself felt electric - perfect for ${winnerSpeakable}'s dominance.`;
  }

  // ISS VISIBLE: Psychic or Steel types
  if (space === 'iss-visible') {
    if (winnerCreature.primaryType.name === 'Psychic') {
      return ` The ISS passing overhead seemed to align with ${winnerSpeakable}'s focus.`;
    }
    if (winnerCreature.primaryType.name === 'Steel') {
      return ` The steel of human spacecraft overhead inspired ${winnerSpeakable}'s precision.`;
    }
  }

  // No matching condition found; return empty string (no extra flavor)
  return '';
}

// --- Narrator phrase banks -----------------------------------------------
// Same bank NAMES as before (coldOpens, victoryLines, victoryColorNotes,
// signoffAsides, finalSignoffs, fightHypeTaglines, doubleKOTaglines) so
// index.js's history-tracking exclude/used object needs zero changes -
// only the CONTENT changed, to a single solo-narrator news voice.

const coldOpens = [
  (showName, n, date) => `Tonight on ${showName}, episode ${n} - recorded ${date} - a matchup that's been building all day finally hits the arena.`,
  (showName, n, date) => `This is ${showName}, episode ${n}, recorded ${date}. I'm ${NARRATOR}, and tonight's card is one worth staying for.`,
  (showName, n, date) => `Episode ${n} of ${showName}, recorded ${date}. Two very different fighters, one arena, and by the end of tonight only one of them is still standing.`,
  (showName, n, date) => `Welcome to ${showName}, episode ${n}, recorded ${date}. Tonight's matchup has been the talk of the arena all week - let's get into it.`,
  (showName, n, date) => `${showName}, episode ${n}, recorded ${date}. I'm ${NARRATOR}, and I'll tell you up front - tonight's fight does not go the way you'd expect on paper.`,
  (showName, n, date) => `Here's tonight's report from ${showName}, episode ${n}, recorded ${date}. One arena, two contenders, and a finish worth waiting for.`,
  (showName, n, date) => `Episode ${n} of ${showName}, recorded ${date} - and honestly, this is one of the more interesting stat-sheet mismatches we've covered in a while.`,
  (showName, n, date) => `Grab a seat - this is ${showName}, episode ${n}, recorded ${date}, and tonight's card does not disappoint.`
];

const victoryLines = [
  (winner, loser) => `And that's it - ${winner} takes the victory, sending ${loser} to the mat.`,
  (winner, loser) => `That's all she wrote. ${winner} puts ${loser} away for good.`,
  (winner, loser) => `It's over. ${winner} closes it out, and ${loser} simply couldn't find an answer tonight.`,
  (winner, loser) => `There's your winner: ${winner}. A finish that settles any argument about who came in better prepared.`,
  (winner, loser) => `And that's the ballgame - ${winner} gets it done, and ${loser} has nothing left to answer with.`,
  (winner, loser) => `There's the final blow. ${winner} takes this one, and ${loser} goes down swinging.`,
  (winner, loser) => `Call it - ${winner} wins it, and ${loser} has absolutely nothing left to answer with.`,
  (winner, loser) => `And ${winner} seals it right there - ${loser} could not weather that last exchange.`
];

const victoryColorNotes = [
  (winner) => `What stands out from this one is that ${winner} never panicked. That's the difference at this level.`,
  (winner) => `That's about as clean a performance as you'll see - ${winner} in complete control the whole way.`,
  (winner) => `${winner} fought smart, took the openings when they came, and never gave the opponent a real window back in.`,
  (winner) => `${winner} finishes that barely even breathing hard. That's a statement, not just a win.`,
  (winner) => `Credit where it's due - ${winner} read every exchange a half-step ahead tonight.`,
  (winner) => `You don't get a finish like that without discipline. ${winner} earned every bit of it.`
];

// Verbs for MISSED attacks. moveVerbs (from battle.js) all assert a landed
// hit ("connects a brutal hit on", "unleashes a devastating strike on"), so
// composing them with a missLine produced self-contradicting narration:
// "Mabosstiff connects a brutal hit on Porygon Two, but it whiffs completely!"
// (observed live, episode 26). These describe the ATTEMPT only, so the
// missLine that follows resolves it.
const attemptVerbs = [
  'lunges at',
  'comes charging in at',
  'swings on',
  'goes after',
  'winds up on',
  'closes the distance on',
  'takes a shot at',
  'drives forward at'
];

const signoffAsides = [
  () => `Congratulations to the winner and their trainer on a hard-fought result.`,
  () => `Another good one in the books. Same time tomorrow.`,
  () => `Solid card tonight - both of them left it all in that arena.`,
  () => `That's the kind of result that's going to be talked about in the arena for a few days.`,
  () => `A genuinely well-fought match on both sides tonight.`,
  () => `That's tonight's story, and it's a good one.`
];

const finalSignoffs = [
  (showName) => `That's the bell, that's the battle, and that's another episode of ${showName} in the books. Until next time - train hard, battle smart, and we'll see you tomorrow.`,
  (showName) => `From ${showName} - signing off. Tell a friend, a brand new battle drops tomorrow.`,
  (showName) => `That's the bell, that's the fight, that's another ${showName} in the books. I'm ${NARRATOR} - we'll see you tomorrow.`,
  (showName) => `From all of us at ${showName} - that's a wrap on tonight. I'm ${NARRATOR}, see you next time.`,
  (showName) => `That'll do it for tonight's ${showName}. Same time tomorrow.`,
  (showName) => `And that's a wrap on another ${showName}. Go rest up - tomorrow's card is already looking good.`
];

const fightHypeTaglines = [
  "Power meets power. Something's got to give.",
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

// --- Beat builders ---------------------------------------------------------
// Everything below returns { speaker: 'narrator', text } - a single voice
// throughout. Structured like a nightly report: lead, profiles, scene,
// analysis, recap, takeaway, sign-off - rather than alternating shout/
// respond beats between two hosts.

function introBeats(showName, episodeNumber, dateStr, a, b, trainerA, trainerB, arena, exclude, used, conditions) {
  const beats = [];

  const coldOpen = pickIndexed(coldOpens, exclude.coldOpens);
  used.coldOpens = coldOpen.index;
  beats.push({ speaker: 'narrator', text: coldOpen.item(showName, episodeNumber, dateStr) });

  // NEW (Tier 3A): Add condition intro line if conditions exist
  // buildConditionIntroLine returns null on a quiet day (see the note in
  // arena-conditions.js) - skip the beat entirely rather than narrating
  // filler. The old guard tested conditions.earth, which is ALWAYS truthy
  // because QUIET_DAY is its floor value, so this beat fired every episode.
  if (conditions) {
    const conditionIntro = buildConditionIntroLine(conditions);
    if (conditionIntro) beats.push({ speaker: 'narrator', text: conditionIntro });
  }

  // Creature A: reveal + type/ability/description/insight folded into one
  // flowing profile paragraph instead of a reveal-then-handoff exchange.
  beats.push({ speaker: 'narrator', text:
    `In the first corner tonight: standing ${a.height} feet tall and weighing ${a.weight} pounds, ${speakable(a.name)} - ${article(a.primaryType.name)} ${typeLine(a)} running ${a.ability}. ${speakableDescription(a)} ${abilityInsights[a.ability] || 'Not an ability you hear about every night, but it has its admirers.'}` });

  beats.push({ speaker: 'narrator', text:
    `Backing ${speakable(a.name)} tonight is trainer ${trainerA.name}, who ${trainerA.background}. Fighting out of ${trainerA.hometown}, ${trainerA.name} ${trainerA.quirk}.` });

  // Creature B
  beats.push({ speaker: 'narrator', text:
    `Across the arena: standing ${b.height} feet tall and weighing ${b.weight} pounds, ${speakable(b.name)} - ${article(b.primaryType.name)} ${typeLine(b)}, carrying ${b.ability}. ${speakableDescription(b)} ${abilityInsights[b.ability] || "A less common name, and one this trainer clearly has a reason for running."}` });

  beats.push({ speaker: 'narrator', text:
    `And guiding ${speakable(b.name)} is trainer ${trainerB.name}, who comes to us from ${trainerB.hometown}, and ${trainerB.quirk}.` });

  // Scene-setting - arena and legend, kept as its own dateline-style beat.
  beats.push({ speaker: 'narrator', text: buildArenaIntroLine(arena) });
  const legendSentence = arena.legend.charAt(0).toUpperCase() + arena.legend.slice(1);
  beats.push({ speaker: 'narrator', text: `A bit of history on this venue: ${legendSentence}.` });

  // Stats + type analysis, combined into one analyst paragraph.
  beats.push({ speaker: 'narrator', text:
    `Here's how the numbers stack up heading in - ${speakable(a.name)}: ${a.stats.hp} HP, ${a.stats.attack} attack, ${a.stats.defense} defense, ${a.stats.speed} speed. ` +
    `${speakable(b.name)}: ${b.stats.hp} HP, ${b.stats.attack} attack, ${b.stats.defense} defense, ${b.stats.speed} speed. ` +
    `${a.stats.speed >= b.stats.speed ? speakable(a.name) : speakable(b.name)} gets first tempo tonight - that matters more than people give it credit for. ${typeMatchupNote(a, b)}` });

  return beats;
}

function battleBeats(battleResult, a, b, exclude, used) {
  const { log, winner, loser } = battleResult;
  const beats = [{ speaker: 'narrator', text: `And with that, the fight is underway.` }];

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
  const speak = (rawName) => (rawName === a.name ? speakable(a.name) : rawName === b.name ? speakable(b.name) : rawName);

  highlights.forEach(event => {
    if (event.type === 'miss') {
      beats.push({ speaker: 'narrator', text:
        `${speak(event.attacker)} ${pick(attemptVerbs)} ${speak(event.defender)}, ${pick(missLines)}` });
      return;
    }

    // Type effectiveness is now a real damage term (see battle.js), so the
    // narration reflects it - a 4x hit that sounds identical to a neutral
    // one wastes the mechanic entirely. Reads straight off the log's own
    // effectiveness field, so commentary and math cannot disagree.
    let effectSuffix = '';
    if (event.effectiveness >= 2) effectSuffix = ` - ${pick(superEffectiveLines)}`;
    else if (event.effectiveness <= 0.5) effectSuffix = ` - ${pick(resistedLines)}`;

    if (event.type === 'crit') {
      beats.push({ speaker: 'narrator', text:
        `Then came the moment that swung this fight: ${speak(event.attacker)} ${pick(moveVerbs)} ${speak(event.defender)}. ${pick(critLines)} a massive ${event.damage} damage, dropping ${speak(event.defender)} to ${event.defenderHpRemaining} out of ${event.defenderMaxHp} HP${effectSuffix}. That's the kind of hit that isn't random noise - it's exactly the kind of variance that separates a close matchup from a rout.` });
    } else {
      beats.push({ speaker: 'narrator', text:
        `${speak(event.attacker)} ${pick(moveVerbs)} ${speak(event.defender)} for ${event.damage} damage${effectSuffix}, leaving them at ${event.defenderHpRemaining} out of ${event.defenderMaxHp} HP.` });
    }

    const hpPct = event.defenderHpRemaining / event.defenderMaxHp;
    if (hpPct <= 0.3 && hpPct > 0 && !dangerCalled.has(event.defender)) {
      dangerCalled.add(event.defender);
      beats.push({ speaker: 'narrator', text:
        `That puts ${speak(event.defender)} into the danger zone, under thirty percent - one more clean hit like that likely ends this.` });
    }
  });

  if (winner) {
    const winnerSpeakable = speakable(winner);
    const loserSpeakable = speakable(loser);

    const winnerCreature = winner === a.name ? a : b;
    const loserCreature = winner === a.name ? b : a;
    const blowout = isBlowout(log, winnerCreature, loserCreature);

    const victoryLine = pickIndexed(victoryLines, exclude.victoryLines);
    used.victoryLines = victoryLine.index;

    // On a blowout, swap the color note for one that matches what actually
    // happened. The blowout banks are NOT index-tracked against
    // exclude.victoryColorNotes - they're a separate, smaller pool, and
    // reusing that exclude key across two different-length banks would let a
    // stale index point out of range. Blowouts are infrequent enough that
    // unfiltered repetition is acceptable; the contract shape is unchanged.
    let colorNoteText;
    if (blowout) {
      colorNoteText = pick(blowoutVictoryColorNotes)(winnerSpeakable, loserSpeakable);
    } else {
      const victoryColorNote = pickIndexed(victoryColorNotes, exclude.victoryColorNotes);
      used.victoryColorNotes = victoryColorNote.index;
      colorNoteText = victoryColorNote.item(winnerSpeakable);
    }

    const statNote = decisiveStatNote(winnerCreature, loserCreature, exclude.statInsightPhrases, log);
    used.statInsightPhrases = statNote.index;

    beats.push({ speaker: 'narrator', text: victoryLine.item(winnerSpeakable, loserSpeakable) });
    beats.push({ speaker: 'narrator', text: `${colorNoteText} ${statNote.text}` });
  } else {
    beats.push({ speaker: 'narrator', text:
      `Unbelievable - both competitors go down in the same exchange. A genuine double knockout, and statistically these two were about as evenly matched as it gets tonight. The result backs that up.` });
  }

  return beats;
}

function signoffBeats(showName, winner, exclude, used, conditions, winnerCreature, loserCreature, blowout) {
  const winnerSpeakable = winner ? speakable(winner) : null;

  // On a blowout, both the recap ("What a battle") and the aside ("a
  // genuinely well-fought match on both sides") actively contradict what
  // the listener just heard - see the isBlowout note above.
  const aside = blowout
    ? { item: pick(blowoutAsides), index: null }
    : pickIndexed(signoffAsides, exclude.signoffAsides);
  if (!blowout) used.signoffAsides = aside.index;

  const final = pickIndexed(finalSignoffs, exclude.finalSignoffs);
  used.finalSignoffs = final.index;

  // NEW (Tier 3A): Add environmental commentary to the recap beat
  let environmentalCommentary = '';
  if (winner && conditions && winnerCreature) {
    environmentalCommentary = buildCommentaryWithEnvironment(
      winnerSpeakable,
      null,
      winnerCreature,
      null,
      conditions
    );
  }

  let recap;
  if (!winner) {
    recap = `What a battle. A wild one to end on today.`;
  } else if (blowout) {
    // battleBeats already made the case for why this was decisive
    // (blowoutVictoryColorNotes + the stat/miss note from decisiveStatNote).
    // This beat's job now is to add something NEW - environmental flavor if
    // there is any - rather than restate "it was one-sided" a third or
    // fourth time. When there's no environmental flavor to add, this beat
    // contributes nothing of its own and just carries the aside below.
    recap = environmentalCommentary ? environmentalCommentary.trim() : '';
  } else {
    recap = `What a battle. ${winnerSpeakable} fought smart, fought hard, and tonight fought to win.${environmentalCommentary}`;
  }

  // Join with the aside via filter(Boolean) rather than a hardcoded
  // template - on a blowout, recap may now be an empty string, and a plain
  // `${recap} ${aside.item()}` would leave a leading space / empty-looking
  // beat.
  const wrapText = [recap, aside.item()].filter((s) => s && s.trim().length).join(' ');

  return [
    { speaker: 'narrator', text: wrapText },
    { speaker: 'narrator', text: final.item(showName) }
  ];
}

// `exclude` (all optional): { coldOpens, victoryLines, victoryColorNotes,
// signoffAsides, finalSignoffs, statInsightPhrases, fightHypeTaglines,
// doubleKOTaglines, arenaNames, trainerA, trainerB } - UNCHANGED shape from
// the previous version. Returns { title, beats, trainerA, trainerB, arena,
// usedIndices } - also unchanged, so index.js needs no changes to the call
// site itself (only its speakerLabel display map, see integration notes).
//
// CHANGED (Tier 1-2): Now accepts preGeneratedArena and conditions from index.js
// so that a pre-weighted arena variant is used instead of being randomly generated here.
export function buildEpisodeScript({ showName, episodeNumber, dateStr, creatureA, creatureB, battleResult, exclude = {}, preGeneratedArena = null, conditions = null }) {
  const trainerA = generateTrainer(exclude.trainerA || {});
  let trainerB = generateTrainer(exclude.trainerB || {});

  // Episode 38: trainerA and trainerB independently drew the identical
  // background AND the identical quirk ("quiet farming town rarely
  // mentioned outside regional news" / "carries a small, unrelated
  // good-luck trinket to every match") in the SAME episode. exclude.trainerA
  // and exclude.trainerB only de-duplicate each trainer against PAST
  // episodes - nothing checks the two trainers against each other within
  // one episode, since generateTrainer has no idea a sibling trainer is
  // being generated in the same call. Retry trainerB a few times if it
  // collides with trainerA on any of the three flavor fields. Capped
  // rather than looped forever, in case a heavily-excluded pool genuinely
  // can't produce a non-colliding result - an occasional rare collision is
  // a far better failure mode than an infinite loop.
  const MAX_TRAINER_RETRY = 5;
  let trainerRetries = 0;
  while (
    trainerRetries < MAX_TRAINER_RETRY &&
    (trainerB.background === trainerA.background ||
      trainerB.hometown === trainerA.hometown ||
      trainerB.quirk === trainerA.quirk)
  ) {
    trainerB = generateTrainer(exclude.trainerB || {});
    trainerRetries++;
  }

  // If preGeneratedArena is provided (from index.js Tier 1-2), use it;
  // otherwise, generate one normally. This keeps backwards compatibility.
  const arena = preGeneratedArena || generateArena(exclude.arenaNames);

  const used = {};

  // Get winner creature for environmental commentary (Tier 3A)
  const winnerCreature = battleResult.winner === creatureA.name ? creatureA : (battleResult.winner === creatureB.name ? creatureB : null);
  const loserCreature = battleResult.loser === creatureA.name ? creatureA : (battleResult.loser === creatureB.name ? creatureB : null);

  // Computed once here so battleBeats and signoffBeats agree on it - a
  // fight narrated as a squash in the recap must not be called "a genuinely
  // well-fought match on both sides" two beats later.
  const blowout = (winnerCreature && loserCreature)
    ? isBlowout(battleResult.log, winnerCreature, loserCreature)
    : false;

  const beats = [
    ...introBeats(showName, episodeNumber, dateStr, creatureA, creatureB, trainerA, trainerB, arena, exclude, used, conditions),
    ...battleBeats(battleResult, creatureA, creatureB, exclude, used),
    ...signoffBeats(showName, battleResult.winner, exclude, used, conditions, winnerCreature, loserCreature, blowout)
  ];

  const taglinePool = battleResult.winner ? fightHypeTaglines : doubleKOTaglines;
  const taglineExclude = battleResult.winner ? exclude.fightHypeTaglines : exclude.doubleKOTaglines;
  const tagline = pickIndexed(taglinePool, taglineExclude);
  used[battleResult.winner ? 'fightHypeTaglines' : 'doubleKOTaglines'] = tagline.index;

  const title = `${creatureA.name} vs ${creatureB.name} - ${tagline.item}`;

  return { title, beats, trainerA, trainerB, arena, usedIndices: used };
}
