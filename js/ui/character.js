/* ─────────────────────────────────────────────
   Character screen — 3-stat sheet with the new
   curve bars, stat-role descriptions, decay rate,
   discipline tier, and achievements.
   ───────────────────────────────────────────── */

function renderCharacter(container) {
  const player  = Store.getPlayer();
  const derived = Engine.getDerivedStats(player);
  const achs    = Achievements.getAll();
  const xpPct   = Math.min(100, Math.round((player.xp / player.xpToNextLevel) * 100));
  const rank    = Ranks.getRank(player);
  const today   = Store.today();
  const todayLog = Store.getLog().filter(e => e.date === today);
  const tierInfo = Engine.disciplineTier(player, todayLog);
  const daysLeft = Engine.daysUntilCycleEnd(player, today);

  const hp    = player.hp    ?? player.hpMax ?? 100;
  const hpMax = player.hpMax ?? (100 + player.stats.VIT * 15);
  const hpPct = Math.max(0, Math.min(100, Math.round((hp / hpMax) * 100)));
  const hpColor = hpPct > 60 ? 'linear-gradient(90deg,#1a7a32,var(--accent-green))'
    : hpPct > 30 ? 'linear-gradient(90deg,#8b7a00,#ffcc00)'
    : 'linear-gradient(90deg,var(--accent-red-dim),var(--accent-red))';

  const statDefs = [
    { key: 'STR', barClass: 'stat-bar-str',
      role: `Attack damage (ATK = STR×5) + weakness amplifier (×${Engine.weaknessMultiplier(player.stats.STR).toFixed(2)} on monster weaknesses).`,
      grow: 'Weighted lifts (Bench 0.12/rep, Pull-ups & Dips 0.10/rep), bodyweight reps, swimming.',
      fastest: 'Bench Press / Pull-ups — best STR per rep. Push-ups bulk fast at 0.05/rep.',
      decay: `${Engine.STAT_DECAY_PER_DAY.STR} acc/day × ${tierInfo.tier.mult.toFixed(2)} tier = ${(Engine.STAT_DECAY_PER_DAY.STR * tierInfo.tier.mult).toFixed(2)}/day.`,
    },
    { key: 'AGI', barClass: 'stat-bar-agi',
      role: `Energy pool (${player.maxEnergy} max), regen (${(3 + player.stats.AGI * 0.5).toFixed(1)}/hr), and dodge chance (${Math.round(Math.min(0.5, player.stats.AGI * 0.015) * 100)}% per monster strike).`,
      grow: 'Sports / Basketball (0.5/min, king), Yoga (0.4/min), Swimming (0.3/min), Burpees.',
      fastest: 'Basketball or any sport — 30min = +15 AGI. Yoga is the indoor alternative.',
      decay: `${Engine.STAT_DECAY_PER_DAY.AGI} acc/day × ${tierInfo.tier.mult.toFixed(2)} tier = ${(Engine.STAT_DECAY_PER_DAY.AGI * tierInfo.tier.mult).toFixed(2)}/day.`,
    },
    { key: 'VIT', barClass: 'stat-bar-vit',
      role: `Max HP (${hpMax}) + passive HP-decay resistance (${Math.round(Math.min(0.3, player.stats.VIT * 0.01) * 100)}% slower drain).`,
      grow: 'Cardio: Hiking (0.5/min, king), Jogging & Cycling (0.4/min), Swimming (0.3/min). +0.5 per logged meal.',
      fastest: 'Hiking + log every meal — densest gain plus the free-VIT-for-logging bonus.',
      decay: `${Engine.STAT_DECAY_PER_DAY.VIT} acc/day × ${tierInfo.tier.mult.toFixed(2)} tier = ${(Engine.STAT_DECAY_PER_DAY.VIT * tierInfo.tier.mult).toFixed(2)}/day.`,
    },
  ];

  const statRows = statDefs.map(({ key, barClass, role, grow, fastest, decay }) => {
    const val = player.stats[key];
    const acc = player.statPoints[key + '_acc'] || 0;
    const curve = Engine.statCurve.statFromAcc(acc);
    const pct = Engine.statCurve.progressPct(acc);
    return `
      <div class="stat-row" style="align-items:start;">
        <span class="stat-name" style="padding-top:4px;">${key}</span>
        <div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill ${barClass}" style="width:${pct}%"></div>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:3px;font-family:var(--font-display);font-size:0.4rem;letter-spacing:0.04em;">
            ${curve.accIntoLevel.toFixed(2)} / ${curve.nextCost} → ${key} ${curve.stat + 1}
          </div>
          <div style="font-size:0.72rem;color:var(--text-dim);margin-top:6px;line-height:1.4;">
            <strong style="color:var(--text-muted);">Does:</strong> ${role}
          </div>
          <div style="font-size:0.7rem;color:var(--text-dim);margin-top:3px;line-height:1.4;">
            <strong style="color:var(--text-muted);">Grow:</strong> ${grow}
          </div>
          <div style="font-size:0.7rem;color:var(--accent-gold);margin-top:3px;line-height:1.4;">
            <strong>🏆 Fastest:</strong> ${fastest}
          </div>
          <div style="font-size:0.68rem;color:var(--accent-red-dim);margin-top:3px;line-height:1.4;">
            <strong style="color:var(--accent-red);">Decay:</strong> ${decay}
          </div>
        </div>
        <span class="stat-value" style="padding-top:4px;">${val}</span>
      </div>
    `;
  }).join('');

  const totalSessions = (player.totalActivitiesLogged || 0) + (player.totalExercisesLogged || 0);
  const unlockedCount = achs.filter(a => a.unlocked).length;

  // Tier card: shows credits + multiplier
  const credit = (k, on) => `<span class="${on ? 'credit-on' : 'credit-off'}">${on ? '✅' : '⬜'} ${k}</span>`;

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
        Max HP = 100 + (VIT × 15) — raise VIT through cardio. Resist = ${Math.round(Math.min(0.3, player.stats.VIT * 0.01) * 100)}% slower passive drain.
      </div>
      ${player.knockedOut ? `
      <div style="font-size:0.78rem;color:var(--accent-red);margin-top:8px;">
        Recovering — eat healthy meals to restore HP above ${Math.floor(hpMax * 0.5)} and clear the knock-out.
      </div>` : ''}
    </div>

    <!-- Discipline tier card -->
    <div class="card" style="border-color:${tierInfo.tier.color};">
      <div class="card-title" style="color:${tierInfo.tier.color};">DISCIPLINE — ${tierInfo.tier.label.toUpperCase()}</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;margin-bottom:10px;">
        Today's behavior × ${tierInfo.tier.mult.toFixed(2)} on all stat decay. ${tierInfo.points}/4 credits earned today.
      </div>
      <div class="tier-credits">
        ${credit('Workout logged', tierInfo.credits.showUp)}
        ${credit('Protein hit', tierInfo.credits.protein)}
        ${credit('Calories ±10%', tierInfo.credits.calories)}
        ${credit(`Sugar ≤ ${player.goals.dailyAddedSugarMaxG ?? 36}g (${tierInfo.totals.sugar}g so far)`, tierInfo.credits.sugar)}
      </div>
    </div>

    <!-- Stats -->
    <div class="card">
      <div class="card-title" style="margin-bottom:4px;">STATS</div>
      <div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:14px;">
        Stats grow from logged work. Next level gets harder each time (curve: 8 + n acc).
        Decay every 30 min, scaled by today's discipline tier.
      </div>
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
