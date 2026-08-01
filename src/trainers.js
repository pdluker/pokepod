// trainers.js
// Generates one trainer per creature per episode — a name + a short,
// flavorful background. Keeps things generic/original (no franchise IP)
// consistent with the copyright approach already used in poster.js.
//
// Expanded 2026-07-30: names/backgrounds/styles pools roughly doubled, and
// two new pools added (QUIRKS, HOMETOWNS) for a second and third layer of
// characterization beyond background+style alone. generateTrainer()'s
// existing fields (name, background, style, bio) are unchanged in meaning;
// quirk and hometown are pure additions to the returned object.
// buildTrainerIntroLine()'s signature and behavior are unchanged.

const FIRST_NAMES = [
  "Mara", "Kellan", "Vira", "Toshi", "Iris", "Dax", "Nyla", "Osric",
  "Fenna", "Barrow", "Quill", "Sable", "Renji", "Yara", "Corvin", "Lira",
  "Bram", "Selene", "Torin", "Amara", "Cassian", "Elowen", "Garrick", "Hazel",
  "Ivo", "Junia", "Kestrel", "Liora", "Merek", "Nadia", "Percy", "Rowena"
];

const SURNAMES = [
  "Ashford", "Voss", "Thistlewood", "Kane", "Marrow", "Winters", "Duskray",
  "Hollis", "Ferro", "Sunwhistle", "Blackwell", "Rook", "Ondine", "Sparrow",
  "Wren", "Castellan", "Fairweather", "Graves", "Hargrove", "Ironside",
  "Larkspur", "Moorwood", "Nightingale", "Osgood", "Pryce", "Quintrell", "Stormwell"
];

const BACKGROUNDS = [
  "grew up chasing wild creatures through the hills outside a small mountain town, and never really stopped",
  "was once a city-league champion who walked away from the spotlight to train quietly, away from the cameras",
  "inherited a battered old training journal from a grandparent and has been filling in the blank pages ever since",
  "started as a battlefield researcher before deciding note-taking wasn't nearly as fun as competing",
  "lost their first ever official match badly, and has trained obsessively every day since to make sure it never happens again",
  "travels light, sleeps in a hammock strung between two starter creatures, and has no permanent address",
  "comes from a long line of trainers and is, depending on who you ask, either upholding or ruining the family name",
  "picked up their signature creature by complete accident during a camping trip and never looked back",
  "trains mostly at night, claiming their creature's instincts sharpen once the crowds go home",
  "is fiercely superstitious about pre-battle rituals, much to the amusement (and occasional frustration) of everyone around them",
  "used to be afraid of their own creature's power before learning to trust it completely",
  "keeps a running rivalry with a training partner that's equal parts friendly and deadly serious",
  "financed their first years of training entirely by winning informal backroom bets",
  "was disqualified from a major tournament years ago under murky circumstances still debated online",
  "apprenticed under a retired legend who has never once publicly commented on their progress",
  "switched disciplines entirely after an injury ended a promising athletic career",
  "publishes an obsessively detailed newsletter that maybe eleven people actually read",
  "has never lost a match on home turf, and makes sure everyone knows it",
  "was raised more by their creature's species than by people, according to family legend",
  "keeps every ticket stub from every match they've ever attended, win or lose",
  "still owes a mentor a rematch from almost a decade ago",
  "trains with a deliberately mismatched roster, insisting variety beats specialization",
  "was the subject of a minor bidding war between regional academies as a teenager",
  "refuses to discuss their record before turning professional, for reasons nobody has pinned down"
];

const STYLES = [
  "an aggressive, all-offense approach that leaves little room for error",
  "a patient, defensive style built around wearing opponents down",
  "an unpredictable, improvisational style that keeps commentators guessing",
  "a deeply technical approach built on exploiting tiny openings",
  "a high-risk style that trades safety for explosive, momentum-swinging plays",
  "a methodical, almost academic approach that treats every match like a puzzle",
  "a showman's style, prioritizing crowd-pleasing plays even at some tactical cost",
  "a minimalist style that wins on efficiency rather than spectacle",
  "an adaptive style that changes noticeably mid-match based on how the opponent responds",
  "a relentless pressure style that rarely lets an opponent reset"
];

// New: quirks add a second, independent flavor layer — a small habit or
// personality detail that isn't about training philosophy at all.
const QUIRKS = [
  "always enters the arena from the same side, regardless of assigned position",
  "talks to their creature constantly mid-battle, win or lose",
  "carries a small, unrelated good-luck trinket to every match",
  "refuses interviews before a match but is famously chatty after one",
  "has a pre-match snack ritual that's become something of a running joke",
  "wears the same battered jacket to every official match",
  "hums the same tune under their breath during tense exchanges",
  "keeps meticulous handwritten notes instead of using any digital tools",
  "is known to applaud a good hit even when it lands against them",
  "never celebrates a win until the opponent has left the arena"
];

// New: hometowns ground each trainer in a place, adding a light worldbuilding
// layer without inventing an entire geography to maintain.
const HOMETOWNS = [
  "a fishing village on the northern coast",
  "a dense mountain settlement known for its training academies",
  "a sprawling inland city with more trainers per capita than anywhere else",
  "a quiet farming town rarely mentioned outside regional news",
  "a former mining outpost that reinvented itself around the sport",
  "a river delta town famous for producing defensive specialists",
  "a desert crossroads settlement where trainers pass through more than they stay",
  "a cliffside town accessible only by a single narrow switchback road",
  "an island community with its own unofficial, fiercely defended league",
  "a border town where training styles from two regions collide"
];

function pick(arr, exclude) {
  if (exclude && exclude.size) {
    const filtered = arr.filter((x) => !exclude.has(x));
    if (filtered.length > 0) return filtered[Math.floor(Math.random() * filtered.length)];
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateTrainer(exclude = {}) {
  const name = `${pick(FIRST_NAMES)} ${pick(SURNAMES)}`;
  const background = pick(BACKGROUNDS, exclude.backgrounds);
  const style = pick(STYLES, exclude.styles);
  const quirk = pick(QUIRKS, exclude.quirks);
  const hometown = pick(HOMETOWNS, exclude.hometowns);
  return {
    name,
    background,
    style,
    quirk,
    hometown,
    bio: `${name} ${background}. Known for ${style}.`
  };
}

// Ready-made spoken intro line for script.js
export function buildTrainerIntroLine(trainer, creatureName) {
  return `Guiding ${creatureName} today is trainer ${trainer.name}, who ${trainer.background}. ` +
    `Expect ${trainer.style} in this one.`;
}
