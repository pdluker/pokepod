/**
 * arena-conditions.js
 *
 * Implements Tier 1 & Tier 2 integration of daily Earth/Space conditions into creature battles.
 * Pulls from EARTH_KV and SPACE_KV (already written by stl-dispatcher daily),
 * and uses those conditions to:
 * 1. Weight arena selection (Tier 1)
 * 2. Generate dynamic arena variants with condition-aware descriptions (Tier 2)
 *
 * USAGE in index.js (see index.js.integrated for the full changes):
 *
 *   import { assessConditions, getArenaWeights, selectArenaWeighted, generateArenaVariant } from './arena-conditions.js';
 *   import { ARENAS } from './arenas.js';
 *
 *   // Inside runRefresh(), after creating creatures:
 *   const conditions = await assessConditions(env);
 *   const weights = getArenaWeights(conditions);
 *   const baseArena = selectArenaWeighted(ARENAS, weights);
 *   const arena = generateArenaVariant(baseArena, conditions);
 *
 *   // Then pass `conditions` to buildEpisodeScript() and script.js can use it for narration
 */

// ============================================================================
// CONDITION CATEGORIES
// ============================================================================

export const EARTH_CONDITIONS = {
  EARTHQUAKE_ACTIVE: 'earthquake-active',
  VOLCANO_ACTIVE: 'volcano-active',
  WILDFIRE_ACTIVE: 'wildfire-active',
  STORM_ACTIVE: 'storm-active',
  HIGH_ACTIVITY: 'high-activity',
  QUIET_DAY: 'quiet-day',
};

export const SPACE_CONDITIONS = {
  LAUNCH_WINDOW_IMMEDIATE: 'launch-window-immediate',
  LAUNCH_WINDOW_SOON: 'launch-window-soon',
  ISS_VISIBLE: 'iss-visible',
};

// ============================================================================
// CONDITION ASSESSMENT LOGIC
// ============================================================================

export function assessEarthCondition(earthData) {
  if (!earthData) return EARTH_CONDITIONS.QUIET_DAY;

  // Check for recent significant earthquakes (USGS magnitude >= 4.0)
  if (earthData.quakes?.significant?.length > 0) {
    const recent = earthData.quakes.significant.filter(q => {
      const qTime = new Date(q.time).getTime();
      const now = Date.now();
      return (now - qTime) < 24 * 3600 * 1000;
    });
    if (recent.length > 0) return EARTH_CONDITIONS.EARTHQUAKE_ACTIVE;
  }

  // Check for active volcano reports
  if (earthData.volcanoes?.active?.length > 0) {
    return EARTH_CONDITIONS.VOLCANO_ACTIVE;
  }

  // Check for active wildfires
  if ((earthData.wildfires?.active || []).length > 0) {
    return EARTH_CONDITIONS.WILDFIRE_ACTIVE;
  }

  // Check for active storms
  if ((earthData.storms?.active || []).length > 0) {
    return EARTH_CONDITIONS.STORM_ACTIVE;
  }

  // Check overall activity level
  if (earthData.meta?.pulseScore >= 7) {
    return EARTH_CONDITIONS.HIGH_ACTIVITY;
  }

  return EARTH_CONDITIONS.QUIET_DAY;
}

export function assessSpaceCondition(spaceData) {
  if (!spaceData) return null;

  // Check for launches within 24 hours
  if (spaceData.launches?.next7Days) {
    const immediate = spaceData.launches.next7Days.filter(l => {
      const launchTime = new Date(l.windowStart).getTime();
      const now = Date.now();
      const hoursAway = (launchTime - now) / 3600000;
      return hoursAway > 0 && hoursAway < 24;
    });
    if (immediate.length > 0) {
      return SPACE_CONDITIONS.LAUNCH_WINDOW_IMMEDIATE;
    }
  }

  // Check for launches within 72 hours
  if (spaceData.launches?.next7Days) {
    const soon = spaceData.launches.next7Days.filter(l => {
      const launchTime = new Date(l.windowStart).getTime();
      const now = Date.now();
      const hoursAway = (launchTime - now) / 3600000;
      return hoursAway > 0 && hoursAway < 72;
    });
    if (soon.length > 0) {
      return SPACE_CONDITIONS.LAUNCH_WINDOW_SOON;
    }
  }

  // Check for ISS visible passes
  if ((spaceData.tonight?.issPasses || []).some(p => p.visible)) {
    return SPACE_CONDITIONS.ISS_VISIBLE;
  }

  return null;
}

