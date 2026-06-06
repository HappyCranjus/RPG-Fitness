/* ─────────────────────────────────────────────
   Dashboard screen
   ───────────────────────────────────────────── */

function renderDashboard(container) {
  const player   = Store.getPlayer();
  const monsters = Store.getMonsters();
  const today    = Store.today();
  const weekStart = Store.weekStart();
  const rank     = Ranks.getRank(player);
  const daysLeft = Engine.daysUntilCycleEnd(player, today);
  const schedule = Store.getSchedule();
  const todayRoutineId = schedule[Store.weekdayKey()];
  const todayRoutine   = todayRoutineId ? Routines.getRoutine(todayRoutineId) : null;
  const decayStatus    = Engine.statDecayStatus(player, today);
  const decayWarnings  = Object.entries(decayStatus).filter(([, s]) => s.isDecaying || s.decayingIn === 0);

  // Refresh quests for today
  const questState = Quests.refresh(today, weekStart);
  const activeQuests = questState.active.filter(q => !q.completedAt && q.type !== 'milestone');

  const xpPct = Math.min(100, Math.round((player.xp / player.xpToNextLevel) * 100));
  const monster = monsters.active;

  const energy    = Math.floor(player.energy ?? player.maxEnergy ?? 35);
  const maxEnergy = player.maxEnergy ?? (30 + player.stats.AGI * 5);
  const energyPct = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));
  const regenRate = (3 + player.stats.AGI * 0.5).toFixed(1);

  container.innerHTML = `
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

    ${decayWarnings.length > 0 ? `
    <div class="decay-warning-card">
      <div class="decay-warning-header">⚠️ STAT DECAY ${decayWarnings.some(([,s]) => s.isDecaying) ? 'IN PROGRESS' : 'IMMINENT'}</div>
      <div class="decay-warning-text">
        ${decayWarnings.map(([stat, s]) =>
          s.isDecaying
            ? `<strong>${stat}</strong> decaying (idle ${s.idle}d)`
            : `<strong>${stat}</strong> decays tomorrow`
        ).join(' · ')}
      </div>
      <div class="decay-warning-hint">Log a relevant activity to reset the timer.</div>
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

    <!-- Energy bar -->
    <div class="card" style="padding:10px 16px 10px;cursor:pointer;" onclick="Router.navigate('combat')">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
        <span style="font-size:0.72rem;color:var(--text-muted);">⚡ ENERGY (tap to attack)</span>
        <span style="font-family:var(--font-display);font-size:0.42rem;color:var(--accent-blue);">${energy} / ${maxEnergy}</span>
      </div>
      <div class="progress-track" style="height:6px;">
        <div class="progress-fill energy-fill" style="width:${energyPct}%"></div>
      </div>
      <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">Regens ${regenRate}/hr</div>
    </div>

    ${monster ? renderMonsterCard(monster) : renderNoMonster()}

    ${renderQuestSummary(activeQuests, questState, player)}

    ${renderStreakBar(player)}

    <button class="btn btn-primary mt-16" onclick="Router.navigate('log')">
      ⚔️ LOG WORKOUT / MEAL
    </button>

    <div class="tap-hint mt-8">Gold: ${player.gold} 🪙</div>
  `;
}

function renderMonsterCard(monster) {
  const hpPct = Math.max(0, Math.round((monster.hpCurrent / monster.hpMax) * 100));
  const weakStr = (monster.weaknesses || []).map(capitalizeType).join(', ') || '—';
  const resStr  = (monster.resistances || []).map(capitalizeType).join(', ') || '—';

  return `
    <div class="monster-card card-tapable" onclick="Router.navigate('combat')">
      <div class="card-title" style="margin-bottom:10px;">ACTIVE MONSTER</div>
      <div class="monster-header">
        <span class="monster-art">${escHtml(monster.art)}</span>
        <div class="monster-info">
          <div class="monster-name">${escHtml(monster.name)}</div>
          <div class="monster-tier">Tier ${Monsters.tierLabel(monster.tier)}</div>
        </div>
        <span style="color:var(--text-muted);font-size:0.8rem;">tap →</span>
      </div>
      <div class="monster-hp-label">
        <span>HP</span>
        <span class="monster-hp-value">${monster.hpCurrent} / ${monster.hpMax}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill progress-fill-red" style="width:${hpPct}%"></div>
      </div>
      <div class="monster-tags mt-8">
        <span class="tag tag-weak">Weak: ${weakStr}</span>
        ${resStr !== '—' ? `<span class="tag tag-res">Res: ${resStr}</span>` : ''}
      </div>
    </div>
  `;
}

function renderNoMonster() {
  return `
    <div class="card">
      <div class="card-title">ACTIVE MONSTER</div>
      <div class="muted-text mt-8">No monster active. Log a workout to spawn one!</div>
    </div>
  `;
}

function renderQuestSummary(activeQuests, questState, player) {
  const today = Store.today();
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
