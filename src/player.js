export const PLAYER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Daily Creature Clash - Podcast</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: linear-gradient(135deg, #2b1055, #7597de);
    min-height: 100vh;
    color: #fff;
    padding: 24px 16px 60px;
  }
  .wrap { max-width: 680px; margin: 0 auto; }
  header { text-align: center; margin-bottom: 24px; }
  header h1 { font-size: 1.9rem; margin: 0 0 6px; }
  header p.tagline { opacity: 0.85; margin: 0; font-size: 0.95rem; }

  .card {
    background: rgba(255,255,255,0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 18px;
    padding: 20px 22px;
    margin-bottom: 16px;
  }

  .subscribe-box h2 { font-size: 1rem; margin: 0 0 8px; }
  .subscribe-box p { font-size: 0.85rem; opacity: 0.8; margin: 0 0 8px; }
  .feed-url {
    background: rgba(0,0,0,0.35);
    border-radius: 8px;
    padding: 10px 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.85rem;
    word-break: break-all;
  }

  .poster { width: 100%; border-radius: 14px; display: block; margin-bottom: 16px; background: rgba(255,255,255,0.08); }
  .episode-title { font-size: 1.25rem; margin: 0 0 4px; }
  .episode-tagline { font-size: 0.95rem; font-style: italic; opacity: 0.85; margin: 0 0 6px; }
  .episode-meta { font-size: 0.8rem; opacity: 0.7; margin-bottom: 16px; }

  audio { width: 100%; margin: 4px 0 4px; }

  .toggle-btn {
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.25);
    color: #fff;
    border-radius: 999px;
    padding: 8px 16px;
    font-size: 0.85rem;
    cursor: pointer;
    margin-top: 10px;
  }
  .transcript { display: none; margin-top: 14px; font-size: 0.9rem; line-height: 1.5; }
  .transcript.open { display: block; }

  /* --- Tale of the Tape --- */
  .tape h3 { margin: 0 0 12px; font-size: 1rem; }
  .tape-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 10px; }
  .tape-name { flex: 1; font-weight: 600; font-size: 0.95rem; }
  .tape-name.right { text-align: right; }
  .tape-type-badge {
    display: inline-block; padding: 2px 8px; border-radius: 999px;
    font-size: 0.7rem; margin-top: 2px; color: #1a1a1a; font-weight: 600;
  }
  .stat-line { margin-bottom: 8px; }
  .stat-label { font-size: 0.72rem; opacity: 0.7; text-align: center; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.04em; }
  .stat-bars { display: flex; align-items: center; gap: 8px; }
  .stat-bar-track { flex: 1; height: 8px; background: rgba(255,255,255,0.12); border-radius: 6px; overflow: hidden; display: flex; }
  .stat-bar-track.left { justify-content: flex-end; }
  .stat-bar-fill { height: 100%; border-radius: 6px; }
  .stat-value { font-size: 0.75rem; width: 32px; text-align: center; opacity: 0.85; }
  .winner-banner {
    text-align: center; font-weight: 700; font-size: 0.95rem;
    padding: 8px; margin-top: 4px; border-radius: 10px;
    background: rgba(255, 215, 100, 0.18); border: 1px solid rgba(255,215,100,0.35);
  }

  /* --- HP Replay --- */
  .replay h3 { margin: 0 0 12px; font-size: 1rem; }
  .hp-row { margin-bottom: 14px; }
  .hp-row-label { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px; }
  .hp-track { width: 100%; height: 14px; background: rgba(0,0,0,0.3); border-radius: 7px; overflow: hidden; }
  .hp-fill { height: 100%; border-radius: 7px; transition: width 0.4s ease; }
  .hp-fill.a { background: linear-gradient(90deg, #4ade80, #22c55e); }
  .hp-fill.b { background: linear-gradient(90deg, #60a5fa, #3b82f6); }
  .replay-log {
    font-size: 0.82rem; min-height: 20px; opacity: 0.9; margin: 10px 0;
    padding: 8px 10px; background: rgba(0,0,0,0.2); border-radius: 8px;
  }
  .replay-controls { display: flex; gap: 8px; }

  /* --- Arena card --- */
  .arena h3 { margin: 0 0 6px; font-size: 1rem; }
  .arena .weather { font-size: 0.8rem; opacity: 0.75; margin-bottom: 8px; }
  .arena p { font-size: 0.88rem; margin: 4px 0; line-height: 1.45; }
  .arena .legend { font-style: italic; opacity: 0.8; }

  .archive-item {
    display: flex; gap: 12px; align-items: center;
    padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .archive-item img { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
  .archive-item .archive-title { font-size: 0.85rem; margin: 0 0 2px; }
  .archive-item .archive-meta { font-size: 0.72rem; opacity: 0.65; }

  .loading, .empty { text-align: center; opacity: 0.7; padding: 40px 0; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Daily Creature Clash</h1>
      <p class="tagline" id="tagline">A new randomized creature battle, every day.</p>
    </header>

    <div class="card subscribe-box">
      <h2>Subscribe</h2>
      <p>Paste this into Apple Podcasts, Overcast, or Pocket Casts:</p>
      <div class="feed-url" id="feedUrl">Loading…</div>
    </div>

    <div id="latest" class="card loading">Loading latest episode…</div>

    <div id="archive"></div>
  </div>

  <script>
    const R2_BASE = location.origin;

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str == null ? '' : str;
      return div.innerHTML;
    }

    function splitTitle(title) {
      const idx = title.indexOf(' - ');
      if (idx === -1) return { main: title, tagline: null };
      return { main: title.slice(0, idx), tagline: title.slice(idx + 3) };
    }

    function statBarRow(label, aVal, bVal, maxVal) {
      const aPct = Math.min(100, (aVal / maxVal) * 100);
      const bPct = Math.min(100, (bVal / maxVal) * 100);
      return \`
        <div class="stat-line">
          <div class="stat-label">\${label}</div>
          <div class="stat-bars">
            <div class="stat-value">\${aVal}</div>
            <div class="stat-bar-track left"><div class="stat-bar-fill" style="width:\${aPct}%;background:#4ade80"></div></div>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:\${bPct}%;background:#60a5fa"></div></div>
            <div class="stat-value">\${bVal}</div>
          </div>
        </div>\`;
    }

    function renderTaleOfTape(battle) {
      const { creatureA: a, creatureB: b, winner } = battle;
      const maxStat = Math.max(a.stats.hp, b.stats.hp, a.stats.attack, b.stats.attack,
        a.stats.defense, b.stats.defense, a.stats.speed, b.stats.speed);
      return \`
        <div class="card tape">
          <h3>Tale of the Tape</h3>
          <div class="tape-row">
            <div class="tape-name">\${escapeHtml(a.name)}<br/>
              <span class="tape-type-badge" style="background:\${a.primaryType.color}">\${a.primaryType.emoji} \${a.primaryType.name}</span>
            </div>
            <div style="width:40px;text-align:center;opacity:.6;font-size:.75rem;">VS</div>
            <div class="tape-name right">\${escapeHtml(b.name)}<br/>
              <span class="tape-type-badge" style="background:\${b.primaryType.color}">\${b.primaryType.emoji} \${b.primaryType.name}</span>
            </div>
          </div>
          \${statBarRow('HP', a.stats.hp, b.stats.hp, maxStat)}
          \${statBarRow('Attack', a.stats.attack, b.stats.attack, maxStat)}
          \${statBarRow('Defense', a.stats.defense, b.stats.defense, maxStat)}
          \${statBarRow('Speed', a.stats.speed, b.stats.speed, maxStat)}
          <div style="font-size:.78rem;opacity:.75;margin-top:8px;">
            Abilities: <b>\${escapeHtml(a.ability)}</b> vs <b>\${escapeHtml(b.ability)}</b>
          </div>
          \${winner ? \`<div class="winner-banner">\${escapeHtml(winner)} won this one</div>\` : \`<div class="winner-banner">Double knockout - no winner</div>\`}
        </div>\`;
    }

    function renderArena(arena) {
      if (!arena) return '';
      return \`
        <div class="card arena">
          <h3>\${escapeHtml(arena.name)}</h3>
          <div class="weather">\${escapeHtml(arena.weather)}</div>
          <p>\${escapeHtml(arena.description)}. \${escapeHtml(arena.hazard)}.</p>
          <p class="legend">\${escapeHtml(arena.legend)}.</p>
        </div>\`;
    }

    function renderReplay(battle) {
      if (!battle.log || battle.log.length === 0) return '';
      const aName = battle.creatureA.name, bName = battle.creatureB.name;
      const aMax = battle.creatureA.stats.hp, bMax = battle.creatureB.stats.hp;
      return \`
        <div class="card replay">
          <h3>Battle Replay</h3>
          <div class="hp-row">
            <div class="hp-row-label"><span>\${escapeHtml(aName)}</span><span id="hpValA">\${aMax}/\${aMax}</span></div>
            <div class="hp-track"><div class="hp-fill a" id="hpFillA" style="width:100%"></div></div>
          </div>
          <div class="hp-row">
            <div class="hp-row-label"><span>\${escapeHtml(bName)}</span><span id="hpValB">\${bMax}/\${bMax}</span></div>
            <div class="hp-track"><div class="hp-fill b" id="hpFillB" style="width:100%"></div></div>
          </div>
          <div class="replay-log" id="replayLog">Press play to watch the battle unfold turn by turn.</div>
          <div class="replay-controls">
            <button class="toggle-btn" id="replayPlay">▶ Play Replay</button>
            <button class="toggle-btn" id="replayReset">⟲ Reset</button>
          </div>
        </div>\`;
    }

    function wireReplay(battle) {
      const log = battle.log;
      const aName = battle.creatureA.name, bName = battle.creatureB.name;
      const aMax = battle.creatureA.stats.hp, bMax = battle.creatureB.stats.hp;
      const fillA = document.getElementById('hpFillA');
      const fillB = document.getElementById('hpFillB');
      const valA = document.getElementById('hpValA');
      const valB = document.getElementById('hpValB');
      const logEl = document.getElementById('replayLog');
      const playBtn = document.getElementById('replayPlay');
      const resetBtn = document.getElementById('replayReset');
      let i = 0;
      let timer = null;

      function reset() {
        clearInterval(timer);
        timer = null;
        i = 0;
        fillA.style.width = '100%';
        fillB.style.width = '100%';
        valA.textContent = aMax + '/' + aMax;
        valB.textContent = bMax + '/' + bMax;
        logEl.textContent = 'Press play to watch the battle unfold turn by turn.';
        playBtn.textContent = '▶ Play Replay';
      }

      function applyEvent(e) {
        if (e.type === 'miss') {
          logEl.textContent = 'Turn ' + e.turn + ': ' + e.attacker + ' attacks ' + e.defender + ' - misses!';
          return;
        }
        const isA = e.defender === aName;
        const pct = Math.max(0, Math.round((e.defenderHpRemaining / e.defenderMaxHp) * 100));
        if (isA) {
          fillA.style.width = pct + '%';
          valA.textContent = e.defenderHpRemaining + '/' + e.defenderMaxHp;
        } else {
          fillB.style.width = pct + '%';
          valB.textContent = e.defenderHpRemaining + '/' + e.defenderMaxHp;
        }
        logEl.textContent = 'Turn ' + e.turn + ': ' + e.attacker + ' hits ' + e.defender +
          (e.type === 'crit' ? ' - CRITICAL HIT! ' : ' for ') + e.damage + ' damage.';
      }

      playBtn.addEventListener('click', () => {
        if (timer) { clearInterval(timer); timer = null; playBtn.textContent = '▶ Play Replay'; return; }
        if (i >= log.length) reset();
        playBtn.textContent = '⏸ Pause';
        timer = setInterval(() => {
          if (i >= log.length) { clearInterval(timer); timer = null; playBtn.textContent = '▶ Play Replay'; return; }
          applyEvent(log[i]);
          i++;
        }, 650);
      });
      resetBtn.addEventListener('click', reset);
    }

    function renderLatest(ep) {
      const container = document.getElementById('latest');
      container.className = 'card';
      const { main, tagline } = splitTitle(ep.title);
      if (tagline) document.getElementById('tagline').textContent = tagline;

      const date = new Date(ep.pubDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const mins = ep.durationSeconds ? Math.round(ep.durationSeconds / 60) : null;

      container.innerHTML = \`
        \${ep.posterUrl ? \`<img class="poster" src="\${ep.posterUrl}" alt="" />\` : ''}
        <div class="episode-title">\${escapeHtml(main)}</div>
        \${tagline ? \`<div class="episode-tagline">\${escapeHtml(tagline)}</div>\` : ''}
        <div class="episode-meta">Episode \${ep.episodeNumber} · \${date}\${mins ? ' · ~' + mins + ' min' : ''}</div>
        <audio controls preload="none" src="\${ep.audioUrl}"></audio>
        <div>
          <button class="toggle-btn" id="transcriptToggle">Show full transcript</button>
          <div class="transcript" id="transcriptBody">\${ep.description}</div>
        </div>
      \`;

      document.getElementById('transcriptToggle').addEventListener('click', (e) => {
        const body = document.getElementById('transcriptBody');
        body.classList.toggle('open');
        e.target.textContent = body.classList.contains('open') ? 'Hide full transcript' : 'Show full transcript';
      });

      if (ep.battle) {
        const wrap = document.createElement('div');
        wrap.innerHTML = renderTaleOfTape(ep.battle) + renderReplay(ep.battle) + renderArena(ep.battle.arena);
        // Insert the new cards directly after the latest-episode card.
        container.after(...Array.from(wrap.children));
        wireReplay(ep.battle);
      }
    }

    function renderArchive(episodes) {
      const container = document.getElementById('archive');
      if (episodes.length <= 1) return;
      const rest = episodes.slice(1);
      const html = rest.map((ep) => {
        const date = new Date(ep.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const { main } = splitTitle(ep.title);
        return \`
          <div class="archive-item">
            \${ep.posterUrl ? \`<img src="\${ep.posterUrl}" alt="" loading="lazy" />\` : ''}
            <div>
              <div class="archive-title">\${escapeHtml(main)}</div>
              <div class="archive-meta">Episode \${ep.episodeNumber} · \${date}</div>
            </div>
          </div>\`;
      }).join('');
      container.innerHTML = \`<div class="card"><h3 style="margin:0 0 4px;font-size:1rem;">Past Episodes</h3>\${html}</div>\`;
    }

    document.getElementById('feedUrl').textContent = R2_BASE + '/feed.xml';

    fetch('/episodes.json')
      .then((r) => r.json())
      .then((episodes) => {
        if (!episodes || episodes.length === 0) {
          document.getElementById('latest').className = 'empty';
          document.getElementById('latest').textContent = 'No episodes yet - check back after the first run.';
          return;
        }
        const sorted = [...episodes].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        renderLatest(sorted[0]);
        renderArchive(sorted);
      })
      .catch(() => {
        document.getElementById('latest').className = 'empty';
        document.getElementById('latest').textContent = 'Could not load episodes right now.';
      });
  </script>
</body>
</html>`;
