// moves.js
// Picks a move name for a creature's attack. Previously used invented,
// anime-style move names (e.g. "Infernal Cataclysm") disconnected from the
// actual Pokemon fighting - now pulls from that Pokemon's REAL learnset
// (attached to creature.moves by creatures.js, STAB-preferred, capped at 6
// per species). Falls back to a generic type-flavored name only in the
// unlikely case a creature has no real moves attached (e.g. an older
// creature object from before this fix, or a non-Pokemon test fixture).

const FALLBACK_MOVES_BY_TYPE = {
  Fire: "Fire Blast", Water: "Hydro Pump", Grass: "Solar Beam", Electric: "Thunderbolt",
  Ice: "Ice Beam", Fighting: "Close Combat", Poison: "Sludge Bomb", Ground: "Earthquake",
  Flying: "Hurricane", Psychic: "Psychic", Bug: "X-Scissor", Rock: "Rock Slide",
  Ghost: "Shadow Ball", Dragon: "Dragon Pulse", Dark: "Dark Pulse", Steel: "Iron Head",
  Fairy: "Moonblast", Normal: "Hyper Beam"
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateMove(creature) {
  if (creature.moves && creature.moves.length > 0) {
    const move = pick(creature.moves);
    // Mega Evolved creatures hit harder - reflect that in the callout
    // without needing a fake "APEX" move name; the real move stays real.
    return creature.hasMegaEvolved ? `${move.toUpperCase()}!` : move;
  }

  const typeKey = creature.primaryType?.name;
  return FALLBACK_MOVES_BY_TYPE[typeKey] || "Tackle";
}
