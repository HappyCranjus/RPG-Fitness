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
  const todayLog       = Store.getLog().filter(e => e.date === today);
  const tierInfo       = Engine.disciplineTier(player, todayLog);
  const totals         = Engine.dailyTotals(todayLog);
  const bonus    = Engine.getActiveBonus(Date.now());
  const heroHtml = renderStatsHero(player, today);
  const macroHtml = renderMacroCard(player, totals);
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
    ${momentumHtml}
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
  const sugarMax = player.goals.dailyAddedSugarMaxG ?? 36;
  const dots = ['showUp', 'protein', 'calories', 'sugar']
    .map(k => `<span class="tier-dot ${tierInfo.credits[k] ? 'on' : 'off'}"></span>`).join('');
  return `
    <div class="tier-banner" style="border-color:${tierInfo.tier.color};color:${tierInfo.tier.color};" onclick="Router.navigate('character')">
      <div class="tier-banner-row">
        <span class="tier-banner-label">DISCIPLINE</span>
        <span class="tier-banner-tier">${tierInfo.tier.label.toUpperCase()}</span>
        <span class="tier-banner-mult">decay × ${tierInfo.tier.mult.toFixed(2)}</span>
      </div>
      <div class="tier-banner-row tier-banner-credits">
        ${dots}
        <span class="tier-banner-credits-text">${tierInfo.points}/4 today — sugar ${tierInfo.totals.sugar}/${sugarMax}g</span>
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

  const noMeals = totals.calories === 0 && totals.protein === 0
                && totals.carbs === 0 && totals.fats === 0 && totals.sugar === 0;

  if (noMeals) {
    return `
      <div class="card macro-card">
        <div class="card-title" style="margin-bottom:6px;">TODAY'S NUTRITION</div>
        <div class="muted-text" style="font-size:0.8rem;">No meals logged yet today — tap LOG below.</div>
      </div>
    `;
  }

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

  return `
    <div class="card macro-card">
      <div class="card-title" style="margin-bottom:10px;">TODAY'S NUTRITION</div>
      ${row('Calories', '🔥', totals.calories, g.dailyCalories || 0, 'progress-fill-gold', '')}
      ${row('Protein',  '🥩', totals.protein,  g.dailyProteinG || 0, 'progress-fill-red',  'g')}
      ${row('Carbs',    '🌾', totals.carbs,    g.dailyCarbsG  || 0, 'progress-fill-blue', 'g')}
      ${row('Fats',     '🥑', totals.fats,     g.dailyFatsG   || 0, 'progress-fill-purple','g')}
      ${row('Sugar',    '🍬', totals.sugar,    sugarMax,            'progress-fill-green','g', { over: sugarOver })}
    </div>
  `;
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

function capitalizeType(t) {
  const map = { cardio: 'Cardio', bodyweight: 'Bodyweight', sports: 'Sports',
                diet: 'Diet', weighted: 'Weighted', misc: 'Any' };
  return map[t] || t;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

Router.register('dashboard', renderDashboard);
