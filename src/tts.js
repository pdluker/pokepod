// tts.js — Daily Creature Clash text-to-speech
//
// UPDATED 2026-08-08: script.js moved from two hosts (pbp/color) to a
// single narrator ('Doc', speaker: 'narrator' on every beat) - kids
// consistently preferred that voice/tone over the play-by-play shouting.
// That changes what mergeConsecutiveBeats() below actually does: since
// every beat now shares one speaker, "consecutive same speaker" means the
// WHOLE episode qualifies to merge into a single block. Confirmed that's
// safe rather than assumed: eleven_flash_v2_5 (this file's default model)
// supports up to 40,000 characters per API request, and a full ~20-beat
// episode script runs roughly 3,000-5,000 characters - nowhere close.
// Merging the whole episode into one call is actually the BEST outcome for
// this file's stated goal (zero seams = zero choppiness), so that's now
// the normal case. A MAX_BLOCK_CHARS safety cap still splits (and
// re-stitches via previous_text/next_text) if some future episode's
// script ever runs unexpectedly long, rather than assuming it never will.
//
// Original two-fix history preserved below for context:
//
// Two fixes applied here (Aug 2026), both targeting the same root cause:
// each of the ~18-22 script beats per episode was being synthesized as a
// fully isolated ElevenLabs call (Promise.all, no shared context) and then
// just concatenated. That's exactly the failure mode ElevenLabs' own docs
// describe as causing "abrupt changes in prosody from one chunk to
// another" — the settings tuning done last session (stability/style) made
// each individual clip less erratic, but couldn't fix the seams between
// clips, which is most of what "choppy" sounds like across a full episode.
//
// Fix 1 — model_id default changed from the deprecated eleven_turbo_v2_5 to
// eleven_flash_v2_5. ElevenLabs' own docs now say Turbo is functionally
// equivalent to Flash except slower, and recommend Flash in all cases — so
// this is a strict win, not a tradeoff. Override via ELEVENLABS_MODEL_ID
// still works if you want to try eleven_multilingual_v2 for stronger
// long-form prosody (this project isn't latency-sensitive — it runs on a
// daily cron, not live — so the slower generation costs nothing).
//
// Fix 2 — consecutive beats from the same speaker are merged into one
// block before synthesis, and Request Stitching (previous_text/next_text)
// is sent on every remaining call so it has real context on both sides
// instead of being read cold. Merging cuts the number of seams (and
// ElevenLabs calls, and cost) roughly in half on its own; stitching
// handles the seams that are left. Because the full script is known
// upfront, none of this requires serializing the calls — blocks are still
// synthesized concurrently via Promise.all, same as before.

// Reused from the old 'color' profile - that's the tone/pacing kids
// preferred, now used for every beat since there's only one voice.
const VOICE_PROFILES = {
  narrator: { stability: 0.55, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true }
};

// MAX_BLOCK_CHARS is a safety cap, not a normal operating limit - real
// episodes (~3,000-5,000 chars) never approach it. Set well under
// eleven_flash_v2_5's real 40,000-char API ceiling so there's plenty of
// margin even if a future episode's script runs unusually long.
const MAX_BLOCK_CHARS = 8000;

function voiceIdFor(speaker, env) {
  // Single voice now - NARRATOR_VOICE_ID lets you rename the env var later
  // without a code change; falls back to the already-deployed
  // COLOR_COMMENTARY_VOICE_ID (the voice kids preferred) so this works
  // with zero wrangler.jsonc changes required right now.
  return env.NARRATOR_VOICE_ID || env.COLOR_COMMENTARY_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // default: "Adam"
}

// Merge consecutive beats from the same speaker into a single block. With
// a single narrator speaker, this now merges the WHOLE episode into one
// block under normal conditions (confirmed safe - see header comment) -
// the single biggest possible reduction in seams. MAX_BLOCK_CHARS is a
// safety net: if merging the next beat would cross that budget, a new
// block starts instead (still stitched via previous_text/next_text below).
function mergeConsecutiveBeats(beats) {
  const blocks = [];
  for (const beat of beats) {
    const last = blocks[blocks.length - 1];
    const wouldBeLength = last ? last.text.length + 1 + beat.text.length : beat.text.length;
    if (last && last.speaker === beat.speaker && wouldBeLength <= MAX_BLOCK_CHARS) {
      last.text = `${last.text} ${beat.text}`;
    } else {
      blocks.push({ speaker: beat.speaker, text: beat.text });
    }
  }
  return blocks;
}

async function synthesizeBlockOnce(block, index, blocks, env) {
  const voiceId = voiceIdFor(block.speaker, env);
  const modelId = env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5';
  const voiceSettings = VOICE_PROFILES[block.speaker] || VOICE_PROFILES.narrator;

  const body = {
    text: block.text,
    model_id: modelId,
    voice_settings: voiceSettings
  };

  // Request Stitching is not available on eleven_v3 — guarded so a future
  // model swap to v3 doesn't send a param that gets rejected outright.
  if (modelId !== 'eleven_v3') {
    const prev = blocks[index - 1];
    const next = blocks[index + 1];
    if (prev) body.previous_text = prev.text;
    if (next) body.next_text = next.text;
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS failed for ${block.speaker} block (${res.status}): ${errText}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function synthesizeBlock(block, index, blocks, env) {
  try {
    return await synthesizeBlockOnce(block, index, blocks, env);
  } catch (firstErr) {
    console.error(`TTS block failed once (${block.speaker}), retrying:`, firstErr.message);
    try {
      return await synthesizeBlockOnce(block, index, blocks, env);
    } catch (secondErr) {
      throw new Error(`TTS block failed twice (${block.speaker}), giving up: ${secondErr.message}`);
    }
  }
}

function concatUint8Arrays(arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// beats: array of { speaker: 'narrator', text: string }, in script order
// (script.js's external shape is otherwise unchanged).
async function synthesizeEpisode(beats, env) {
  const blocks = mergeConsecutiveBeats(beats);
  const buffers = await Promise.all(
    blocks.map((block, index) => synthesizeBlock(block, index, blocks, env))
  );
  return concatUint8Arrays(buffers);
}

// Alias kept so this file deploys cleanly whether index.js imports the old
// name (synthesizeBeat, from before the beat-merging fix) or the new one
// (synthesizeBlock) — avoids a round-trip to confirm which before deploying.
export {
  synthesizeEpisode,
  synthesizeBlock,
  synthesizeBlock as synthesizeBeat,
  mergeConsecutiveBeats,
  voiceIdFor,
  VOICE_PROFILES
};
