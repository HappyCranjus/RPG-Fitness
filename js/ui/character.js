/* ─────────────────────────────────────────────
   Character screen — stats, derived stats, achievements
   ───────────────────────────────────────────── */

function renderCharacter(container) {
  const player  = Store.getPlayer();
  const derived = Engine.getDerivedStats(player);
  const achs    = Achievements.getAll();
  const xpPct   = Math.min(100, Math.round((player.xp / player.xpToNextLevel) * 100));
  const rank    = Ranks.getRank(player);
  const today   = Store.today();
  const decay   = Engine.statDecayStatus(player, today);
  const daysLeft = Engine.daysUntilCycleEnd(player, today);

  const hp    = player.hp    ?? player.hpMax ?? 100;
  const hpMax = player.hpMax ?? (100 + player.stats.VIT * 15);
  const hpPct = Math.max(0, Math.min(100, Math.round((hp / hpMax) * 100)));
  const hpColor = hpPct > 60 ? 'linear-gradient(90deg,#1a7a32,var(--accent-green))'
    : hpPct > 30 ? 'linear-gradient(90deg,#8b7a00,#ffcc00)'
    : 'linear-gradient(90deg,var(--accent-red-dim),var(--accent-red))';

  const statDefs = [
    { key: 'STR', barClass: 'stat-bar-str',
      desc: 'Grows from bodyweight exercises (push-ups, squats, pull-ups). Higher STR = stronger attacks on the Combat screen.' },
    { key: 'AGI', barClass: 'stat-bar-agi',
      desc: 'Grows from sports, basketball, and swimming. Higher AGI = larger energy pool and faster energy regen — so you can attack more often.' },
    { key: 'VIT', barClass: 'stat-bar-vit',
      desc: 'Grows from cardio duration (jogging, swimming, walking). Raises your max HP. Your health ceiling = 100 + (VIT × 15).' },
    { key: 'DIS', barClass: 'stat-bar-dis',
      desc: 'Grows from consistency — logging every day, hitting protein and calorie targets, maintaining streaks. Does NOT grow from single sessions. Reduces junk food HP damage and scales protein-goal HP regen.' },
  ];

  const statRows = statDefs.map(({ key, barClass, desc }) => {
    const val = player.stats[key];
    const acc = player.statPoints[key + '_acc'] || 0;
    const pct = Math.min(100, Math.round(((acc % 10) / 10) * 100));
    const d = decay[key];
    let decayLabel = '';
    if (d) {
      if (d.isDecaying) {
        decayLabel = `<div class="stat-decay-label decaying">💀 Decaying — idle ${d.idle}d</div>`;
      } else if (d.decayingIn <= 1) {
        decayLabel = `<div class="stat-decay-label imminent">⚠️ Decays in ${d.decayingIn}d</div>`;
      }
    }
    return `
      <div class="stat-row" style="align-items:start;">
        <span class="stat-name" style="padding-top:4px;">${key}</span>
        <div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill ${barClass}" style="width:${Math.min(100, val * 5)}%"></div>
          </div>
          <div class="progress-track" style="height:3px;margin-top:2px;opacity:0.4;">
            <div class="stat-bar-fill ${barClass}" style="width:${pct}%"></div>
          </div>
          <div style="font-size:0.7rem;color:var(--text-dim);margin-top:3px;line-height:1.4;">${desc}</div>
          ${decayLabel}
        </div>
        <span class="stat-value" style="padding-top:4px;">${val}</span>
      </div>
    `;
  }).join('');

  const totalSessions = (player.totalActivitiesLogged || 0) + (player.totalExercisesLogged || 0);
  const unlockedCount = achs.filter(a => a.unlocked).length;

  container.innerHTML = `
    <!-- Player header -->
    <div class="player-card" style="border-color:${rank.color};">
      <div class="player-name-row">
        <span class="player-name">${escHtml(player.name)}</span>
        <span class="rank-badge-large" style="background:${rank.glow};color:${rank.color};border-color:${rank.color};">
          ${rank.tier}
        </span>
        <span class="player-level">LVL ${player.level}</span>
      </div>
      <div class="rank-progress" style="margin-top:4px;margin-bottom:10px;">
        ${rank.nextTier ? `
          <div class="rank-progress-track">
            <div class="rank-progress-fill" style="width:${rank.progress}%;background:${rank.color};"></div>
          </div>
          <div class="rank-progress-text">${rank.statSum} / ${rank.nextMin} → ${rank.nextTier}</div>
        ` : `<div class="rank-progress-text" style="color:${rank.color};">⭐ Top rank</div>`}
      </div>
      <div class="xp-section">
        <div class="xp-label">
          <span>XP this cycle (${daysLeft}d left) · peak Lv${player.cyclePeakLevel || player.level}</span>
          <span>${player.xp} / ${player.xpToNextLevel}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill progress-fill-gold" style="width:${xpPct}%"></div>
        </div>
      </div>
      <div style="display:flex;gap:16px;margin-top:12px;font-size:0.78rem;color:var(--text-muted);flex-wrap:wrap;">
        <span>🪙 ${player.gold} gold</span>
        <span>💪 ${totalSessions} sessions</span>
        <span>🏆 ${unlockedCount}/${achs.length} achievements</span>
      </div>
    </div>

    <!-- HP bar -->
    <div class="card">
      <div class="card-title" style="margin-bottom:10px;">HEALTH${player.knockedOut ? ' <span style="color:var(--accent-red);font-size:0.5rem;">💀 KNOCKED OUT</span>' : ''}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:1rem;">❤️</span>
        <div class="progress-track" style="flex:1;height:10px;">
          <div class="progress-fill" style="width:${hpPct}%;background:${hpColor};"></div>
        </div>
        <span style="font-family:var(--font-display);font-size:0.52rem;color:var(--text-primary);white-space:nowrap;">${hp} / ${hpMax}</span>
      </div>
      <div style="font-size:0.72rem;color:var(--text-dim);">
        Max HP = 100 + (VIT × 15) — raise VIT through cardio to increase your health ceiling
      </div>
      ${player.knockedOut ? `
      <div style="font-size:0.78rem;color:var(--accent-red);margin-top:8px;">
        Recovering — eat healthy meals to restore HP above ${Math.floor(hpMax * 0.5)} and clear the knock-out.
      </div>` : ''}
    </div>

    <!-- Stats -->
    <div class="card">
      <div class="card-title" style="margin-bottom:4px;">STATS</div>
      <div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:14px;">Stats grow automatically — you never enter them manually. Each 10 points earned = +1 to the stat.</div>
      <div class="stat-grid">${statRows}</div>
      <div class="divider"></div>
      <div class="section-label">DERIVED STATS</div>
      <div class="derived-stats">
        <div class="derived-stat">
          <span class="derived-stat-label">ATK</span>
          <span class="derived-stat-value">${derived.ATK}</span>
        </div>
        <div class="derived-stat">
          <span class="derived-stat-label">DEF</span>
          <span class="derived-stat-value">${derived.DEF}</span>
        </div>
        <div class="derived-stat">
          <span class="derived-stat-label">SPD</span>
          <span class="derived-stat-value">${derived.SPD}</span>
        </div>
        <div class="derived-stat">
          <span class="derived-stat-label">MP</span>
          <span class="derived-stat-value">${derived.MP}</span>
        </div>
      </div>
    </div>

    <!-- Achievements -->
    <div class="card">
      <div class="card-title" style="margin-bottom:14px;">ACHIEVEMENTS (${unlockedCount}/${achs.length})</div>
      <div class="achievement-grid">
        ${achs.map(a => `
          <div class="achievement-badge ${a.unlocked ? 'unlocked' : 'locked'}" title="${escHtml(a.desc)}">
            <span class="achievement-icon">${a.icon}</span>
            <span class="achievement-title">${escHtml(a.title)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Navigation links -->
    <button class="btn btn-secondary" onclick="Router.navigate('history')">📋 View History</button>
    <button class="btn btn-secondary mt-8" onclick="Router.navigate('schedule')">📅 Weekly Schedule</button>
    <button class="btn btn-secondary mt-8" onclick="Router.navigate('settings')">⚙️ Settings</button>
  `;
}

Router.register('character', renderCharacter);