/**
 * Fetches and assesses both Earth and Space conditions from KV.
 * Returns an object with both conditions plus raw data for use downstream.
 */
export async function assessConditions(env) {
  let earthData = null;
  let spaceData = null;

  try {
    const earthRaw = await env.EARTH_KV?.get('earth-data').catch(() => null);
    if (earthRaw) earthData = JSON.parse(earthRaw);
  } catch (e) {
    console.warn('Failed to parse EARTH_KV:', e);
  }

  try {
    const spaceRaw = await env.SPACE_KV?.get('space-data').catch(() => null);
    if (spaceRaw) spaceData = JSON.parse(spaceRaw);
  } catch (e) {
    console.warn('Failed to parse SPACE_KV:', e);
  }

  return {
    earth: assessEarthCondition(earthData),
    space: assessSpaceCondition(spaceData),
    earthData,
    spaceData,
  };
}

// ============================================================================
// ARENA WEIGHTING (TIER 1)
// ============================================================================

export const ARENA_WEIGHT_MAP = {
  [EARTH_CONDITIONS.EARTHQUAKE_ACTIVE]: [
    'Scorched Caldera',
    'Sunken Coliseum',
    'Obsidian Plateau',
    'Hollow Spire',
    'Glassrock Shoals',
  ],

  [EARTH_CONDITIONS.VOLCANO_ACTIVE]: [
    'Molten Foundry',
    'Emberfall Terrace',
    'Cinderpeak Overlook',
    'Ashfall Basin',
    'Scorched Caldera',
  ],

  [EARTH_CONDITIONS.WILDFIRE_ACTIVE]: [
    'Blistering Flats',
    'Emberfall Terrace',
    'Cinderpeak Overlook',
    'Ashfall Basin',
    'Scorched Caldera',
  ],

  [EARTH_CONDITIONS.STORM_ACTIVE]: [
    'Thunderhead Mesa',
    'Frozen Reach',
    'Tidal Shoreline',
    'Ashfall Basin',
  ],

  [EARTH_CONDITIONS.HIGH_ACTIVITY]: [
    'Thunderhead Mesa',
    'Blistering Flats',
    'Glassrock Shoals',
    'Molten Foundry',
  ],

  [EARTH_CONDITIONS.QUIET_DAY]: [
    'Whispering Grove',
    'Verdant Amphitheater',
    'Quietfall Gardens',
    'Crystal Canyon',
    'Mistwood Hollow',
  ],

  [SPACE_CONDITIONS.LAUNCH_WINDOW_IMMEDIATE]: [
    'Skyreach Platform',
    'Thunderhead Mesa',
    'Ruined Observatory',
    'Palewind Ridge',
  ],

  [SPACE_CONDITIONS.LAUNCH_WINDOW_SOON]: [
    'Skyreach Platform',
    'Ruined Observatory',
    'Palewind Ridge',
  ],

  [SPACE_CONDITIONS.ISS_VISIBLE]: [
    'Skyreach Platform',
    'Ruined Observatory',
    'Palewind Ridge',
    'Crystal Canyon',
  ],
};

/**
 * Given condition categories, returns a Map of arena name -> weight multiplier.
 * Arenas matching the conditions get +2 weight (60% chance), others default to 1 (40%).
 */
export function getArenaWeights(conditions) {
  const weights = new Map();

  const { earth, space } = conditions;

  if (earth && ARENA_WEIGHT_MAP[earth]) {
    for (const areneName of ARENA_WEIGHT_MAP[earth]) {
      weights.set(areneName, (weights.get(areneName) || 1) + 2);
    }
  }

  if (space && ARENA_WEIGHT_MAP[space]) {
    for (const areneName of ARENA_WEIGHT_MAP[space]) {
      weights.set(areneName, (weights.get(areneName) || 1) + 2);
    }
  }

  return weights;
}

/**
 * Selects an arena from the pool using weighted randomness.
 * ExcludeSet should be a Set of arena names to skip (from history).
 */
