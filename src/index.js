import { requireAuth } from './auth.js';
import { generateCreature } from './creatures.js';
import { simulateBattle } from './battle.js';
import { generateTrainer } from './trainers.js';
import { generateArena } from './arenas.js';
import { buildEpisodeScript } from './script.js';
import { synthesizeEpisode } from './tts.js';
import { generatePoster } from './poster.js';
import { buildRssFeed } from './rss.js';
import { PLAYER_HTML } from './player.js';

const EPISODES_KEY = 'episodes.json';
const FEED_KEY = 'feed.xml';
const STATUS_KEY = 'last-run-status.json';
const RECENT_FLAVOR_KEY = 'recent-flavor.json';
const ASSUMED_BITRATE_KBPS = 128;

// How many recent episodes' picks to exclude, per category. Roughly half of
// each pool's size - big enough to meaningfully cut repeats, small enough
// that a pool never gets fully exhausted and falls back to "anything goes".
// Value-based categories (creature/trainer/arena flavor - plain strings)
// and index-based categories (script.js phrase banks - template functions,
// tracked by position since functions themselves aren't JSON-serializable)
// both live in the same ledger; the difference only matters when building
// the exclude Sets below.
const WINDOWS = {
  habitats: 8, behaviors: 6, traits: 6, powers: 6, renownLevels: 4,
  bodyTypes: 6, facialFeatures: 6, distinctiveFeatures: 6, colorPatterns: 6,
  arenaNames: 10,
  trainerBackgrounds: 8, trainerStyles: 4, trainerQuirks: 4, trainerHometowns: 4,
  coldOpens: 4, victoryLines: 4, victoryColorNotes: 3, signoffAsides: 3,
  finalSignoffs: 3, statInsightPhrases: 1, fightHypeTaglines: 6, doubleKOTaglines: 2
};

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function readJsonFromR2(bucket, key, fallback) {
  const obj = await bucket.get(key);
  if (!obj) return fallback;
  return JSON.parse(await obj.text());
}

async function writeRunStatus(bucket, status) {
  try {
    await bucket.put(STATUS_KEY, JSON.stringify(status, null, 2), {
      httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' }
    });
  } catch (err) {
    console.error('Failed to write run status marker:', err);
  }
}

// Trims a creature object down to what the front end actually needs -
// avoids leaking generation internals (description text, visualDescription
// used only for the poster prompt) into episodes.json.
function slimCreature(c) {
  return {
    name: c.name,
    primaryType: { name: c.primaryType.name, color: c.primaryType.color, emoji: c.primaryType.emoji },
    secondaryType: c.secondaryType
      ? { name: c.secondaryType.name, color: c.secondaryType.color, emoji: c.secondaryType.emoji }
      : null,
    ability: c.ability,
    height: c.height,
    weight: c.weight,
    stats: c.stats
  };
}

function slimTrainer(t) {
  return { name: t.name, hometown: t.hometown, quirk: t.quirk, style: t.style };
}

function toSet(arr) {
  return new Set(arr || []);
}

function pushWindow(arr, value, windowSize) {
  const next = [...(arr || []), value];
  return next.slice(-windowSize);
}

