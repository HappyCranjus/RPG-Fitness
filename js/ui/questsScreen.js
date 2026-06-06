/* ─────────────────────────────────────────────
   Quests screen
   ───────────────────────────────────────────── */

function renderQuestsScreen(container) {
  const today     = Store.today();
  const weekStart = Store.weekStart();
  const state     = Quests.refresh(today, weekStart);
  const player    = Store.getPlayer();

  const daily     = state.active.filter(q => q.type === 'daily');
  const weekly    = state.active.filter(q => q.type === 'weekly');
  const milestone = state.active.filter(q => q.type === 'milestone');
  const completed = state.completed.slice(0, 10);

  // Daily reset countdown
  const now   = new Date();
  const midnight = new Date(now); midnight.setHours(24,0,0,0);
  const secsLeft = Math.floor((midnight - now) / 1000);
  const h = Math.floor(secsLeft / 3600);
  const m = Math.floor((secsLeft % 3600) / 60);
  const resetIn = `${h}h ${m}m`;

  container.innerHTML = `
    <div class="screen-title">QUEST BOARD</div>

    <!-- Daily quests -->
    <div class="collapsible-section">
      <div class="collapsible-header open" id="daily-header">
        <span class="collapsible-title">Daily Quests</span>
        <span style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:0.68rem;color:var(--text-muted);">resets in ${resetIn}</span>
          <span class="collapsible-chevron">▼</span>
        </span>
      </div>
      <div class="collapsible-body" id="daily-body">
        ${renderQuestList(daily, player)}
      </div>
    </div>

    <div class="divider"></div>

    <!-- Weekly quests -->
    <div class="collapsible-section">
      <div class="collapsible-header open" id="weekly-header">
        <span class="collapsible-title">Weekly Quests</span>
        <span class="collapsible-chevron">▼</span>
      </div>
      <div class="collapsible-body" id="weekly-body">
        ${renderQuestList(weekly, player)}
      </div>
    </div>

    <div class="divider"></div>

    <!-- Milestone quests -->
    <div class="collapsible-section">
      <div class="collapsible-header open" id="milestone-header">
        <span class="collapsible-title">Milestones</span>
        <span class="collapsible-chevron">▼</span>
      </div>
      <div class="collapsible-body" id="milestone-body">
        ${renderQuestList(milestone, player)}
      </div>
    </div>

    ${completed.length > 0 ? `
    <div class="divider"></div>
    <div class="collapsible-section">
      <div class="collapsible-header" id="completed-header">
        <span class="collapsible-title" style="color:var(--text-muted);">Recently Completed</span>
        <span class="collapsible-chevron">▼</span>
      </div>
      <div class="collapsible-body closed" id="completed-body">
        ${renderCompletedList(completed)}
      </div>
    </div>
    ` : ''}
  `;

  // Wire up collapsibles
  ['daily','weekly','milestone','completed'].forEach(id => {
    const hdr = document.getElementById(id + '-header');
    const bdy = document.getElementById(id + '-body');
    if (hdr && bdy) {
      hdr.onclick = () => {
        hdr.classList.toggle('open');
        bdy.classList.toggle('closed');
      };
    }
  });
}

function renderQuestList(quests, player) {
  if (quests.length === 0) {
    return `<div class="muted-text" style="padding:12px 0;">No quests in this category.</div>`;
  }

  return quests.map(q => {
    const done = !!q.completedAt;
    const pct  = Math.min(100, Math.round((q.progress / q.target.value) * 100));
    const rewardStr = `+${q.reward.xp} XP, ${q.reward.gold} 🪙`;

    return `
      <div class="quest-item ${done ? 'completed' : ''}">
        <div class="quest-header">
          <span class="quest-title">${escHtml(q.title)}</span>
          <span class="quest-status-icon">${done ? '✅' : '◯'}</span>
        </div>
        <div class="quest-desc">${escHtml(q.description)}</div>
        ${!done ? `
          <div class="quest-progress-row">
            <div class="progress-track" style="flex:1;">
              <div class="progress-fill progress-fill-gold" style="width:${pct}%"></div>
            </div>
            <span class="quest-progress-text">${q.progress} / ${q.target.value}</span>
          </div>
        ` : ''}
        <div class="quest-reward">${rewardStr}</div>
      </div>
    `;
  }).join('');
}

function renderCompletedList(completed) {
  return completed.map(c => `
    <div class="quest-item completed">
      <div class="quest-header">
        <span class="quest-title" style="color:var(--text-muted);">${escHtml(c.title)}</span>
        <span class="quest-status-icon">✅</span>
      </div>
      <div class="quest-desc" style="font-size:0.72rem;">${c.date}</div>
    </div>
  `).join('');
}

Router.register('quests', renderQuestsScreen);