export function selectArenaWeighted(arenaPool, weights, excludeSet = null) {
  const available = arenaPool.filter(a =>
    !excludeSet || !excludeSet.has(a.name)
  );

  if (available.length === 0) {
    return arenaPool[Math.floor(Math.random() * arenaPool.length)];
  }

  // Build cumulative weight array
  const cumulative = [];
  let total = 0;

  for (const arena of available) {
    const weight = weights.get(arena.name) || 1;
    total += weight;
    cumulative.push({ arena, cumulative: total });
  }

  // Pick a random value and find the corresponding arena
  const roll = Math.random() * total;
  for (const item of cumulative) {
    if (roll <= item.cumulative) return item.arena;
  }

  return available[available.length - 1]; // safety fallback
}

// ============================================================================
// ARENA VARIANT GENERATION (TIER 2)
// ============================================================================

/**
 * Takes a base arena and real-world conditions, returns a variant with
 * dynamically updated description/legend/weather/hazard fields.
 * Does NOT mutate the original arena object.
 */
// None of the 24 legends in arenas.js end in terminal punctuation (they're
// written as clause fragments that script.js capitalizes and adds a period
// to). Appending a full sentence directly onto one produced a run-on in all
// four condition branches below - e.g. "...centuries ago Volcanologists
// report activity at Kilauea". This closes the fragment first.
function appendSentence(base, addition) {
  const trimmed = String(base || '').trim();
  if (!trimmed) return addition;
  const punctuated = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return `${punctuated} ${addition}`;
}

export function generateArenaVariant(baseArena, conditions) {
  const variant = { ...baseArena };
  const { earthData, spaceData } = conditions;

  if (!earthData && !spaceData) {
    return variant;
  }

  // EARTHQUAKE SCENARIO
  if (earthData?.quakes?.significant?.length > 0) {
    const quake = earthData.quakes.significant[0];
    const magStr = quake.mag ? quake.mag.toFixed(1) : 'unknown magnitude';
    const place = quake.place || 'the region';

    if (ARENA_WEIGHT_MAP[EARTH_CONDITIONS.EARTHQUAKE_ACTIVE].includes(baseArena.name)) {
      variant.description = `${baseArena.description}, with fresh tremors from a ` +
        `${magStr}-magnitude event near ${place} still rippling through the ground`;
      variant.hazard = `${baseArena.hazard}, and the earth is unstable`;
    }
  }

  // VOLCANIC SCENARIO
  if (earthData?.volcanoes?.active?.length > 0) {
    const volcano = earthData.volcanoes.active[0];
    if (ARENA_WEIGHT_MAP[EARTH_CONDITIONS.VOLCANO_ACTIVE].includes(baseArena.name)) {
      variant.legend = appendSentence(baseArena.legend,
        `Volcanologists report activity at ${volcano.name}, and the tension in the air is unmistakable.`);
      variant.weather = `${baseArena.weather}, with a faint sulfurous scent on the wind`;
    }
  }

  // WILDFIRE SCENARIO
  if (earthData?.wildfires?.active?.length > 0) {
    const fire = earthData.wildfires.active[0];
    if (ARENA_WEIGHT_MAP[EARTH_CONDITIONS.WILDFIRE_ACTIVE].includes(baseArena.name)) {
      variant.weather = `${baseArena.weather}, with visible smoke on the horizon`;
      variant.hazard = `${baseArena.hazard}, and a distant wildfire makes the air thick`;
    }
  }

  // STORM SCENARIO
  if (earthData?.storms?.active?.length > 0) {
    const storm = earthData.storms.active[0];
    if (ARENA_WEIGHT_MAP[EARTH_CONDITIONS.STORM_ACTIVE].includes(baseArena.name)) {
      variant.weather = `${baseArena.weather}, with active storm systems approaching`;
      variant.legend = appendSentence(baseArena.legend,
        `Today, the weather patterns are unusually intense.`);
    }
  }

  // LAUNCH WINDOW SCENARIO (immediate: < 24 hours)
  if (spaceData?.launches?.next7Days?.length > 0) {
    const nextLaunch = spaceData.launches.next7Days[0];
    const hoursUntil = (new Date(nextLaunch.windowStart) - Date.now()) / 3600000;

    if (hoursUntil > 0 && hoursUntil < 24) {
      if (ARENA_WEIGHT_MAP[SPACE_CONDITIONS.LAUNCH_WINDOW_IMMEDIATE].includes(baseArena.name)) {
        variant.legend = appendSentence(baseArena.legend,
          `A rocket is scheduled to launch from the coast within the next ` +
          `${Math.round(hoursUntil)} hours, and the anticipation is palpable.`);
        variant.weather = `${baseArena.weather}, with eyes turned skyward`;
      }
    } else if (hoursUntil > 0 && hoursUntil < 72) {
      if (ARENA_WEIGHT_MAP[SPACE_CONDITIONS.LAUNCH_WINDOW_SOON].includes(baseArena.name)) {
        variant.legend = appendSentence(baseArena.legend,
          `Word is spreading that a major launch window opens in the next few days.`);
      }
    }
  }

  // ISS VISIBLE SCENARIO
  if (spaceData?.tonight?.issPasses?.length > 0) {
    const nextPass = spaceData.tonight.issPasses.find(p => p.visible);
    if (nextPass && ARENA_WEIGHT_MAP[SPACE_CONDITIONS.ISS_VISIBLE].includes(baseArena.name)) {
      const riseTimeStr = nextPass.riseTime || 'evening';
      variant.legend = appendSentence(baseArena.legend,
        `The International Space Station will pass overhead at ${riseTimeStr} ` +
        `local time, and all eyes will be on the sky.`);
      variant.weather = `${baseArena.weather}, with perfect visibility for tonight's pass`;
    }
  }

  return variant;
}