async function runRefresh(env) {
  const recentFlavor = await readJsonFromR2(env.PODCAST_BUCKET, RECENT_FLAVOR_KEY, {});

  // Build exclude sets for creature A straight from history.
  const creatureExcludeA = {
    habitats: toSet(recentFlavor.habitats),
    behaviors: toSet(recentFlavor.behaviors),
    traits: toSet(recentFlavor.traits),
    powers: toSet(recentFlavor.powers),
    renownLevels: toSet(recentFlavor.renownLevels),
    bodyTypes: toSet(recentFlavor.bodyTypes),
    facialFeatures: toSet(recentFlavor.facialFeatures),
    distinctiveFeatures: toSet(recentFlavor.distinctiveFeatures),
    colorPatterns: toSet(recentFlavor.colorPatterns)
  };
  const creatureA = generateCreature(creatureExcludeA);

  // Creature B excludes everything A excluded, PLUS whatever A just picked -
  // this is what actually fixes the "Neorex re-uses Flamedrake's exact
  // habitat in the same episode" bug: same-episode exclusion, not just
  // cross-episode.
  const creatureExcludeB = {
    habitats: new Set([...creatureExcludeA.habitats, creatureA.habitat]),
    behaviors: new Set([...creatureExcludeA.behaviors, creatureA.behavior]),
    traits: new Set([...creatureExcludeA.traits, creatureA.trait]),
    powers: new Set([...creatureExcludeA.powers, creatureA.power]),
    renownLevels: new Set([...creatureExcludeA.renownLevels, creatureA.renown]),
    bodyTypes: new Set([...creatureExcludeA.bodyTypes, creatureA.bodyType]),
    facialFeatures: new Set([...creatureExcludeA.facialFeatures, creatureA.facialFeature]),
    distinctiveFeatures: new Set([...creatureExcludeA.distinctiveFeatures, creatureA.distinctiveFeature]),
    colorPatterns: new Set([...creatureExcludeA.colorPatterns, creatureA.colorPattern])
  };
  const creatureB = generateCreature(creatureExcludeB);

  const battleResult = simulateBattle(creatureA, creatureB);

  const episodes = await readJsonFromR2(env.PODCAST_BUCKET, EPISODES_KEY, []);
  const episodeNumber = episodes.length + 1;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Trainer A/B exclude sets: history, plus (for the second trainer) the
  // first trainer's own picks, same same-episode principle as the creatures.
  const trainerExcludeA = {
    backgrounds: toSet(recentFlavor.trainerBackgrounds),
    styles: toSet(recentFlavor.trainerStyles),
    quirks: toSet(recentFlavor.trainerQuirks),
    hometowns: toSet(recentFlavor.trainerHometowns)
  };

  // script.js's phrase banks are tracked by index (functions aren't
  // JSON-serializable), so history here is an array of indices per bank.
  const scriptExclude = {
    coldOpens: new Set(recentFlavor.coldOpens || []),
    victoryLines: new Set(recentFlavor.victoryLines || []),
    victoryColorNotes: new Set(recentFlavor.victoryColorNotes || []),
    signoffAsides: new Set(recentFlavor.signoffAsides || []),
    finalSignoffs: new Set(recentFlavor.finalSignoffs || []),
    statInsightPhrases: new Set(recentFlavor.statInsightPhrases || []),
    fightHypeTaglines: new Set(recentFlavor.fightHypeTaglines || []),
    doubleKOTaglines: new Set(recentFlavor.doubleKOTaglines || []),
    arenaNames: toSet(recentFlavor.arenaNames),
    trainerA: trainerExcludeA
    // trainerB's exclude set is built after trainerA is generated inside
    // buildEpisodeScript itself isn't possible without restructuring further,
    // so trainerB here reuses the same history-based set as trainerA - same-
    // episode cross-exclusion between the two trainers is a smaller miss
    // than the creature one and left as a follow-up rather than blocking
    // this pass on it.
  };
  scriptExclude.trainerB = trainerExcludeA;

  // trainerA/trainerB/arena are generated inside buildEpisodeScript - the
  // objects it returns are what actually got used, needed both for the
  // episode content and to record into history below.
  const { title, beats, trainerA, trainerB, arena, usedIndices } = buildEpisodeScript({
    showName: env.SHOW_NAME || 'Daily Creature Clash',
    episodeNumber,
    dateStr,
    creatureA,
    creatureB,
    battleResult,
    exclude: scriptExclude
  });

  const [audioOutcome, posterOutcome] = await Promise.allSettled([
    synthesizeEpisode(beats, env),
    generatePoster(creatureA, creatureB, arena, env)
  ]);

  if (audioOutcome.status === 'rejected') {
    throw new Error(`[audio-synthesis stage] ${audioOutcome.reason.message}`);
  }
  const audioBytes = audioOutcome.value;

  let posterBytes = null;
  let posterError = null;
  if (posterOutcome.status === 'fulfilled') {
    posterBytes = posterOutcome.value;
  } else {
    posterError = posterOutcome.reason;
    console.error('[poster-generation stage] failed, continuing audio-only:', posterError);
  }

  const fileSizeBytes = audioBytes.length;
  const durationSeconds = Math.round((fileSizeBytes * 8) / (ASSUMED_BITRATE_KBPS * 1000));
  const dateSlug = now.toISOString().slice(0, 10);
  const audioKey = `episodes/${dateSlug}-${slugify(creatureA.name)}-vs-${slugify(creatureB.name)}.mp3`;
  const posterKey = `episodes/${dateSlug}-${slugify(creatureA.name)}-vs-${slugify(creatureB.name)}.jpg`;

  const uploads = [
    env.PODCAST_BUCKET.put(audioKey, audioBytes, {
      httpMetadata: { contentType: 'audio/mpeg', cacheControl: 'public, max-age=31536000' }
    })
  ];
  if (posterBytes) {
    uploads.push(
      env.PODCAST_BUCKET.put(posterKey, posterBytes, {
        httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' }
      })
    );
  }
  await Promise.all(uploads);

  const audioUrl = `${env.R2_PUBLIC_BASE_URL}/${audioKey}`;
  const posterUrl = posterBytes ? `${env.R2_PUBLIC_BASE_URL}/${posterKey}` : null;

  const speakerLabel = { pbp: 'Play-by-play', color: 'Color commentary' };
  const description = beats
    .map((beat) => `<b>${speakerLabel[beat.speaker] || beat.speaker}:</b> ${beat.text}`)
    .join('<br/><br/>');

  const episodeMeta = {
    guid: crypto.randomUUID(),
    title,
    description,
    pubDate: now.toISOString(),
    audioUrl,
    posterUrl,
    fileSizeBytes,
    durationSeconds,
    episodeNumber,
    battle: {
      winner: battleResult.winner,
      loser: battleResult.loser,
      log: battleResult.log,
      creatureA: slimCreature(creatureA),
      creatureB: slimCreature(creatureB),
      trainerA: slimTrainer(trainerA),
      trainerB: slimTrainer(trainerB),
      arena: {
        name: arena.name,
        description: arena.description,
        weather: arena.weather,
        hazard: arena.hazard,
        legend: arena.legend
      }
    }
  };

  episodes.push(episodeMeta);
  await env.PODCAST_BUCKET.put(EPISODES_KEY, JSON.stringify(episodes, null, 2), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'public, max-age=60' }
  });

  // Persist this episode's picks into the rolling history ledger so the
  // *next* run's exclude sets actually know about it. Value-based
  // categories record both creatures' picks; index-based categories record
  // whatever buildEpisodeScript reports it used.
  const nextFlavor = {
    habitats: pushWindow(recentFlavor.habitats, creatureA.habitat, WINDOWS.habitats),
    behaviors: pushWindow(recentFlavor.behaviors, creatureA.behavior, WINDOWS.behaviors),
    traits: pushWindow(recentFlavor.traits, creatureA.trait, WINDOWS.traits),
    powers: pushWindow(recentFlavor.powers, creatureA.power, WINDOWS.powers),
    renownLevels: pushWindow(recentFlavor.renownLevels, creatureA.renown, WINDOWS.renownLevels),
    bodyTypes: pushWindow(recentFlavor.bodyTypes, creatureA.bodyType, WINDOWS.bodyTypes),
    facialFeatures: pushWindow(recentFlavor.facialFeatures, creatureA.facialFeature, WINDOWS.facialFeatures),
    distinctiveFeatures: pushWindow(recentFlavor.distinctiveFeatures, creatureA.distinctiveFeature, WINDOWS.distinctiveFeatures),
    colorPatterns: pushWindow(recentFlavor.colorPatterns, creatureA.colorPattern, WINDOWS.colorPatterns),
    arenaNames: pushWindow(recentFlavor.arenaNames, arena.name, WINDOWS.arenaNames),
    trainerBackgrounds: pushWindow(recentFlavor.trainerBackgrounds, trainerA.background, WINDOWS.trainerBackgrounds),
    trainerStyles: pushWindow(recentFlavor.trainerStyles, trainerA.style, WINDOWS.trainerStyles),
    trainerQuirks: pushWindow(recentFlavor.trainerQuirks, trainerA.quirk, WINDOWS.trainerQuirks),
    trainerHometowns: pushWindow(recentFlavor.trainerHometowns, trainerA.hometown, WINDOWS.trainerHometowns),
    coldOpens: pushWindow(recentFlavor.coldOpens, usedIndices.coldOpens, WINDOWS.coldOpens),
    victoryLines: pushWindow(recentFlavor.victoryLines, usedIndices.victoryLines, WINDOWS.victoryLines),
    victoryColorNotes: pushWindow(recentFlavor.victoryColorNotes, usedIndices.victoryColorNotes, WINDOWS.victoryColorNotes),
    signoffAsides: pushWindow(recentFlavor.signoffAsides, usedIndices.signoffAsides, WINDOWS.signoffAsides),
    finalSignoffs: pushWindow(recentFlavor.finalSignoffs, usedIndices.finalSignoffs, WINDOWS.finalSignoffs),
    statInsightPhrases: usedIndices.statInsightPhrases != null
      ? pushWindow(recentFlavor.statInsightPhrases, usedIndices.statInsightPhrases, WINDOWS.statInsightPhrases)
      : (recentFlavor.statInsightPhrases || []),
    fightHypeTaglines: usedIndices.fightHypeTaglines != null
      ? pushWindow(recentFlavor.fightHypeTaglines, usedIndices.fightHypeTaglines, WINDOWS.fightHypeTaglines)
      : (recentFlavor.fightHypeTaglines || []),
    doubleKOTaglines: usedIndices.doubleKOTaglines != null
      ? pushWindow(recentFlavor.doubleKOTaglines, usedIndices.doubleKOTaglines, WINDOWS.doubleKOTaglines)
      : (recentFlavor.doubleKOTaglines || [])
  };
  await env.PODCAST_BUCKET.put(RECENT_FLAVOR_KEY, JSON.stringify(nextFlavor, null, 2), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' }
  });

  const feedUrl = `${env.R2_PUBLIC_BASE_URL}/${FEED_KEY}`;
  const showMeta = {
    title: env.SHOW_NAME || 'Daily Creature Clash',
    description: 'A daily randomized creature battle, with full commentary - new episode every day.',
    siteUrl: env.SHOW_SITE_URL || env.R2_PUBLIC_BASE_URL,
    feedUrl,
    author: env.SHOW_AUTHOR || env.SHOW_NAME || 'Daily Creature Clash',
    email: env.SHOW_EMAIL,
    imageUrl: `${env.R2_PUBLIC_BASE_URL}/${env.COVER_IMAGE_KEY || 'cover.jpg'}`
  };
  const rssXml = buildRssFeed(showMeta, episodes);
  await env.PODCAST_BUCKET.put(FEED_KEY, rssXml, {
    httpMetadata: { contentType: 'application/rss+xml', cacheControl: 'public, max-age=300' }
  });

  await env.PODCAST_BUCKET.put('index.html', PLAYER_HTML, {
    httpMetadata: { contentType: 'text/html', cacheControl: 'public, max-age=300' }
  });

  await writeRunStatus(env.PODCAST_BUCKET, {
    ok: true,
    ranAt: now.toISOString(),
    episodeNumber,
    title,
    audioUrl,
    posterUrl,
    posterDegraded: !posterBytes,
    posterError: posterError ? posterError.message : null
  });

  return {
    ok: true,
    episodeNumber,
    title,
    audioUrl,
    posterUrl,
    posterDegraded: !posterBytes,
    feedUrl,
    durationSeconds
  };
}

