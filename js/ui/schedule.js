/* ─────────────────────────────────────────────
   Weekly schedule — assign routines to days
   ───────────────────────────────────────────── */

const SCHEDULE_DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

function renderSchedule(container) {
  const schedule = Store.getSchedule();
  const grouped  = Routines.grouped();
  const todayKey = Store.weekdayKey();

  const buildOptions = (selected) => {
    let html = `<option value="">— Rest day —</option>`;
    for (const rank of ['E','D','C','B','A','S']) {
      const list = grouped[rank];
      if (!list || list.length === 0) continue;
      html += `<optgroup label="${rank} Rank">`;
      for (const r of list) {
        const sel = (selected === r.id) ? 'selected' : '';
        html += `<option value="${r.id}" ${sel}>${escHtml(r.name)}</option>`;
      }
      html += `</optgroup>`;
    }
    return html;
  };

  const rows = SCHEDULE_DAYS.map(d => {
    const isToday  = d.key === todayKey;
    const routine  = schedule[d.key] ? Routines.getRoutine(schedule[d.key]) : null;
    const summary  = routine
      ? `<span style="font-size:0.78rem;color:var(--text-muted);">${routine.rank} • ${escHtml(routine.focus)}</span>`
      : `<span style="font-size:0.78rem;color:var(--text-dim);">No routine</span>`;
    return `
      <div class="schedule-row ${isToday ? 'is-today' : ''}">
        <div class="schedule-day">
          <span class="schedule-day-label">${d.label}</span>
          ${isToday ? `<span class="schedule-today-tag">TODAY</span>` : ''}
        </div>
        <div class="schedule-picker">
          <select class="schedule-select" data-day="${d.key}">
            ${buildOptions(schedule[d.key])}
          </select>
          ${summary}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="screen-title">WEEKLY SCHEDULE</div>
    <div class="muted-text mb-12" style="line-height:1.5;">
      Plan routines for each day of the week. On scheduled days, the dashboard surfaces a one-tap start card.
    </div>
    <div class="card">
      ${rows}
    </div>
    <button class="btn btn-secondary mt-16" onclick="clearSchedule()">Clear schedule</button>
  `;

  container.querySelectorAll('.schedule-select').forEach(sel => {
    sel.onchange = (e) => {
      const day = e.target.dataset.day;
      const sched = Store.getSchedule();
      sched[day] = e.target.value || null;
      Store.setSchedule(sched);
      renderSchedule(container);
      Toast.show('Schedule updated', 'success');
    };
  });
}

function clearSchedule() {
  Store.setSchedule({ mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null });
  Router.refresh();
  Toast.show('Schedule cleared', 'info');
}

Router.register('schedule', renderSchedule);
