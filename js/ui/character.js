/* ─────────────────────────────────────────────
   Character screen — 3-stat sheet with the new
   curve bars, stat-role descriptions, decay rate,
   discipline tier, and achievements.
   ───────────────────────────────────────────── */

function renderCharacter(container, params) {
  const tab = (params && params.tab === 'data') ? 'data' : 'character';
  if (tab === 'data') {
    renderCharacterData(container);
    return;
  }
  container.innerHTML = `${characterTabsHtml('character')}<div id="character-body"></div>`;
  renderCharacterBody(document.getElementById('character-body'));
}

function characterTabsHtml(active) {
  return `
    <div class="seg-tabs">
      <a class="seg ${active === 'character' ? 'on' : ''}" href="#character">CHARACTER</a>
      <a class="seg ${active === 'data' ? 'on' : ''}" href="#character?tab=data">📊 DATA</a>
    </div>
  `;
}

function renderCharacterBody(container) {
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
      grow: 'Cardio only: Hiking (0.5/min, king), Jogging & Cycling (0.4/min), Swimming (0.3/min), Basketball/Yoga/Dog walking (0.2/min). Plus Burpees (0.04/rep) and Plank (0.01/sec).',
      fastest: 'Hiking — 0.5/min is the densest VIT gain in the game. 60min hike = +30 VIT acc.',
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
        Today's behavior × ${tierInfo.tier.mult.toFixed(2)} on all stat decay. ${tierInfo.points}/${tierInfo.maxPoints ?? 6} credits earned today.
      </div>
      <div class="tier-credits">
        ${credit('Workout logged', tierInfo.credits.showUp)}
        ${credit(`Calories ±10% (${Math.round(tierInfo.totals.calories)}/${player.goals.dailyCalories})`, tierInfo.credits.calories)}
        ${credit(`Protein ≥ ${player.goals.dailyProteinG}g (${Math.round(tierInfo.totals.protein)}g)`, tierInfo.credits.protein)}
        ${credit(`Fiber ≥ ${player.goals.dailyFiberG}g (${Math.round(tierInfo.totals.fiber)}g) AND Water ≥ ${player.goals.dailyWaterOz}oz (${Math.round(tierInfo.totals.water)}oz)`, tierInfo.credits.fiberWater)}
        ${credit('Weigh-in logged 4am–12pm', tierInfo.credits.weighIn)}
        ${credit('Sleep logged', tierInfo.credits.sleep)}
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

/* ── DATA sub-screen — charts for weight, sleep, stats ── */

function renderCharacterData(container) {
  const player = Store.getPlayer();
  const weightLog  = Store.getWeightLog();
  const sleepLog   = Store.getSleepLog();
  const statHist   = Store.getStatHistory();

  // Weight chart: last 90 days, oldest→newest for the line chart.
  const sliceDays = (rows, n) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - n);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`;
    return rows.filter(r => r.date >= cutoffStr).sort((a,b) => a.date.localeCompare(b.date));
  };

  const weightSeries = sliceDays(weightLog, 90).map(r => ({ x: r.date, y: r.lbs }));
  const sleepSeries  = sliceDays(sleepLog, 30).map(r => ({ x: r.date, y: r.hours }));
  const statSeries   = sliceDays(statHist, 90).map(s => ({ x: s.date, y: s.sum }));

  const weightTarget = player.goals.weightTargetLbs;
  const targetLine = weightTarget
    ? `<div class="chart-meta"><span>target: ${weightTarget} lbs</span></div>` : '';

  const sleepAvgQuality = sleepLog.length > 0
    ? (sleepLog.slice(0, 30).reduce((s, r) => s + r.quality, 0) / Math.min(30, sleepLog.length))
    : 0;
  const avgStars = sleepAvgQuality
    ? '★'.repeat(Math.round(sleepAvgQuality)) + '☆'.repeat(5 - Math.round(sleepAvgQuality))
    : '—';

  const weightCard = weightSeries.length === 0
    ? emptyDataCard('Weight', '📏', 'No weigh-ins yet. Log one from the dashboard.')
    : `
      <div class="card mb-12">
        <div class="card-title">📏 WEIGHT — last ${weightSeries.length} day${weightSeries.length === 1 ? '' : 's'}</div>
        ${svgLineChart(weightSeries, '#4cc9f0', '')}
        ${targetLine}
      </div>
    `;

  const sleepCard = sleepSeries.length === 0
    ? emptyDataCard('Sleep', '🌙', 'No sleep logged yet. Log it from the dashboard.')
    : `
      <div class="card mb-12">
        <div class="card-title">🌙 SLEEP — last ${sleepSeries.length} night${sleepSeries.length === 1 ? '' : 's'}</div>
        ${svgLineChart(sleepSeries, '#b388ff', '')}
        <div class="chart-meta">
          <span>avg quality: <span style="color:var(--accent-gold);">${avgStars}</span></span>
          <span>avg hours: ${(sleepSeries.reduce((s,p)=>s+p.y,0) / sleepSeries.length).toFixed(1)}h</span>
        </div>
      </div>
    `;

  const statCard = statSeries.length === 0
    ? emptyDataCard('Stats', '⚔️', 'Train to start tracking stat-sum over time.')
    : `
      <div class="card mb-12">
        <div class="card-title">⚔️ STAT SUM — last ${statSeries.length} day${statSeries.length === 1 ? '' : 's'}</div>
        ${svgLineChart(statSeries, '#ffd700', '')}
      </div>
    `;

  container.innerHTML = `
    ${characterTabsHtml('data')}
    ${weightCard}
    ${sleepCard}
    ${statCard}
    <button class="btn btn-secondary mt-8" onclick="Router.navigate('history')">📋 Full log history</button>
  `;
}

function emptyDataCard(label, icon, msg) {
  return `
    <div class="card mb-12">
      <div class="card-title">${icon} ${label.toUpperCase()}</div>
      <div class="muted-text" style="font-size:0.8rem;padding:14px 0;text-align:center;">${msg}</div>
    </div>
  `;
}

Router.register('character', renderCharacter);