// Content types for the handful of static/content paths this Worker now
// serves directly from R2. Keeping this small and explicit rather than
// guessing from the file extension - the set of servable keys is fixed.
const R2_CONTENT_TYPES = {
  'index.html': 'text/html; charset=utf-8',
  'episodes.json': 'application/json',
  'feed.xml': 'application/rss+xml; charset=utf-8'
};

// Serves a single object straight out of R2 with the right content type and
// caching headers. Returns null if the object doesn't exist, so callers can
// fall through to a real 404.
async function serveR2Object(bucket, key, contentType, cacheControl) {
  const obj = await bucket.get(key);
  if (!obj) return null;
  return new Response(obj.body, {
    headers: {
      'content-type': contentType || obj.httpMetadata?.contentType || 'application/octet-stream',
      'cache-control': cacheControl || obj.httpMetadata?.cacheControl || 'public, max-age=300'
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let { pathname } = url;

    // R2 has no automatic '/' -> 'index.html' resolution (unlike Pages or
    // Worker+assets sites elsewhere in this account) - this Worker owns that
    // decision now instead of relying on the storage layer to guess it.
    if (pathname === '/') pathname = '/index.html';

    if (pathname === '/health') {
      return Response.json({ ok: true, service: 'podcast', time: new Date().toISOString() });
    }

    // Episode audio/poster files, e.g. /episodes/2026-07-31-foo-vs-bar.mp3
    if (pathname.startsWith('/episodes/') && request.method === 'GET') {
      const key = pathname.slice(1); // strip leading slash to match the R2 key
      const contentType = key.endsWith('.mp3')
        ? 'audio/mpeg'
        : key.endsWith('.jpg') || key.endsWith('.jpeg')
        ? 'image/jpeg'
        : undefined;
      const res = await serveR2Object(env.PODCAST_BUCKET, key, contentType, 'public, max-age=31536000');
      if (res) return res;
      return new Response('Not found', { status: 404 });
    }

    // index.html / episodes.json / feed.xml / cover.jpg - the small fixed
    // set of top-level keys the site actually needs served.
    if (request.method === 'GET') {
      const key = pathname.slice(1);
      if (R2_CONTENT_TYPES[key]) {
        const res = await serveR2Object(env.PODCAST_BUCKET, key, R2_CONTENT_TYPES[key]);
        if (res) return res;
      }
      if (key === (env.COVER_IMAGE_KEY || 'cover.jpg')) {
        const res = await serveR2Object(env.PODCAST_BUCKET, key, 'image/jpeg', 'public, max-age=31536000');
        if (res) return res;
      }
    }

    if (url.pathname === '/refresh' && request.method === 'POST') {
      const authError = requireAuth(request, env.PODCAST_SECRET);
      if (authError) return authError;
      try {
        const result = await runRefresh(env);
        return Response.json(result);
      } catch (err) {
        console.error('Episode generation failed:', err);
        await writeRunStatus(env.PODCAST_BUCKET, {
          ok: false,
          ranAt: new Date().toISOString(),
          error: err.message,
          triggeredBy: 'manual-refresh'
        });
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    return Response.json(
      {
        error: 'Not found',
        receivedMethod: request.method,
        receivedPath: url.pathname,
        receivedSearch: url.search,
        receivedHost: url.host,
        hasAuthHeader: request.headers.has('Authorization')
      },
      { status: 404 }
    );
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runRefresh(env).catch(async (err) => {
        console.error('Scheduled episode generation failed:', err);
        await writeRunStatus(env.PODCAST_BUCKET, {
          ok: false,
          ranAt: new Date().toISOString(),
          error: err.message,
          triggeredBy: 'scheduled-cron'
        });
      })
    );
  }
};
