// Same randomizer logic as the mobile Creature Creator app and the
// original GitHub Actions version — ported to ES module syntax for
// Cloudflare Workers (no Node.js require/module.exports).
//
// Expanded 2026-07-30: every pool grown substantially (roughly 2-3x) and a
// new "renown" line added for extra lore depth.
//
// Exclusion logic added 2026-07-31: pick() now takes an optional exclude
// Set, and generateCreature() takes an optional `exclude` object keyed by
// pool name (habitats, behaviors, traits, powers, renownLevels, bodyTypes,
// facialFeatures, distinctiveFeatures, colorPatterns). This is what actually
// prevents repeats - a bigger pool alone doesn't help if selection has no
// memory. Every raw pick is now also returned on the creature object (not
// just baked into description/visualDescription text) so callers have
// something concrete to record into a history ledger. generateCreature()
// with no arguments behaves exactly as before - this is purely additive.

const types = [
  { name: 'Fire', color: '#F08030', emoji: '🔥' },
  { name: 'Water', color: '#6890F0', emoji: '💧' },
  { name: 'Grass', color: '#78C850', emoji: '🌿' },
  { name: 'Electric', color: '#F8D030', emoji: '⚡' },
  { name: 'Ice', color: '#98D8D8', emoji: '❄️' },
  { name: 'Fighting', color: '#C03028', emoji: '👊' },
  { name: 'Poison', color: '#A040A0', emoji: '☠️' },
  { name: 'Ground', color: '#E0C068', emoji: '🌍' },
  { name: 'Flying', color: '#A890F0', emoji: '🦅' },
  { name: 'Psychic', color: '#F85888', emoji: '🔮' },
  { name: 'Bug', color: '#A8B820', emoji: '🐛' },
  { name: 'Rock', color: '#B8A038', emoji: '🪨' },
  { name: 'Ghost', color: '#705898', emoji: '👻' },
  { name: 'Dragon', color: '#7038F8', emoji: '🐉' },
  { name: 'Dark', color: '#705848', emoji: '🌙' },
  { name: 'Steel', color: '#B8B8D0', emoji: '⚙️' },
  { name: 'Fairy', color: '#EE99AC', emoji: '✨' }
];

const prefixes = [
  'Flame', 'Aqua', 'Terra', 'Bolt', 'Frost', 'Shadow', 'Thunder', 'Crystal',
  'Venom', 'Giga', 'Mega', 'Ultra', 'Hyper', 'Neo', 'Omega', 'Alpha',
  'Nova', 'Void', 'Solar', 'Lunar', 'Ember', 'Glacier', 'Storm', 'Ash',
  'Obsidian', 'Prism', 'Rune', 'Spectre', 'Titan', 'Verdant', 'Wraith', 'Zephyr'
];
const suffixes = [
  'mon', 'saur', 'drake', 'phin', 'toise', 'zard', 'ion', 'eon', 'rex',
  'beast', 'lord', 'fang', 'claw', 'wing', 'tail', 'storm',
  'wyrm', 'hide', 'horn', 'shell', 'mane', 'crest', 'talon', 'scale',
  'gale', 'fury', 'blight', 'grim', 'vane', 'shard', 'roar', 'flare'
];

const abilities = [
  'Blaze', 'Torrent', 'Overgrow', 'Static', 'Intimidate', 'Levitate',
  'Flash Fire', 'Water Absorb', 'Volt Absorb', 'Pressure', 'Thick Fat',
  'Adaptability', 'Swift Swim', 'Regenerator', 'Magic Guard', 'Multiscale',
  'Sturdy', 'Iron Fist', 'Sheer Force', 'Prism Armor', 'Unaware', 'Moxie',
  'Sand Veil', 'Snow Cloak', 'Poison Heal', 'Rough Skin', 'Tinted Lens', 'Wonder Skin'
];

const habitats = [
  "volcanic caves deep beneath the earth's crust",
  'the darkest trenches of ancient oceans',
  'enchanted forests where time flows differently',
  'floating islands among the clouds',
  'crystalline caverns that glow with inner light',
  'the space between dimensions',
  'frozen wastelands at the edge of the world',
  'hidden valleys veiled by perpetual mist',
  'abandoned temples from a forgotten civilization',
  'the dream realm that exists parallel to reality',
  'sunken ruins reclaimed by coral and current',
  'wind-carved mesas where lightning never stops',
  'subterranean rivers that glow faintly blue',
  'the upper canopy of a forest that has never been mapped',
  'shifting dunes that bury and reveal ruins by the season',
  'geothermal springs steaming beneath permanent snowfall',
  'a graveyard of shipwrecks along a fog-bound coast',
  'the quiet space behind waterfalls twice as tall as any tree',
  'meteor craters still warm from impact centuries ago',
  'the tangled roots of a single tree older than any kingdom'
];

