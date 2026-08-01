// moves.js
const MOVES_BY_TYPE = {
  Fire: ["Infernal Cataclysm", "Pyroclastic Volley", "Flameburst Surge", "Solar Ignition"],
  Water: ["Hydro-Tectonic Crush", "Abyssal Deluge", "Tidal Surge", "Maelstrom Pulse"],
  Grass: ["Verdant Overgrowth", "Sylvan Thorn-Storm", "Bio-Drain Whip", "Solarbeam Cannon"],
  Electric: ["Gigawatt Thunderfall", "Plasma Arc Flash", "Volt Disruptor", "Lightning Overcharge"],
  Ice: ["Absolute Zero Blast", "Glacial Avalanche", "Frostbite Piercer", "Cryo-Shard Barrage"],
  Fighting: ["Sub-Atomic Palm Strike", "Tectonic Shatter-Kick", "Seismic Impact", "Iron-Fist Blitz"],
  Poison: ["Venomous Bio-Hazard", "Toxic Neuro-Spike", "Acidic Vapor Burst", "Miasma Pulse"],
  Ground: ["Faultline Fracture", "Earth-Shatter Tremor", "Dust-Devil Cyclone", "Mud-Slide Impact"],
  Flying: ["Hurricane Cyclone", "Supersonic Dive-Bomb", "Gale-Force Slash", "Aerial Ace Strike"],
  Psychic: ["Psycho-Kinetic Crush", "Mind-Shatter Beam", "Telepathic Distortion", "Astral Blast"],
  Bug: ["Swarm-Force Blitz", "Chitinous Impale", "Pheromone Blast", "Hive-Mind Strike"],
  Rock: ["Meteorite Shatter", "Geo-Lock Crush", "Obsidian Spike Barrage", "Stone-Grave Slam"],
  Ghost: ["Phantom Eclipse", "Spectral Soul-Drain", "Ethereal Terror", "Void Phase Strike"],
  Dragon: ["Draconic Nebula Beam", "Dragon-Rage Outburst", "Wyrm-Tail Crush", "Celestial Roar"],
  Dark: ["Abyssal Shadow-Claw", "Nightmare Pulse", "Dread-Blade Strike", "Oblivion Flash"],
  Steel: ["Titanium Guillotine", "Iron-Core Cannon", "Steel-Tempest Slash", "Magneto-Slam"],
  Fairy: ["Prismatic Star-Burst", "Pixie-Dust Tempest", "Fey-Charm Nova", "Ethereal Ray"]
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateMove(creature) {
  const typeKey = creature.primaryType.name;
  const pool = MOVES_BY_TYPE[typeKey] || ["Elemental Power Strike", "Dynamic Impact", "Primal Blitz"];
  
  if (creature.hasMegaEvolved) {
    return `APEX ${pick(pool).toUpperCase()}`;
  }
  
  return pick(pool);
}