/* ─────────────────────────────────────────────
   History screen — log entries + cycle log + charts
   ───────────────────────────────────────────── */

function renderHistory(container) {
  const log          = Store.getLog();
  const cycleHistory = Store.getCycleHistory();
  const statHistory  = Store.getStatHistory();

  container.innerHTML = `
    <div class="screen-title">HISTORY</div>
    ${renderCharts(cycleHistory, statHistory, log)}
    ${renderCycleLog(cycleHistory)}
    ${renderLogEntries(log)}
  `;
}

/* ── SVG line charts (hand-rolled, no library) ─ */

function renderCharts(cycleHistory, statHistory, log) {
  if (cycleHistory.length === 0 && statHistory.length < 2) {
    return `
      <div class="card mb-12">
        <div class="card-title">PROGRESS CHARTS</div>
        <div class="muted-text mt-8">Charts unlock after your first completed cycle, or after a few days of logging.</div>
      </div>
    `;
  }

  const peakSeries = cycleHistory
    .map(c => ({ x: c.cycleEnd, y: c.peakLevel, label: `Lv${c.peakLevel}` }))
    .reverse();

  // Stat sum over time (oldest first)
  const statSeries = statHistory
    .slice()
    .reverse()
    .map(s => ({ x: s.date, y: s.sum, label: '' }));

  return `
    <div class="card mb-12">
      <div class="card-title">PROGRESS CHARTS</div>
      ${peakSeries.length > 0 ? `
        <div class="chart-block">
          <div class="chart-title">Peak level per cycle</div>
          ${svgLineChart(peakSeries, '#ffd700', 'Lv')}
        </div>` : ''}
      ${statSeries.length >= 2 ? `
        <div class="chart-block">
          <div class="chart-title">Stat sum over time</div>
          ${svgLineChart(statSeries, '#4cc9f0', '')}
        </div>` : ''}
    </div>
  `;
}