const behaviors = [
  'fiercely territorial, defending its domain with supernatural fury',
  'highly social, forming telepathic bonds with its kind',
  'nocturnal and elusive, appearing only under moonlight',
  'playful and mischievous, often playing tricks on travelers',
  'ancient and wise, having lived for countless generations',
  'protective and noble, serving as a guardian to those in need',
  'chaotic and unpredictable, its moods shifting like the wind',
  'serene and contemplative, meditating for days at a time',
  'obsessively territorial over a single object or landmark, for reasons no one has decoded',
  'migratory on a cycle no researcher has fully mapped',
  'famously curious, approaching strangers before any threat is assessed',
  'ritualistic, performing the same behaviors at the same times without fail',
  'fiercely loyal once trust is earned, and nearly impossible to earn it',
  'solitary to the point that two sightings together has never been confirmed',
  'strangely gentle despite its intimidating build',
  'known to mimic the calls and mannerisms of other species'
];

const traits = [
  'Its cry resonates with magical frequencies that can shatter crystal',
  'Legends claim it was born from a fallen star during an eclipse',
  'Ancient murals depict it as a deity worshipped by lost kingdoms',
  'It can phase through solid matter when threatened',
  'Its eyes glow with an otherworldly light that reveals hidden truths',
  'Folklore says it appears before those destined for greatness',
  'It feeds on ambient magical energy rather than physical food',
  'Scholars believe it may be immortal, having been sighted across centuries',
  'Its footprints are said to never fade, no matter the weather',
  'Sailors once used its distant roar to navigate through fog',
  'It is depicted on the oldest known coinage of at least three vanished empires',
  'No two confirmed sightings have ever described the exact same coloration',
  'Its shed scales are prized as good-luck charms in at least six cultures',
  'It reportedly cannot be photographed accurately — every image differs slightly',
  'Its bones, when found, are always warm to the touch',
  'A single feather or scale from it has reportedly stopped a war before'
];

const powers = [
  'It can manipulate weather patterns within a mile radius',
  'Its presence causes plants to grow at an accelerated rate',
  'It possesses the ability to glimpse possible futures',
  'Ancient scrolls claim it can grant wishes to the pure of heart',
  'It can create illusions so realistic they affect all five senses',
  'Its roar can summon spectral allies from the ethereal plane',
  'It regenerates completely from any wound within hours',
  'Masters of the element report it can create pocket dimensions',
  'It can render itself completely undetectable to trained trackers',
  'It is capable of communicating complex ideas through bioluminescent patterns',
  'It can briefly reverse minor decay, aging an object backward by mere seconds',
  'Its presence has been known to calm even the most aggressive wild creatures',
  'It can share its own memories directly with a trusted companion',
  'It is rumored to be able to walk unharmed through its own elemental opposite'
];

const bodyTypes = [
  'a serpentine body with flowing, ribbon-like fins',
  'a quadrupedal stance with powerful, muscular legs',
  'a bipedal form with elongated arms and clawed hands',
  'a floating, ethereal body that seems to phase in and out of reality',
  'a compact, armored build with overlapping crystalline plates',
  'a sleek, aerodynamic form built for incredible speed',
  'a towering, imposing figure with broad shoulders',
  'a lithe, feline-like body with graceful movements',
  'a squat, barrel-chested build with disproportionately powerful forelimbs',
  'a segmented, insectile body that folds compactly when at rest',
  'an amorphous, ever-shifting silhouette that never holds one shape long',
  'a centauroid build blending a humanoid torso with a beast-like lower body',
  'a hulking, moss-covered form that resembles living stone',
  'a delicate, avian frame with hollow, glass-like bones'
];

const facialFeatures = [
  'piercing eyes that glow with inner fire',
  'a beak-like mouth with jagged, crystalline teeth',
  'multiple eyes arranged in a geometric pattern',
  'a gentle face with large, expressive eyes',
  'a fierce expression with prominent horns curving backward',
  'a mysterious mask-like face with ancient markings',
  'compound eyes that shimmer with rainbow colors',
  'a dragon-like snout with wisps of energy emanating from nostrils',
  'a completely featureless face save for a single glowing sigil',
  'a wide, unsettling grin that never fully closes',
  'whisker-like tendrils that twitch in response to nearby movement',
  'a face split by natural armor plating down the center',
  'eyes that change color depending on its current mood',
  'a jaw capable of unhinging far wider than its head'
];

const distinctiveFeatures = [
  'Massive wings covered in iridescent scales that shimmer with every color imaginable',
  'A long, flowing mane made of pure elemental energy',
  'Bioluminescent patterns across its body that pulse rhythmically',
  'A tail ending in a blade-like appendage wreathed in mystical flames',
  'Gems embedded throughout its body that store magical power',
  'Ethereal wisps of mist constantly swirling around its form',
  'Multiple tendrils extending from its back, each ending in a glowing orb',
  'Crystalline spikes running along its spine that resonate with sound',
  'A second, smaller pair of vestigial wings that seem purely ornamental',
  'Rings of floating debris that orbit its body at all times',
  'A translucent membrane along its limbs that catches and refracts light',
  'Scarring across its hide that forms a pattern too symmetrical to be accidental',
  'A crown-like ridge of bone that grows a new point every year',
  'Fur or scales that shift texture entirely depending on the temperature'
];

