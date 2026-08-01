// arenas.js
// Generates a randomized battle arena to set the stage before the fight.
// Pure flavor/setting data — no gameplay effect required, though hazard
// and weather fields are included so battle.js / script.js can optionally
// react to them later (e.g. fire moves stronger in the Scorched Caldera).
//
// Expanded 2026-07-30: arena count more than doubled (10 -> 24), and every
// entry now includes a "legend" field — a short bit of local history/lore
// about the venue itself, independent of the creatures fighting in it.
// generateArena() and buildArenaIntroLine()'s signatures are unchanged;
// legend is available on every returned arena object as a pure addition.

const ARENAS = [
  {
    name: "Scorched Caldera",
    description: "a cracked volcanic basin ringed by slow rivers of lava",
    weather: "shimmering heat haze",
    hazard: "occasional ash-fall reduces visibility",
    legend: "said to be the site of the very first recorded official match, centuries ago"
  },
  {
    name: "Frozen Reach",
    description: "a wind-scoured glacier field beneath a pale, low sun",
    weather: "biting wind",
    hazard: "slick ice makes footing treacherous",
    legend: "local trainers claim a champion's frozen footprints are still visible near the north ridge"
  },
  {
    name: "Thunderhead Mesa",
    description: "a flat-topped plateau crackling under a rolling storm front",
    weather: "electrical storm",
    hazard: "lightning strikes the highest point roughly once per minute",
    legend: "no Electric-type has ever officially lost a match held here, though skeptics call that a myth"
  },
  {
    name: "Sunken Coliseum",
    description: "the flooded ruins of an ancient stone arena, waist-deep in places",
    weather: "humid mist",
    hazard: "standing water conducts electric attacks further than normal",
    legend: "the original coliseum predates every modern league by generations"
  },
  {
    name: "Crystal Canyon",
    description: "a narrow gorge lined with towering, light-refracting crystal spires",
    weather: "clear and still",
    hazard: "sound and light attacks ricochet off the crystal walls",
    legend: "the crystals are rumored to hum faintly in the presence of a truly decisive hit"
  },
  {
    name: "Whispering Grove",
    description: "a dense, fog-wrapped forest clearing where the trees seem to lean in",
    weather: "low-lying fog",
    hazard: "visibility drops sharply past 20 feet",
    legend: "travelers insist the grove occasionally rearranges itself overnight"
  },
  {
    name: "Skyreach Platform",
    description: "a floating stone platform suspended high above the clouds",
    weather: "thin, cold air",
    hazard: "a fall here is no joke — footwork matters",
    legend: "engineers still cannot fully explain what keeps the platform aloft"
  },
  {
    name: "Molten Foundry",
    description: "an abandoned industrial forge, furnaces still glowing orange",
    weather: "stifling heat",
    hazard: "loose scaffolding groans overhead",
    legend: "once produced the finest training gear in the region before it was abruptly shut down"
  },
  {
    name: "Tidal Shoreline",
    description: "a windswept beach where the surf crashes hard against black rock",
    weather: "salt spray and gusting wind",
    hazard: "the tide is rising as the battle wears on",
    legend: "matches here are traditionally scheduled around the tide charts, not the other way around"
  },
  {
    name: "Obsidian Plateau",
    description: "a flat expanse of glassy black volcanic rock under a starless sky",
    weather: "eerily calm",
    hazard: "the reflective ground doubles every flash of light",
    legend: "some trainers refuse to compete here, citing an unshakeable feeling of being watched"
  },
  {
    name: "Hollow Spire",
    description: "the interior of an impossibly tall, long-dead petrified tree",
    weather: "still, dust-filled air",
    hazard: "sound echoes for several seconds after every hit",
    legend: "carvings inside date back further than any written trainer record"
  },
  {
    name: "Blistering Flats",
    description: "a cracked salt desert stretching to the horizon in every direction",
    weather: "shimmering mirage-heat",
    hazard: "distances are notoriously hard to judge accurately here",
    legend: "trainers swear the flats have swallowed more than one poorly marked arena boundary"
  },
  {
    name: "Verdant Amphitheater",
    description: "a natural bowl-shaped clearing ringed by ancient, moss-draped stone seating",
    weather: "warm and humid",
    hazard: "thick vines occasionally snake across the field mid-match",
    legend: "believed to be the oldest continuously used battle site still in operation"
  },
  {
    name: "Ashfall Basin",
    description: "a wide crater still lightly dusted with ash from an eruption decades past",
    weather: "fine ash drifting on the wind",
    hazard: "footing shifts unpredictably in the looser ash drifts",
    legend: "the crater's rim is said to glow faintly on the anniversary of the original eruption"
  },
  {
    name: "Glassrock Shoals",
    description: "a coastline where repeated lightning strikes have fused the sand into sheets of glass",
    weather: "clear skies with distant heat lightning",
    hazard: "the glassy ground offers almost no traction after rain",
    legend: "collectors pay handsomely for shards taken from a confirmed match site"
  },
  {
    name: "Ruined Observatory",
    description: "the collapsed dome of an ancient stargazing tower, open to the sky",
    weather: "clear night air",
    hazard: "loose masonry occasionally shifts underfoot",
    legend: "astronomers once used this site to track a comet that has never returned"
  },
  {
    name: "Mistwood Hollow",
    description: "a low-lying hollow perpetually filled with cool, drifting mist",
    weather: "persistent, chest-high fog",
    hazard: "opponents can vanish from sight for several seconds at a time",
    legend: "local guides refuse to enter after dark, regardless of the reason"
  },
  {
    name: "Emberfall Terrace",
    description: "a series of stone terraces built directly into an active hillside vent",
    weather: "drifting embers and warm updrafts",
    hazard: "sudden gusts can carry embers unpredictably across the field",
    legend: "the terraces were carved by hand over three generations of one family"
  },
  {
    name: "Driftglass Bay",
    description: "a shallow bay littered with centuries of sea-smoothed glass and shipwreck debris",
    weather: "calm with a persistent low tide",
    hazard: "the uneven bottom makes footing unpredictable in the shallows",
    legend: "beachcombers still occasionally surface artifacts from battles fought a century ago"
  },
  {
    name: "Ironroot Thicket",
    description: "a forest where the trees' roots have grown around exposed veins of raw ore",
    weather: "still and shaded",
    hazard: "metallic roots occasionally interfere with certain attacks",
    legend: "prospectors and trainers have coexisted uneasily here for as long as anyone can recall"
  },
  {
    name: "Palewind Ridge",
    description: "a narrow, exposed ridgeline with sheer drops on either side",
    weather: "constant, steady wind",
    hazard: "aerial attacks behave unpredictably in the crosswinds",
    legend: "considered a rite of passage venue among trainers from the surrounding highlands"
  },
  {
    name: "Sunken Bell Ruins",
    description: "the remains of a submerged bell tower, its peak still breaking the waterline",
    weather: "humid and still",
    hazard: "the old bell reportedly still tolls faintly when struck by a powerful enough hit",
    legend: "no one has definitively explained how the bell still rings after all this time"
  },
  {
    name: "Cinderpeak Overlook",
    description: "a wind-battered summit overlooking a valley still smoldering from an old wildfire",
    weather: "smoky haze rising from below",
    hazard: "footing near the eastern edge is notoriously unstable",
    legend: "the valley below has not fully regrown in over a decade, for reasons still debated"
  },
  {
    name: "Quietfall Gardens",
    description: "the manicured, unnervingly silent ruins of a once-grand formal garden",
    weather: "still and unnaturally quiet",
    hazard: "the silence itself has reportedly unsettled more than one competitor mid-match",
    legend: "gardeners maintain it to this day, though nobody living recalls who first commissioned it"
  }
];

export function generateArena(exclude) {
  let pool = ARENAS;
  if (exclude && exclude.size) {
    const filtered = ARENAS.filter((a) => !exclude.has(a.name));
    if (filtered.length > 0) pool = filtered;
  }
  const arena = pool[Math.floor(Math.random() * pool.length)];
  return { ...arena };
}

// Optional: a short spoken intro line built from the arena, ready to drop
// straight into script.js's opening beat.
export function buildArenaIntroLine(arena) {
  return `Today's battle unfolds at the ${arena.name} — ${arena.description}, ` +
    `with ${arena.weather} setting the mood. Watch your footing out there: ${arena.hazard}.`;
}
