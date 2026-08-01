# Daily Creature Clash — Backlog

Formatted to match the stluker.com ecosystem's existing Open Tasks / Watch Items conventions (see stluker-project-index.md). Paste relevant sections into that file's backlog area if/when this project gets folded into the main index, or keep standalone here for now.

## 🟡 Open Tasks — Video

**Add a battle-video render, synced to the existing HP-log data** — not started, researched Jul 25, 2026

**What exists already that this builds on:**
- `battle.js`'s `simulateBattle()` already outputs exact turn-by-turn HP for both creatures — this is the data a synced HP-meter/HUD video needs, no new instrumentation required
- Poster image already generated per episode (`poster.js`, Workers AI `flux-1-schnell`) — usable as a title card or background
- Two-voice narrated audio already generated per episode (`tts.js`) — bring-your-own-audio track for the render, not something the video API needs to generate itself

**Decision needed:** pick a render API and get an account + key (this is the part that's actually blocking — everything else is ready to wire up)

**Pricing researched Jul 25, 2026** (at ~100-120 render-min/month, i.e. one ~4 min episode/day):

| Service | Effective cost/mo | Key trade-off |
|---|---|---|
| Shotstack | ~$20-48 | 30% overage premium past plan credits — uncapped-spend risk, same failure shape as the fire-api incident |
| Creatomate | ~$30-45 | Charges extra for built-in TTS (irrelevant here — bringing our own audio) |
| **JSON2Video** (leaning this way) | ~$25-49 | **Hard credit stop** — rendering just stops when credits run out, can't runaway-bill. TTS-bundling also irrelevant to us for the same reason as Creatomate. |

**Recommendation on file:** JSON2Video, specifically because of the hard-stop billing model — not the cheapest option, but the one structurally immune to the "uncapped automated spend" failure mode already seen once in this account. Re-verify pricing before signing up, since all of the above was researched a while before implementation and video-API pricing moves often.

**What "wiring it up" actually looks like, once an account/key exists:**
1. New module (e.g. `videoRender.js`) that builds a JSON2Video template: audio track = existing mp3, HP-bar overlay driven directly from `battleResult.log` timestamps, poster or generated art as background/title card
2. Called via plain `fetch()` from `index.js`'s `runRefresh()` — same pattern already used for ElevenLabs, no new architecture needed
3. Resulting video URL gets stored in `episodeMeta` (new `videoUrl` field) and uploaded/referenced the same way `audioUrl`/`posterUrl` already are
4. Decide where it's published — YouTube Data API upload is the obvious next question once the video itself exists, and is a separate piece of work (OAuth, upload quota, scheduling) not yet scoped

**Also not yet decided:** whether this becomes a daily full-length video (matching audio length) or a short teaser/social clip via Workers AI's native video models (RunwayML Gen-4.5 / Pixverse / Vidu / Grok Imagine Video — all callable via the same `env.AI.run()` binding already used for the poster, no new account needed, but limited to a few seconds per clip, not full episode length). These aren't mutually exclusive — a JSON2Video full render *and* a short Workers-AI teaser clip could both exist, serving different platforms.

## 👀 Watch Items — Video (once built)
- Confirm JSON2Video's actual credit consumption per render matches the pricing assumption above, before trusting the monthly cost estimate
- Confirm HP-bar timing actually syncs correctly against the narrated audio — the battle log's timestamps are turn-indexed, not wall-clock-timed against the TTS output, so some mapping logic will be needed between "turn N happens at word/beat M in the script" and "second X in the rendered audio"