const colorPatterns = [
  'Its primary coloration shifts between deep crimson and burnt orange with golden accents',
  'Covered in midnight blue scales with silver constellation-like patterns',
  'A vibrant emerald green body with veins of electric yellow running through it',
  'Pure white fur with streaks of icy blue and crystalline frost formations',
  'Deep purple skin with swirling nebula patterns in pink and violet',
  'Obsidian black exterior with cracks revealing inner magma-like glow',
  'Opalescent coating that changes colors depending on viewing angle',
  'Sandy tan base with intricate tribal markings in turquoise and gold',
  'A muted slate gray broken up by sudden streaks of neon coral',
  'Deep forest green fading into near-black at every extremity',
  'A patchwork of copper and verdigris, like weathered ancient metal',
  'Bone white marked with a single unbroken line of deep red from head to tail',
  'Iridescent oil-slick sheen that never shows the same color twice in motion',
  'Matte charcoal skin dusted with what looks like permanent frost'
];

// Renown is a new addition — a short line about how rare/known the
// creature is among trainers, adding a layer of stakes beyond the
// creature's own biology/lore. Purely optional flavor; nothing downstream
// is required to use it.
const renownLevels = [
  'Confirmed sightings number fewer than twenty in trainer archives — this is a genuine rarity.',
  'Well-documented and relatively common, though no less respected for it.',
  'Known mostly through secondhand accounts — verified encounters are exceptionally scarce.',
  'A minor local legend in its home region, rarely seen beyond it.',
  'Subject of an ongoing bounty among collectors for a confirmed capture.',
  'Considered a juvenile of a much larger, still-unconfirmed adult form.',
  'Featured prominently in trainer folklore, though skeptics remain unconvinced it is real at all.',
  'Recently reclassified after decades of being mistaken for an entirely different species.'
];

// pick() now takes an optional Set of values to avoid. If excluding would
// empty the pool entirely (pathological case: exclude set covers every
// entry), it safely falls back to the full array rather than throwing -
// a repeat is a much smaller problem than a crash.
function pick(arr, exclude) {
  if (exclude && exclude.size) {
    const filtered = arr.filter((x) => !exclude.has(x));
    if (filtered.length > 0) {
      return filtered[Math.floor(Math.random() * filtered.length)];
    }
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateCreature(exclude = {}) {
  const primaryType = pick(types);
  let secondaryType = null;
  if (Math.random() > 0.5) {
    secondaryType = pick(types.filter((t) => t.name !== primaryType.name));
  }

  const name = pick(prefixes) + pick(suffixes);
  const habitat = pick(habitats, exclude.habitats);
  const behavior = pick(behaviors, exclude.behaviors);
  const trait = pick(traits, exclude.traits);
  const power = pick(powers, exclude.powers);
  const renown = pick(renownLevels, exclude.renownLevels);
  const description = `This creature is ${behavior}. Dwelling in ${habitat}, it has captivated researchers for generations. ${trait}. ${power}. ${renown}`;

  const bodyType = pick(bodyTypes, exclude.bodyTypes);
  const facialFeature = pick(facialFeatures, exclude.facialFeatures);
  const distinctiveFeature = pick(distinctiveFeatures, exclude.distinctiveFeatures);
  const colorPattern = pick(colorPatterns, exclude.colorPatterns);
  const visualDescription = `${name} has ${bodyType}, featuring ${facialFeature}. ${colorPattern}. ${distinctiveFeature}. The overall appearance radiates ${primaryType.name.toLowerCase()} energy${secondaryType ? ` with hints of ${secondaryType.name.toLowerCase()} power` : ''}.`;

  const heightMeters = Math.random() * 2 + 0.3;
  const heightFeet = (heightMeters * 3.28084).toFixed(1);
  const weightKg = Math.random() * 100 + 5;
  const weightLbs = (weightKg * 2.20462).toFixed(1);

  return {
    name,
    primaryType,
    secondaryType,
    description,
    visualDescription,
    stats: {
      hp: Math.floor(Math.random() * 100) + 50,
      attack: Math.floor(Math.random() * 100) + 40,
      defense: Math.floor(Math.random() * 100) + 40,
      speed: Math.floor(Math.random() * 100) + 40
    },
    ability: pick(abilities),
    height: heightFeet,
    weight: weightLbs,
    renown,
    // Raw picks - not part of the spoken/rendered output on their own, but
    // needed by callers that want to record what was used (e.g. index.js's
    // recent-flavor history ledger) without re-parsing description text.
    habitat,
    behavior,
    trait,
    power,
    bodyType,
    facialFeature,
    distinctiveFeature,
    colorPattern
  };
}