function svgLineChart(series, color, yPrefix) {
  if (series.length === 0) return '';
  const W = 320, H = 100, PAD = 14;
  const ys = series.map(p => p.y);
  const yMax = Math.max(...ys, 1);
  const yMin = Math.min(...ys, 0);
  const yRange = Math.max(1, yMax - yMin);
  const n = series.length;
  const xStep = (W - 2 * PAD) / Math.max(1, n - 1);

  const points = series.map((p, i) => {
    const x = PAD + i * xStep;
    const y = H - PAD - ((p.y - yMin) / yRange) * (H - 2 * PAD);
    return [x, y];
  });

  const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = path + ` L${points[points.length-1][0].toFixed(1)},${H - PAD} L${points[0][0].toFixed(1)},${H - PAD} Z`;
  const lastVal  = ys[ys.length - 1];
  const firstVal = ys[0];

  const dots = points.map((p, i) =>
    `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="${color}" />`
  ).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" class="history-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="grad-${color.replace('#','')}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stop-color="${color}" stop-opacity="0.35" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#grad-${color.replace('#','')})" />
      <path d="${path}" stroke="${color}" stroke-width="1.8" fill="none" />
      ${dots}
    </svg>
    <div class="chart-meta">
      <span>start: ${yPrefix}${firstVal}</span>
      <span>now: ${yPrefix}${lastVal}</span>
      <span>peak: ${yPrefix}${yMax}</span>
    </div>
  `;
}

/* ── Cycle log ──────────────────────────────── */

function renderCycleLog(cycleHistory) {
  if (cycleHistory.length === 0) {
    return `
      <div class="card mb-12">
        <div class="card-title">CYCLE LOG</div>
        <div class="muted-text mt-8">Each 2-week cycle records its peak level here. Your current cycle is still in progress.</div>
      </div>
    `;
  }
  const rows = cycleHistory.map((c, i) => `
    <div class="cycle-log-row">
      <div class="cycle-log-dates">
        <span class="cycle-log-num">#${cycleHistory.length - i}</span>
        <span>${escHtml(c.cycleStart)} → ${escHtml(c.cycleEnd)}</span>
      </div>
      <div class="cycle-log-stats">
        <span class="cycle-log-peak">Peak Lv${c.peakLevel}</span>
        <span class="cycle-log-active">${c.daysActive}/14 active</span>
        ${c.decayHits > 0 ? `<span class="cycle-log-decay">${c.decayHits} decay${c.decayHits === 1 ? '' : 's'}</span>` : ''}
      </div>
    </div>
  `).join('');
  return `
    <div class="card mb-12">
      <div class="card-title">CYCLE LOG (${cycleHistory.length})</div>
      ${rows}
    </div>
  `;
}

/* ── Log entries ────────────────────────────── */

function renderLogEntries(log) {
  if (log.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">No log entries yet.<br>Start by logging a workout!</div>
      </div>
    `;
  }

  const entries = log.map(entry => {
    const acts  = (entry.activities || []).map(a => a.name).join(', ');
    const exs   = (entry.exercises  || []).map(e => e.name).join(', ');
    const meals = (entry.meals      || []).map(m => m.name || m.mealType).join(', ');
    const tags  = [
      acts  ? `🏃 ${acts}`  : '',
      exs   ? `💪 ${exs}`   : '',
      meals ? `🍽️ ${meals}` : '',
    ].filter(Boolean);

    const statGains = Object.entries(entry.statsGained || {})
      .map(([s, v]) => `${s}+${v}`).join(' ');

    const detailActs = (entry.activities || []).map(a =>
      `${a.icon || '⚡'} ${escHtml(a.name)} — ${a.durationMinutes}min (~${a.estimatedCalories}cal)`
    ).join('<br>');

    const detailExs = (entry.exercises || []).map(e =>
      `${e.icon || '💪'} ${escHtml(e.name)} — ${e.sets}×${e.reps} (${e.totalReps} reps)`
    ).join('<br>');

    const detailMeals = (entry.meals || []).map(m => {
      const macros = [];
      if (m.proteinG) macros.push(`${m.proteinG}p`);
      if (m.carbsG)   macros.push(`${m.carbsG}c`);
      if (m.fatsG)    macros.push(`${m.fatsG}f`);
      const macroStr = macros.length ? ` (${macros.join(' / ')})` : '';
      return `🍽️ ${escHtml(m.name || m.mealType)} — ${m.calories}kcal${macroStr}`;
    }).join('<br>');

    const routineTag = entry.routineId
      ? `<span class="badge badge-gold">📋 ${escHtml(Routines.getRoutine(entry.routineId)?.name || 'Routine')}</span>`
      : '';

    return `
      <div class="history-entry" id="hist-${entry.id}" onclick="toggleHistoryEntry('${entry.id}')">
        <div class="history-entry-header">
          <span class="history-date">${escHtml(entry.date)}</span>
          <span class="history-xp">+${entry.xpEarned || 0} XP</span>
        </div>
        <div class="history-tags">
          ${routineTag}
          ${tags.map(t => `<span class="badge badge-gray">${escHtml(t)}</span>`).join('')}
          ${entry.damageDealt > 0 ? `<span class="badge badge-red">-${entry.damageDealt}❤️</span>` : ''}
          ${statGains ? `<span class="badge badge-green">${escHtml(statGains)}</span>` : ''}
        </div>
        <div class="history-detail">
          ${detailActs  ? `<div style="margin-bottom:6px;">${detailActs}</div>`  : ''}
          ${detailExs   ? `<div style="margin-bottom:6px;">${detailExs}</div>`   : ''}
          ${detailMeals ? `<div>${detailMeals}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="card-title">LOG ENTRIES (${log.length})</div>
    ${entries}
  `;
}

function toggleHistoryEntry(id) {
  const el = document.getElementById('hist-' + id);
  if (el) el.classList.toggle('expanded');
}

Router.register('history', renderHistory);
