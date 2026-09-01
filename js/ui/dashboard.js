/* ─────────────────────────────────────────────
   Dashboard screen
   ───────────────────────────────────────────── */

let _bonusCountdownTimer = null;

function renderDashboard(container) {
  // Clear any prior bonus countdown timer
  if (_bonusCountdownTimer) {
    clearInterval(_bonusCountdownTimer);
    _bonusCountdownTimer = null;
  }

  const player   = Store.getPlayer();
  const today    = Store.today();
  const weekStart = Store.weekStart();
  const rank     = Ranks.getRank(player);
  const daysLeft = Engine.daysUntilCycleEnd(player, today);
  const schedule = Store.getSchedule();
  const todayRoutineId = schedule[Store.weekdayKey()];
  const todayRoutine   = todayRoutineId ? Routines.getRoutine(todayRoutineId) : null;
  const allLogs        = Store.getLog();
  const todayLog       = allLogs.filter(e => e.date === today);
  const tierInfo       = Engine.disciplineTier(player, todayLog);
  const totals         = Engine.dailyTotals(todayLog);
  const bonus    = Engine.getActiveBonus(Date.now());
  const heroHtml = renderStatsHero(player, today);
  const macroHtml = renderMacroCard(player, totals);
  const deficitHtml = renderDeficitCard(player, totals, todayLog);
  const deficitHistoryHtml = renderDeficitHistoryCard(player);
  const muscleCoverageHtml = renderMuscleCoverageCard(player, allLogs, weekStart);
  const weighInHtml = renderWeighInWidget(player);
  const sleepHtml = renderSleepWidget();
  const momentumHtml = renderStatMomentumCard(player, totals, tierInfo);
  const bonusHtml = renderBonusBanner(bonus, Date.now());
  const forecastHtml = renderHpForecast(player);
  const tierHtml = renderTierBanner(tierInfo, player);

  // Refresh quests for today
  const questState = Quests.refresh(today, weekStart);
  const activeQuests = questState.active.filter(q => !q.completedAt && q.type !== 'milestone');

  const xpPct = Math.min(100, Math.round((player.xp / player.xpToNextLevel) * 100));

  container.innerHTML = `
    ${heroHtml}
    ${macroHtml}
    ${deficitHtml}
    ${deficitHistoryHtml}
    <div class="daily-widget-grid">
      ${weighInHtml}
      ${sleepHtml}
    </div>
    ${momentumHtml}
    ${muscleCoverageHtml}
    ${forecastHtml}
    ${bonusHtml}
    ${tierHtml}

    <!-- Rank + cycle card -->
    <div class="rank-card" style="border-color:${rank.color};box-shadow:0 0 14px ${rank.glow};">
      <div class="rank-card-row">
        <div class="rank-badge" style="background:${rank.glow};color:${rank.color};border-color:${rank.color};">
          ${rank.tier}
        </div>
        <div class="rank-info">
          <div class="rank-info-label">${rank.label}</div>
          <div class="rank-info-sum">${rank.statSum} stat points</div>
        </div>
        <div class="cycle-info">
          <div class="cycle-info-label">CYCLE</div>
          <div class="cycle-info-days">${daysLeft}d left</div>
        </div>
      </div>
      ${rank.nextTier ? `
      <div class="rank-progress">
        <div class="rank-progress-track">
          <div class="rank-progress-fill" style="width:${rank.progress}%;background:${rank.color};"></div>
        </div>
        <div class="rank-progress-text">
          ${rank.statSum} / ${rank.nextMin} → ${rank.nextTier}
        </div>
      </div>` : `
      <div class="rank-progress-text" style="margin-top:8px;color:${rank.color};">
        ⭐ Top tier reached
      </div>`}
    </div>

    ${todayRoutine ? `
    <div class="today-routine-card" onclick="Router.navigate('log?routine=${todayRoutine.id}')">
      <div class="today-routine-header">
        <span class="today-routine-tag">▶ TODAY</span>
        <span style="font-size:0.72rem;color:var(--accent-gold);">${todayRoutine.rank} Rank</span>
      </div>
      <div class="today-routine-name">${escHtml(todayRoutine.name)}</div>
      <div class="today-routine-flavor">${escHtml(todayRoutine.flavor)}</div>
      <button class="btn btn-primary mt-8">START ROUTINE</button>
    </div>` : ''}

    <!-- XP bar -->
    <div class="card" style="padding:12px 16px;">
      <div class="xp-label" style="margin-bottom:5px;">
        <span style="font-size:0.72rem;color:var(--text-muted);">XP — cosmetic level resets each cycle</span>
        <span style="font-family:var(--font-display);font-size:0.48rem;color:var(--accent-gold);">${player.xp} / ${player.xpToNextLevel}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill progress-fill-gold" style="width:${xpPct}%"></div>
      </div>
    </div>

    ${renderQuestSummary(activeQuests, questState, player)}

    ${renderStreakBar(player)}

    <button class="btn btn-primary mt-16" onclick="Router.navigate('log')">
      ⚔️ LOG WORKOUT / MEAL
    </button>

    <div class="tap-hint mt-8">Gold: ${player.gold} 🪙</div>
  `;

  // Tick the bonus countdown text once a minute (no full re-render).
  _bonusCountdownTimer = setInterval(() => {
    const el = document.getElementById('bonus-countdown');
    if (!el) {
      clearInterval(_bonusCountdownTimer);
      _bonusCountdownTimer = null;
      return;
    }
    const cur = Engine.getActiveBonus(Date.now());
    if (cur.itemId !== bonus.itemId) {
      renderDashboard(container);
      return;
    }
    el.textContent = formatBonusRemaining(cur.windowEnd - Date.now());
  }, 60 * 1000);
}