/**
 * Generates a one-sentence intro line that sets the stage based on conditions.
 * Used at the top of the episode to establish context.
 */
export function buildConditionIntroLine(conditions) {
  const { earth, space } = conditions;

  switch (earth) {
    case EARTH_CONDITIONS.EARTHQUAKE_ACTIVE:
      return "A quick note on tonight's backdrop: this region is still reeling from real seismic activity.";
    case EARTH_CONDITIONS.VOLCANO_ACTIVE:
      return "A quick note on tonight's backdrop: volcanic forces are shaping the world beyond this arena today.";
    case EARTH_CONDITIONS.WILDFIRE_ACTIVE:
      return "A quick note on tonight's backdrop: wildfires are burning in distant regions as these two step in.";
    case EARTH_CONDITIONS.STORM_ACTIVE:
      return "A quick note on tonight's backdrop: the skies are genuinely turbulent with storm activity tonight.";
    case EARTH_CONDITIONS.HIGH_ACTIVITY:
      return "A quick note on tonight's backdrop: it has been a particularly active day for the planet.";
  }

  switch (space) {
    case SPACE_CONDITIONS.LAUNCH_WINDOW_IMMEDIATE:
      return "A quick note on tonight's backdrop: humanity is preparing for a real liftoff within hours.";
    case SPACE_CONDITIONS.LAUNCH_WINDOW_SOON:
      return "A quick note on tonight's backdrop: a launch window opens in the next few days.";
    case SPACE_CONDITIONS.ISS_VISIBLE:
      return "A quick note on tonight's backdrop: the International Space Station passes overhead tonight.";
  }

  // Fixed 2026-08-12: previously returned a generic "A perfect day for a
  // battle unfolds..." here. Because assessEarthCondition() always returns a
  // truthy value (QUIET_DAY as its floor), script.js's `if (conditions.earth
  // || conditions.space)` guard was ALWAYS true - so that filler line would
  // have been narrated in every single episode, including the majority with
  // nothing real to report. Returning null lets script.js skip the beat
  // entirely on a quiet day, which is the same restraint principle already
  // applied to space.stluker.com's moon gauge and ISS line.
  //
  // Also removed the trailing "..." from every line above: these are spoken
  // by ElevenLabs, and an ellipsis is not a reliable prosody cue the way a
  // period is.
  return null;
}

export default {
  EARTH_CONDITIONS,
  SPACE_CONDITIONS,
  assessEarthCondition,
  assessSpaceCondition,
  assessConditions,
  getArenaWeights,
  selectArenaWeighted,
  generateArenaVariant,
  buildConditionIntroLine,
};
