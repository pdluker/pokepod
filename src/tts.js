// Voice settings per speaker role.
//
// stability: lower = more expressive/varied delivery, but also more prone to
//   erratic pacing between generations. higher = more even and predictable.
// style: how strongly the model leans into exaggerated, stylized delivery.
//
// Play-by-play was originally tuned toward the "as expressive as possible"
// end (stability 0.35 / style 0.75) to sound like a hype announcer - but
// that combination is also what tends to produce inconsistent pacing from
// one line to the next. Pulled both values toward center here: still
// noticeably more energetic than color commentary, but less prone to
// rushing or dragging unpredictably. If this still isn't right, adjust in
// small steps (~0.05-0.1) and re-listen rather than jumping straight to the
// extremes - these two settings interact nonlinearly.
const VOICE_PROFILES = {
  pbp: { stability: 0.48, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true },
  color: { stability: 0.55, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true }
};

function voiceIdFor(speaker, env) {
  if (speaker === 'color') {
    return env.COLOR_COMMENTARY_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
  }
  return env.PLAY_BY_PLAY_VOICE_ID || env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
}

async function synthesizeBeatOnce(beat, env) {
  const voiceId = voiceIdFor(beat.speaker, env);
  const modelId = env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5';
  const voiceSettings = VOICE_PROFILES[beat.speaker] || VOICE_PROFILES.pbp;

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg'
    },
    body: JSON.stringify({
      text: beat.text,
      model_id: modelId,
      voice_settings: voiceSettings
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS failed for ${beat.speaker} beat (${res.status}): ${errText}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function synthesizeBeat(beat, env) {
  try {
    return await synthesizeBeatOnce(beat, env);
  } catch (firstErr) {
    console.error(`TTS beat failed once (${beat.speaker}), retrying:`, firstErr.message);
    try {
      return await synthesizeBeatOnce(beat, env);
    } catch (secondErr) {
      throw new Error(`TTS beat failed twice (${beat.speaker}), giving up: ${secondErr.message}`);
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

async function synthesizeEpisode(beats, env) {
  const buffers = await Promise.all(beats.map((beat) => synthesizeBeat(beat, env)));
  return concatUint8Arrays(buffers);
}

export { synthesizeEpisode, synthesizeBeat, voiceIdFor, VOICE_PROFILES };