/* ── Stats hero panel (above rank card) ─────────── */

function renderStatsHero(player, today) {
  const history = Store.getStatHistory();
  const prev = history.filter(h => h.date < today).sort((a, b) => b.date.localeCompare(a.date))[0];

  const statDefs = [
    { key: 'STR', barClass: 'stat-bar-str' },
    { key: 'AGI', barClass: 'stat-bar-agi' },
    { key: 'VIT', barClass: 'stat-bar-vit' },
  ];

  const rows = statDefs.map(({ key, barClass }) => {
    const val = player.stats[key];
    const acc = player.statPoints[key + '_acc'] || 0;
    const curve = Engine.statCurve.statFromAcc(acc);
    const pct   = Engine.statCurve.progressPct(acc);

    let deltaChip = '';
    if (prev) {
      const d = val - (prev[key] || 0);
      if (d > 0) deltaChip = `<span class="delta-chip">+${d} today</span>`;
      else if (d < 0) deltaChip = `<span class="decay-chip">${d} today</span>`;
    }

    return `
      <div class="stats-hero-row">
        <span class="stats-hero-key ${barClass}-text">${key}</span>
        <span class="stats-hero-val">${val}</span>
        <div class="stats-hero-bar-col">
          <div class="stats-hero-bar-track">
            <div class="stat-bar-fill ${barClass}" style="width:${pct}%"></div>
          </div>
          <span class="stats-hero-bar-text">${curve.accIntoLevel.toFixed(1)}/${curve.nextCost} → ${key}${curve.stat + 1}</span>
        </div>
        <div class="stats-hero-chips">${deltaChip}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="stats-hero-card">
      <div class="stats-hero-title">YOUR STATS</div>
      ${rows}
      <div class="stats-hero-footnote">
        STR → attack & weakness amp · AGI → energy & dodge · VIT → HP & resist
      </div>
    </div>
  `;
}

/* ── Discipline tier banner ─────────────────────── */

function renderTierBanner(tierInfo, player) {
  const dots = ['showUp', 'calories', 'protein', 'fiberWater', 'weighIn', 'sleep']
    .map(k => `<span class="tier-dot ${tierInfo.credits[k] ? 'on' : 'off'}"></span>`).join('');
  const max = tierInfo.maxPoints ?? 6;
  return `
    <div class="tier-banner" style="border-color:${tierInfo.tier.color};color:${tierInfo.tier.color};" onclick="Router.navigate('character')">
      <div class="tier-banner-row">
        <span class="tier-banner-label">DISCIPLINE</span>
        <span class="tier-banner-tier">${tierInfo.tier.label.toUpperCase()}</span>
        <span class="tier-banner-mult">decay × ${tierInfo.tier.mult.toFixed(2)}</span>
      </div>
      <div class="tier-banner-row tier-banner-credits">
        ${dots}
        <span class="tier-banner-credits-text">${tierInfo.points}/${max} today</span>
      </div>
    </div>
  `;
}

/* ── HP forecast (shown when you've been silent on meals) ── */

function renderHpForecast(player) {
  if (player.knockedOut) return '';
  const log = Store.getLog();
  let latestMealTs = 0;
  for (const entry of log) {
    if (entry.meals && entry.meals.length > 0 && entry.timestamp > latestMealTs) {
      latestMealTs = entry.timestamp;
    }
  }
  const hoursSinceMeal = latestMealTs
    ? (Date.now() - latestMealTs) / 3600000
    : Infinity;
  if (hoursSinceMeal < 12) return '';

  const vitResist = Math.min(0.30, (player.stats.VIT || 1) * 0.01);
  const damagePerHour = Engine.HP_DECAY_PER_HOUR * (1 - vitResist) + Engine.MONSTER_ATTACK_DAMAGE / 6;
  const hoursToKo = Math.max(0, Math.round((player.hp || 0) / damagePerHour));
  if (hoursToKo > 72) return '';
  const label = hoursToKo <= 0
    ? 'KO imminent — eat now!'
    : `KO in ~${hoursToKo}h at current pace`;
  return `<div class="hp-forecast">⏳ ${label}</div>`;
}

/* ── 6-hour bonus banner ─────────────────────────── */

function renderBonusBanner(bonus, now) {
  const remainingMs = Math.max(0, bonus.windowEnd - now);
  const remainingTxt = formatBonusRemaining(remainingMs);
  return `
    <div class="bonus-banner">
      <div class="bonus-banner-row">
        <span class="bonus-banner-icon">${bonus.icon}</span>
        <div class="bonus-banner-body">
          <div class="bonus-banner-title">⭐ BONUS ACTIVE</div>
          <div class="bonus-banner-text">${escHtml(bonus.label)} · +25% stat gain</div>
        </div>
        <span class="bonus-banner-countdown" id="bonus-countdown">${remainingTxt}</span>
      </div>
    </div>
  `;
}

function formatBonusRemaining(ms) {
  if (ms <= 0) return '0m left';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

/* ── Macro nutrition card ───────────────────────── */

function renderMacroCard(player, totals) {
  const g = player.goals;
  const sugarMax = g.dailyAddedSugarMaxG ?? 36;

  function row(label, icon, current, goal, color, unit, opts = {}) {
    const goalSet = goal > 0;
    const pct = goalSet ? Math.round((current / goal) * 100) : 0;
    const barPct = goalSet ? Math.min(100, pct) : 0;
    const goalText = goalSet ? `${current} / ${goal}${unit}` : `${current}${unit}`;
    const overFlag = opts.over;
    const rightLabel = goalSet
      ? `${pct}%${overFlag ? ` · over by ${current - goal}${unit}` : ''}`
      : `(goal not set)`;
    const barClass = overFlag ? 'progress-fill-red' : color;
    return `
      <div class="macro-row">
        <div class="macro-row-head">
          <span class="macro-row-label">${icon} ${label}</span>
          <span class="macro-row-text">${goalText}</span>
        </div>
        <div class="progress-track" style="height:6px;">
          <div class="progress-fill ${barClass}" style="width:${barPct}%"></div>
        </div>
        <div class="macro-row-foot">${rightLabel}</div>
      </div>
    `;
  }

  const sugarOver = totals.sugar > sugarMax;
  const waterOz = totals.water || 0;
  const fiberG = totals.fiber || 0;

  const waterChips = `
    <div class="water-chips">
      <button class="water-chip" onclick="quickAddWater(8)">+8 oz</button>
      <button class="water-chip" onclick="quickAddWater(16)">+16 oz</button>
      <button class="water-chip" onclick="quickAddWater(24)">+24 oz</button>
      <button class="water-chip" onclick="promptCustomWater()">Custom…</button>
    </div>
  `;

  return `
    <div class="card macro-card">
      <div class="card-title" style="margin-bottom:10px;">TODAY'S NUTRITION</div>
      ${row('Calories', '🔥', Math.round(totals.calories), g.dailyCalories || 0, 'progress-fill-gold',  '')}
      ${row('Protein',  '🥩', Math.round(totals.protein),  g.dailyProteinG || 0, 'progress-fill-red',   'g')}
      ${row('Fiber',    '🌿', Math.round(fiberG),          g.dailyFiberG   || 0, 'progress-fill-green', 'g')}
      ${row('Water',    '💧', Math.round(waterOz),         g.dailyWaterOz  || 0, 'progress-fill-blue',  'oz')}
      ${waterChips}
      <details class="macro-extra" style="margin-top:10px;">
        <summary style="cursor:pointer;font-size:0.78rem;color:var(--text-muted);">Other macros</summary>
        <div style="margin-top:10px;">
          ${row('Carbs', '🌾', Math.round(totals.carbs), g.dailyCarbsG || 0, 'progress-fill-blue',  'g')}
          ${row('Fats',  '🥑', Math.round(totals.fats),  g.dailyFatsG  || 0, 'progress-fill-purple','g')}
          ${row('Sugar', '🍬', Math.round(totals.sugar), sugarMax,           'progress-fill-green', 'g', { over: sugarOver })}
        </div>
      </details>
    </div>
  `;
}

/* ── Quick-add water helpers ───────────────────── */

function quickAddWater(oz) {
  if (!Number.isFinite(oz) || oz <= 0) return;
  Store.addWaterOz(oz);
  _applyWaterEnergy(oz);
  Router.refresh();
}

function promptCustomWater() {
  const raw = prompt('Add custom amount of water (oz):', '8');
  if (raw === null) return;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 256) {
    Toast.show('Enter 1–256 oz.', 'info');
    return;
  }
  Store.addWaterOz(n);
  _applyWaterEnergy(n);
  Router.refresh();
}

function _applyWaterEnergy(oz) {
  const gain = Engine.computeWaterEnergyHeal(oz);
  if (gain <= 0) return;
  const player = Store.getPlayer();
  Engine.updateEnergyRegen(player);
  const before = player.energy || 0;
  player.energy = Math.min(player.maxEnergy || 35, before + gain);
  const actual = player.energy - before;
  if (actual > 0) {
    Store.setPlayer(player);
    Toast.show(`💧 +${actual} Energy`, 'success');
  }
}

/* ── Weigh-in widget ───────────────────────────── */

function renderWeighInWidget(player) {
  const today = Store.getWeightToday();
  const inWindow = Engine.isWeighInWindow();
  const goal = player.goals.weightTargetLbs;
  const goalLine = goal ? ` · target ${goal} lbs` : '';

  if (today) {
    const t = new Date(today.loggedAt);
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    const wasInWindow = Engine.isWeighInWindow(t);
    return `
      <div class="daily-widget weigh-widget">
        <div class="daily-widget-row">
          <span class="daily-widget-icon">📏</span>
          <div class="daily-widget-main">
            <div class="daily-widget-value">${today.lbs} lbs ${wasInWindow ? '✓' : '<span style="color:var(--accent-red);">(late)</span>'}</div>
            <div class="daily-widget-sub">logged ${hh}:${mm}${goalLine}</div>
          </div>
          <button class="btn btn-secondary btn-sm" style="width:auto;" onclick="promptWeighIn()">Re-log</button>
        </div>
      </div>
    `;
  }

  const windowHint = inWindow
    ? `<span style="color:var(--accent-gold);">✦ Morning window open (4am–12pm) — log now for DIS credit.</span>`
    : `<span style="color:var(--text-muted);">Outside 4am–12pm window — entries chart but won't earn DIS credit today.</span>`;
  return `
    <div class="daily-widget weigh-widget">
      <div class="daily-widget-row">
        <span class="daily-widget-icon">📏</span>
        <div class="daily-widget-main">
          <div class="daily-widget-value">Weigh-in not logged</div>
          <div class="daily-widget-sub">${windowHint}</div>
        </div>
        <button class="btn btn-primary btn-sm" style="width:auto;" onclick="promptWeighIn()">Log</button>
      </div>
    </div>
  `;
}

function promptWeighIn() {
  const existing = Store.getWeightToday();
  const raw = prompt('Weigh-in (lbs):', existing ? String(existing.lbs) : '');
  if (raw === null) return;
  const lbs = parseFloat(raw);
  if (!Number.isFinite(lbs) || lbs <= 50 || lbs >= 500) {
    Toast.show('Enter a weight between 50 and 500 lbs.', 'info');
    return;
  }
  Store.setWeightToday(lbs);
  if (Engine.isWeighInWindow()) {
    Toast.show('Weigh-in saved — DIS credit earned.', 'success');
  } else {
    Toast.show('Weigh-in saved (outside morning window — no DIS credit).', 'info');
  }
  Router.refresh();
}

/* ── Sleep widget ───────────────────────────────── */

function renderSleepWidget() {
  const s = Store.getSleepToday();
  if (s) {
    const stars = '★'.repeat(s.quality) + '☆'.repeat(5 - s.quality);
    return `
      <div class="daily-widget sleep-widget">
        <div class="daily-widget-row">
          <span class="daily-widget-icon">🌙</span>
          <div class="daily-widget-main">
            <div class="daily-widget-value">${s.hours}h ✓</div>
            <div class="daily-widget-sub" style="color:var(--accent-gold);">${stars}</div>
          </div>
          <button class="btn btn-secondary btn-sm" style="width:auto;" onclick="promptSleep()">Re-log</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="daily-widget sleep-widget">
      <div class="daily-widget-row">
        <span class="daily-widget-icon">🌙</span>
        <div class="daily-widget-main">
          <div class="daily-widget-value">Sleep not logged</div>
          <div class="daily-widget-sub" style="color:var(--text-muted);">Log any sleep for DIS credit</div>
        </div>
        <button class="btn btn-primary btn-sm" style="width:auto;" onclick="promptSleep()">Log</button>
      </div>
    </div>
  `;
}

function promptSleep() {
  const existing = Store.getSleepToday();
  const rawHrs = prompt('Hours slept last night (e.g. 7.5):', existing ? String(existing.hours) : '');
  if (rawHrs === null) return;
  const hours = parseFloat(rawHrs);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 16) {
    Toast.show('Enter hours between 0 and 16.', 'info');
    return;
  }
  const rawQ = prompt('Quality 1–5 stars (1=poor, 5=great):', existing ? String(existing.quality) : '3');
  if (rawQ === null) return;
  const quality = parseInt(rawQ, 10);
  if (!Number.isFinite(quality) || quality < 1 || quality > 5) {
    Toast.show('Enter quality between 1 and 5.', 'info');
    return;
  }
  Store.setSleepToday(hours, quality);
  Toast.show('Sleep logged — DIS credit earned.', 'success');
  Router.refresh();
}

/* ── Stat momentum card (today's gain vs decay) ─── */

function renderStatMomentumCard(player, totals, tierInfo) {
  const stats = ['STR', 'AGI', 'VIT'];
  const gains = { STR: totals.accSTR, AGI: totals.accAGI, VIT: totals.accVIT };
  const decay = {};
  for (const s of stats) {
    decay[s] = Engine.STAT_DECAY_PER_DAY[s] * tierInfo.tier.mult;
  }

  // Shared scale so all bars are comparable.
  const maxVal = Math.max(0.1,
    ...Object.values(gains),
    ...Object.values(decay));

  function row(s) {
    const gain = gains[s];
    const dec  = decay[s];
    const net  = gain - dec;
    const gainPct = Math.round((gain / maxVal) * 100);
    const decPct  = Math.round((dec  / maxVal) * 100);
    const netCls  = net > 0.005 ? 'pos' : (net < -0.005 ? 'neg' : 'neu');
    const netSign = net > 0 ? '+' : '';
    return `
      <div class="momentum-row">
        <div class="momentum-row-head">
          <span class="momentum-row-key stat-bar-${s.toLowerCase()}-text">${s}</span>
          <span class="momentum-net-chip momentum-net-${netCls}">net ${netSign}${net.toFixed(2)}</span>
        </div>
        <div class="momentum-row-bars">
          <div class="momentum-bar-half momentum-bar-gain-wrap">
            <div class="momentum-bar-track">
              <div class="momentum-bar-gain stat-bar-${s.toLowerCase()}" style="width:${gainPct}%"></div>
            </div>
            <span class="momentum-bar-text gain">+${gain.toFixed(2)}</span>
          </div>
          <div class="momentum-bar-half momentum-bar-decay-wrap">
            <div class="momentum-bar-track">
              <div class="momentum-bar-decay" style="width:${decPct}%"></div>
            </div>
            <span class="momentum-bar-text decay">-${dec.toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="card momentum-card">
      <div class="card-title" style="margin-bottom:6px;">STAT MOMENTUM (TODAY)</div>
      <div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:10px;">
        Gained from training vs lost to decay at <strong style="color:${tierInfo.tier.color};">${tierInfo.tier.label}</strong> (×${tierInfo.tier.mult.toFixed(2)}).
      </div>
      ${stats.map(row).join('')}
    </div>
  `;
}

function renderQuestSummary(activeQuests, questState, player) {
  const dailyQuests  = questState.active.filter(q => q.type === 'daily');
  const weeklyQuests = questState.active.filter(q => q.type === 'weekly');

  const shown = [...dailyQuests.slice(0, 3), ...weeklyQuests.slice(0, 1)];

  if (shown.length === 0) {
    return `<div class="card"><div class="card-title">TODAY'S QUESTS</div><div class="muted-text mt-8">No active quests.</div></div>`;
  }

  const rows = shown.map(q => {
    const done = !!q.completedAt;
    const pct  = Math.min(100, Math.round((q.progress / q.target.value) * 100));
    return `
      <div class="quest-item ${done ? 'completed' : ''}" style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div class="quest-header">
          <span class="quest-title" style="font-size:0.85rem;">${escHtml(q.title)}</span>
          <span class="quest-status-icon">${done ? '✅' : '○'}</span>
        </div>
        ${!done ? `
          <div class="quest-progress-row">
            <div class="progress-track" style="flex:1;height:6px;">
              <div class="progress-fill progress-fill-gold" style="width:${pct}%"></div>
            </div>
            <span class="quest-progress-text">${q.progress}/${q.target.value}</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">QUESTS</span>
        <button class="btn-ghost btn-sm" style="width:auto;" onclick="Router.navigate('quests')">View all →</button>
      </div>
      ${rows}
    </div>
  `;
}

function renderStreakBar(player) {
  if (!player.streakDays) return '';
  return `
    <div class="streak-display">
      <span class="streak-fire">🔥</span>
      <span class="streak-text">${player.streakDays}-DAY STREAK</span>
    </div>
  `;
}

/* ── Caloric deficit card ─────────────────────── */

function renderDeficitCard(player, totals, todayLog) {
  const tdeeResult = Engine.computeTDEE(player);
  if (!tdeeResult) {
    return `
      <div class="card" style="padding:14px 16px;">
        <div class="card-title" style="margin-bottom:6px;">CALORIC DEFICIT</div>
        <div style="font-size:0.78rem;color:var(--text-muted);">
          Enter body stats in
          <button class="btn-ghost btn-sm" style="display:inline;padding:0 2px;font-size:0.78rem;vertical-align:baseline;" onclick="Router.navigate('settings')">Settings</button>
          to track your caloric deficit.
        </div>
      </div>
    `;
  }

  const { tdee, targetCalories } = tdeeResult;
  const consumed     = Math.round(totals.calories);
  const burned       = Engine.getTodayCaloriesBurned(todayLog);
  const net          = consumed - burned;
  const deficitGoal  = (player.body && player.body.deficitGoal) || 500;
  const deficitAchieved = Math.max(0, tdee - net);
  const pct          = deficitGoal > 0 ? Math.min(100, Math.round((deficitAchieved / deficitGoal) * 100)) : 0;
  const hitGoal      = deficitAchieved >= deficitGoal;
  const barClass     = hitGoal ? 'progress-fill-green' : 'progress-fill-gold';
  const defColor     = hitGoal ? 'var(--accent-green)' : 'var(--accent-gold)';

  return `
    <div class="card" style="padding:14px 16px;">
      <div class="card-title" style="margin-bottom:8px;">CALORIC DEFICIT</div>
      <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;flex-wrap:wrap;gap:4px;">
        <span>TDEE <strong style="color:var(--text-primary);">${tdee}</strong></span>
        <span>Target <strong style="color:var(--text-primary);">${targetCalories}</strong></span>
        <span>Goal −${deficitGoal} kcal/day</span>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:10px;text-align:center;">
        <div style="flex:1;">
          <div style="font-size:0.62rem;color:var(--text-dim);">EATEN</div>
          <div style="font-family:var(--font-display);font-size:0.65rem;color:var(--text-primary);">${consumed}</div>
        </div>
        <div style="align-self:center;color:var(--text-dim);font-size:0.8rem;">−</div>
        <div style="flex:1;">
          <div style="font-size:0.62rem;color:var(--text-dim);">BURNED</div>
          <div style="font-family:var(--font-display);font-size:0.65rem;color:var(--accent-green);">${burned}</div>
        </div>
        <div style="align-self:center;color:var(--text-dim);font-size:0.8rem;">=</div>
        <div style="flex:1;">
          <div style="font-size:0.62rem;color:var(--text-dim);">NET</div>
          <div style="font-family:var(--font-display);font-size:0.65rem;color:var(--text-primary);">${net}</div>
        </div>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">
        Deficit: <strong style="color:${defColor};">${deficitAchieved} / ${deficitGoal} kcal${hitGoal ? ' ✓' : ''}</strong>
      </div>
      <div class="progress-track" style="height:6px;">
        <div class="progress-fill ${barClass}" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

/* ── Caloric deficit history card ────────────── */

function renderDeficitHistoryCard(player) {
  const tdeeResult = Engine.computeTDEE(player);
  if (!tdeeResult) return '';

  const history = Store.getDeficitHistory();
  if (history.length < 2) return '';

  const days = history.slice(0, 14).reverse(); // oldest → newest
  const deficitGoal = (player.body && player.body.deficitGoal) || 500;
  const maxVal = Math.max(deficitGoal * 1.5, ...days.map(d => d.deficit || 0), 1);

  const BAR_W  = 14;
  const BAR_GAP = 3;
  const CHART_H = 60;
  const LABEL_H = 16;
  const totalW  = days.length * (BAR_W + BAR_GAP) - BAR_GAP;

  const goalY = Math.round(CHART_H - (deficitGoal / maxVal) * CHART_H);

  const bars = days.map((d, i) => {
    const pct    = Math.min(1, (d.deficit || 0) / maxVal);
    const barH   = Math.max(2, Math.round(pct * CHART_H));
    const x      = i * (BAR_W + BAR_GAP);
    const y      = CHART_H - barH;
    const color  = d.hitGoal ? 'var(--accent-green)' : 'var(--accent-gold)';
    const dayAbbr = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
    return `
      <rect x="${x}" y="${y}" width="${BAR_W}" height="${barH}" fill="${color}" rx="2"/>
      <text x="${x + BAR_W / 2}" y="${CHART_H + LABEL_H - 2}" text-anchor="middle" font-size="8" fill="var(--text-dim)">${dayAbbr}</text>
    `;
  }).join('');

  const hitCount = days.filter(d => d.hitGoal).length;

  return `
    <div class="card" style="padding:14px 16px;">
      <div class="card-title" style="margin-bottom:4px;">DEFICIT HISTORY</div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;">
        Last ${days.length} days &nbsp;·&nbsp; Goal met <strong style="color:var(--accent-green);">${hitCount}/${days.length}</strong> days
      </div>
      <svg width="100%" viewBox="0 0 ${totalW} ${CHART_H + LABEL_H}" preserveAspectRatio="xMidYMid meet" style="overflow:visible;">
        <!-- goal line -->
        <line x1="0" y1="${goalY}" x2="${totalW}" y2="${goalY}"
          stroke="var(--accent-gold)" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>
        ${bars}
      </svg>
      <div style="font-size:0.68rem;color:var(--text-dim);margin-top:6px;display:flex;gap:10px;">
        <span><span style="display:inline-block;width:8px;height:8px;background:var(--accent-green);border-radius:2px;"></span> Goal met</span>
        <span><span style="display:inline-block;width:8px;height:8px;background:var(--accent-gold);border-radius:2px;"></span> Below goal</span>
        <span style="margin-left:auto;">Goal: −${deficitGoal} kcal/day</span>
      </div>
    </div>
  `;
}

/* ── Weekly muscle coverage card ─────────────── */

function renderMuscleCoverageCard(player, allLogs, weekStart) {
  const weekLogs = allLogs.filter(e => e.date >= weekStart);
  const daySets = { push: new Set(), pull: new Set(), legs: new Set(), core: new Set(), stretch: new Set() };

  for (const entry of weekLogs) {
    for (const ex of (entry.exercises || [])) {
      if (ex.muscleGroup && daySets[ex.muscleGroup]) {
        daySets[ex.muscleGroup].add(entry.date);
      }
    }
    for (const act of (entry.activities || [])) {
      if (act.isStretch) daySets.stretch.add(entry.date);
    }
  }

  const sessions = {
    push:    daySets.push.size,
    pull:    daySets.pull.size,
    legs:    daySets.legs.size,
    core:    daySets.core.size,
    stretch: daySets.stretch.size,
  };

  const targets = (player.goals && player.goals.weeklyMuscleTargets) || { push: 2, pull: 2, legs: 2, core: 2 };
  const stretchTarget = (player.goals && player.goals.weeklyStretchTarget != null) ? player.goals.weeklyStretchTarget : 2;

  function groupRow(label, key, target) {
    const done = sessions[key] || 0;
    const pct  = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : (done > 0 ? 100 : 0);
    const hit  = target > 0 && done >= target;
    const barClass = hit ? 'progress-fill-green' : 'progress-fill-gold';
    const valColor = hit ? 'var(--accent-green)' : 'var(--text-primary)';
    const targetTxt = target > 0 ? target : '—';
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:0.74rem;color:var(--text-muted);flex:0 0 62px;">${label}</span>
        <div class="progress-track" style="flex:1;height:6px;">
          <div class="progress-fill ${barClass}" style="width:${pct}%"></div>
        </div>
        <span style="font-size:0.72rem;font-family:var(--font-display);color:${valColor};flex:0 0 44px;text-align:right;">
          ${done}/${targetTxt}${hit ? ' ✓' : ''}
        </span>
      </div>
    `;
  }

  return `
    <div class="card" style="padding:14px 16px;">
      <div class="card-title" style="margin-bottom:8px;">MUSCLE COVERAGE (THIS WEEK)</div>
      ${groupRow('Push', 'push', targets.push)}
      ${groupRow('Pull', 'pull', targets.pull)}
      ${groupRow('Legs', 'legs', targets.legs)}
      ${groupRow('Core', 'core', targets.core)}
      ${groupRow('Stretch', 'stretch', stretchTarget)}
    </div>
  `;
}

function capitalizeType(t) {
  const map = { cardio: 'Cardio', bodyweight: 'Bodyweight', sports: 'Sports',
                diet: 'Diet', weighted: 'Weighted', misc: 'Any' };
  return map[t] || t;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

Router.register('dashboard', renderDashboard);
