/* ─────────────────────────────────────────────
   Log Entry screen — Activities, Exercises, Meals
   + live battle preview
   ───────────────────────────────────────────── */

const ACTIVITY_DEFS = [
  { id: 'act_jog',     name: 'Jogging / Running', icon: '🏃', calPerMin: 10, type: 'cardio' },
  { id: 'act_swim',    name: 'Swimming',           icon: '🏊', calPerMin: 9,  type: 'cardio' },
  { id: 'act_bball',   name: 'Basketball / Sports',icon: '🏀', calPerMin: 8,  type: 'sports' },
  { id: 'act_walkdog', name: 'Walking the Dog',    icon: '🐕', calPerMin: 4,  type: 'cardio' },
  { id: 'act_custom',  name: 'Custom Activity',    icon: '⚡', calPerMin: 6,  type: 'misc' },
];

const EXERCISE_DEFS = [
  { id: 'ex_pushup',   name: 'Push-ups',           icon: '💪', type: 'bodyweight' },
  { id: 'ex_situp',    name: 'Sit-ups / Crunches', icon: '🔥', type: 'bodyweight' },
  { id: 'ex_pullup',   name: 'Pull-ups / Chin-ups',icon: '🏋️', type: 'bodyweight' },
  { id: 'ex_squat',    name: 'Squats',             icon: '🦵', type: 'bodyweight' },
  { id: 'ex_idl',      name: 'Inverted Leg Raises',icon: '🦵', type: 'bodyweight' },
  { id: 'ex_dumbbell', name: 'Dumbbell Exercise',  icon: '🏋️', type: 'weighted' },
  { id: 'ex_custom',   name: 'Custom Exercise',    icon: '⚡', type: 'bodyweight' },
];

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

// In-memory log form state
let logState = {
  activities: [],
  exercises: [],
  meals: [],
  routineId: null,
};

function renderLog(container) {
  logState = { activities: [], exercises: [], meals: [], routineId: null };
  const monster = Store.getMonsters().active;

  // Auto-apply routine from URL hash query (e.g. #log?routine=rt_c_5k)
  const preselectRoutine = (() => {
    const m = window.location.hash.match(/[?&]routine=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  })();

  container.innerHTML = `
    <div class="screen-title">LOG ENTRY</div>

    <!-- Routine picker -->
    <div class="card mb-12" style="padding:12px 14px;">
      <div class="section-label" style="margin-bottom:6px;">Quick start from a routine (optional)</div>
      <select id="log-routine-picker" style="width:100%;">
        <option value="">— Custom log —</option>
        ${buildRoutineOptions(preselectRoutine)}
      </select>
      <div id="log-routine-flavor" style="font-size:0.78rem;color:var(--text-muted);margin-top:6px;display:none;"></div>
    </div>

    <!-- Activities -->
    <div class="section" id="log-activities-section">
      <div class="section-label">Activities (duration-based)</div>
      <div id="log-activities-list"></div>
      <div class="add-entry-row" id="add-activity-btn">
        <span>+</span> Add Activity
      </div>
    </div>

    <!-- Exercises -->
    <div class="section" id="log-exercises-section">
      <div class="section-label">Exercises (reps-based)</div>
      <div id="log-exercises-list"></div>
      <div class="add-entry-row" id="add-exercise-btn">
        <span>+</span> Add Exercise
      </div>
    </div>

    <!-- Meals -->
    <div class="section" id="log-meals-section">
      <div class="section-label">Meals</div>
      <div id="log-meals-list"></div>
      <div class="add-entry-row" id="add-meal-btn">
        <span>+</span> Add Meal
      </div>
    </div>

    <!-- Session preview -->
    <div class="battle-preview" id="battle-preview">
      <div class="battle-preview-title">📋 SESSION PREVIEW</div>
      <div id="preview-items"></div>
      <div id="preview-attack-bonus"></div>
      <div class="preview-divider"></div>
      <div class="preview-totals">
        <div class="preview-total-item">
          <span class="preview-total-label">XP</span>
          <span class="preview-total-value xp" id="preview-total-xp">+0</span>
        </div>
        <div class="preview-total-item">
          <span class="preview-total-label">HP</span>
          <span class="preview-total-value" id="preview-total-hp" style="color:var(--text-muted);">+0</span>
        </div>
        <div class="preview-total-item">
          <span class="preview-total-label">CAL</span>
          <span class="preview-total-value cal" id="preview-total-cal">~0</span>
        </div>
      </div>
    </div>

    <button class="btn btn-primary mt-16" id="save-log-btn">SAVE LOG ENTRY</button>
    <div style="height:16px;"></div>
  `;

  // Bind events
  document.getElementById('add-activity-btn').onclick = () => {
    logState.activities.push({ activityId: 'act_jog', name: 'Jogging / Running', durationMinutes: 30, type: 'cardio', estimatedCalories: 300 });
    renderActivityRow(logState.activities.length - 1);
    updatePreview();
  };

  document.getElementById('add-exercise-btn').onclick = () => {
    logState.exercises.push({ exerciseId: 'ex_pushup', name: 'Push-ups', sets: 3, reps: 10, totalReps: 30, type: 'bodyweight' });
    renderExerciseRow(logState.exercises.length - 1);
    updatePreview();
  };

  document.getElementById('add-meal-btn').onclick = () => {
    logState.meals.push({ name: '', calories: 0, proteinG: 0, carbsG: 0, fatsG: 0, mealType: 'lunch' });
    renderMealRow(logState.meals.length - 1);
    updatePreview();
  };

  document.getElementById('save-log-btn').onclick = saveLog;

  document.getElementById('log-routine-picker').onchange = (e) => {
    applyRoutine(e.target.value);
  };

  if (preselectRoutine) {
    applyRoutine(preselectRoutine);
  }
}

function buildRoutineOptions(selected) {
  const grouped = Routines.grouped();
  let html = '';
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
}

function applyRoutine(routineId) {
  if (!routineId) {
    logState.routineId = null;
    logState.activities = [];
    logState.exercises  = [];
    document.getElementById('log-routine-flavor').style.display = 'none';
    rerenderActivityList();
    document.getElementById('log-exercises-list').innerHTML = '';
    logState.exercises.forEach((_, i) => renderExerciseRow(i));
    updatePreview();
    return;
  }
  const r = Routines.getRoutine(routineId);
  if (!r) return;
  logState.routineId  = routineId;
  logState.activities = [];
  logState.exercises  = [];
  for (const item of r.items) {
    if (item.kind === 'activity') {
      const def = ACTIVITY_DEFS.find(d => d.id === item.id) || ACTIVITY_DEFS[0];
      const mins = item.target.minutes || 20;
      logState.activities.push({
        activityId: def.id, name: def.name, type: def.type,
        durationMinutes: mins, estimatedCalories: Math.round(def.calPerMin * mins),
      });
    } else if (item.kind === 'exercise') {
      const def  = EXERCISE_DEFS.find(d => d.id === item.id) || EXERCISE_DEFS[0];
      const sets = item.target.sets || 3;
      const reps = item.target.reps || 10;
      logState.exercises.push({
        exerciseId: def.id, name: def.name, type: def.type,
        sets, reps, totalReps: sets * reps,
      });
    }
  }
  // Rebuild both lists
  rerenderActivityList();
  const exListEl = document.getElementById('log-exercises-list');
  if (exListEl) exListEl.innerHTML = '';
  logState.exercises.forEach((_, i) => renderExerciseRow(i));

  const flavorEl = document.getElementById('log-routine-flavor');
  if (flavorEl) {
    flavorEl.textContent = `${r.rank} Rank · ${r.focus} — ${r.flavor}`;
    flavorEl.style.display = 'block';
  }
  const picker = document.getElementById('log-routine-picker');
  if (picker && picker.value !== routineId) picker.value = routineId;
  updatePreview();
}

/* ── Activity row rendering ──────────────────── */

function renderActivityRow(idx) {
  const entry = logState.activities[idx];
  const listEl = document.getElementById('log-activities-list');

  let el = document.getElementById('activity-row-' + idx);
  if (!el) {
    el = document.createElement('div');
    el.id = 'activity-row-' + idx;
    el.className = 'card mb-8';
    listEl.appendChild(el);
  }

  const opts = ACTIVITY_DEFS.map(d =>
    `<option value="${d.id}" ${d.id === entry.activityId ? 'selected' : ''}>${escHtml(d.icon + ' ' + d.name)}</option>`
  ).join('');

  el.innerHTML = `
    <div class="form-row" style="align-items:start;">
      <div class="form-group" style="margin:0;">
        <label class="form-label">Activity</label>
        <select id="act-type-${idx}">${opts}</select>
        ${entry.activityId === 'act_custom' ? `<input id="act-custom-name-${idx}" placeholder="Name" value="${escHtml(entry.customName||'')}" style="margin-top:6px;">` : ''}
      </div>
      <div style="display:flex;align-items:flex-end;gap:6px;">
        <div class="form-group" style="margin:0;flex:1;">
          <label class="form-label">Minutes</label>
          <input type="number" id="act-dur-${idx}" value="${entry.durationMinutes}" min="1" max="480" style="text-align:center;">
        </div>
        <button class="item-delete" style="margin-bottom:0;" onclick="deleteActivity(${idx})">✕</button>
      </div>
    </div>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;">Est. ${entry.estimatedCalories} cal</div>
  `;

  // Bind change events
  document.getElementById('act-type-' + idx).onchange = e => {
    const def = ACTIVITY_DEFS.find(d => d.id === e.target.value) || ACTIVITY_DEFS[0];
    logState.activities[idx].activityId = def.id;
    logState.activities[idx].name       = def.name;
    logState.activities[idx].type       = def.type;
    logState.activities[idx].customName = '';
    const dur = logState.activities[idx].durationMinutes;
    logState.activities[idx].estimatedCalories = Math.round(def.calPerMin * dur);
    renderActivityRow(idx);
    updatePreview();
  };

  const durInput = document.getElementById('act-dur-' + idx);
  durInput.oninput = debounce(() => {
    const val = Math.max(1, parseInt(durInput.value) || 1);
    logState.activities[idx].durationMinutes = val;
    const def = ACTIVITY_DEFS.find(d => d.id === logState.activities[idx].activityId) || ACTIVITY_DEFS[0];
    logState.activities[idx].estimatedCalories = Math.round(def.calPerMin * val);
    renderActivityRow(idx);
    updatePreview();
  }, 300);

  if (entry.activityId === 'act_custom') {
    const nameInput = document.getElementById('act-custom-name-' + idx);
    if (nameInput) {
      nameInput.oninput = debounce(() => {
        logState.activities[idx].customName = nameInput.value;
        logState.activities[idx].name = nameInput.value || 'Custom Activity';
        updatePreview();
      }, 300);
    }
  }
}

function deleteActivity(idx) {
  logState.activities.splice(idx, 1);
  rerenderActivityList();
  updatePreview();
}

function rerenderActivityList() {
  const listEl = document.getElementById('log-activities-list');
  listEl.innerHTML = '';
  logState.activities.forEach((_, i) => renderActivityRow(i));
}

/* ── Exercise row rendering ──────────────────── */

function renderExerciseRow(idx) {
  const entry = logState.exercises[idx];
  const listEl = document.getElementById('log-exercises-list');

  let el = document.getElementById('exercise-row-' + idx);
  if (!el) {
    el = document.createElement('div');
    el.id = 'exercise-row-' + idx;
    el.className = 'card mb-8';
    listEl.appendChild(el);
  }

  const opts = EXERCISE_DEFS.map(d =>
    `<option value="${d.id}" ${d.id === entry.exerciseId ? 'selected' : ''}>${escHtml(d.icon + ' ' + d.name)}</option>`
  ).join('');

  el.innerHTML = `
    <div class="form-group" style="margin-bottom:10px;">
      <label class="form-label">Exercise</label>
      <select id="ex-type-${idx}">${opts}</select>
      ${entry.exerciseId === 'ex_custom' ? `<input id="ex-custom-name-${idx}" placeholder="Exercise name" value="${escHtml(entry.customName||'')}" style="margin-top:6px;">` : ''}
    </div>
    <div class="form-row-3" style="align-items:end;">
      <div class="form-group" style="margin:0;">
        <label class="form-label">Sets</label>
        <input type="number" id="ex-sets-${idx}" value="${entry.sets}" min="1" max="99" style="text-align:center;">
      </div>
      <div class="form-group" style="margin:0;">
        <label class="form-label">Reps</label>
        <input type="number" id="ex-reps-${idx}" value="${entry.reps}" min="1" max="9999" style="text-align:center;">
      </div>
      <button class="item-delete" onclick="deleteExercise(${idx})">✕</button>
    </div>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;">Total: ${entry.totalReps} reps</div>
  `;

  document.getElementById('ex-type-' + idx).onchange = e => {
    const def = EXERCISE_DEFS.find(d => d.id === e.target.value) || EXERCISE_DEFS[0];
    logState.exercises[idx].exerciseId = def.id;
    logState.exercises[idx].name       = def.name;
    logState.exercises[idx].type       = def.type;
    logState.exercises[idx].customName = '';
    renderExerciseRow(idx);
    updatePreview();
  };

  const updateTotalReps = debounce(() => {
    const sets = Math.max(1, parseInt(document.getElementById('ex-sets-' + idx)?.value) || 1);
    const reps = Math.max(1, parseInt(document.getElementById('ex-reps-' + idx)?.value) || 1);
    logState.exercises[idx].sets = sets;
    logState.exercises[idx].reps = reps;
    logState.exercises[idx].totalReps = sets * reps;
    renderExerciseRow(idx);
    updatePreview();
  }, 300);

  document.getElementById('ex-sets-' + idx).oninput = updateTotalReps;
  document.getElementById('ex-reps-' + idx).oninput = updateTotalReps;

  if (entry.exerciseId === 'ex_custom') {
    const nameInput = document.getElementById('ex-custom-name-' + idx);
    if (nameInput) {
      nameInput.oninput = debounce(() => {
        logState.exercises[idx].customName = nameInput.value;
        logState.exercises[idx].name = nameInput.value || 'Custom Exercise';
        updatePreview();
      }, 300);
    }
  }
}

function deleteExercise(idx) {
  logState.exercises.splice(idx, 1);
  const listEl = document.getElementById('log-exercises-list');
  listEl.innerHTML = '';
  logState.exercises.forEach((_, i) => renderExerciseRow(i));
  updatePreview();
}

/* ── Meal row rendering ──────────────────────── */

function renderMealRow(idx) {
  const entry = logState.meals[idx];
  const listEl = document.getElementById('log-meals-list');

  let el = document.getElementById('meal-row-' + idx);
  if (!el) {
    el = document.createElement('div');
    el.id = 'meal-row-' + idx;
    el.className = 'card mb-8';
    listEl.appendChild(el);
  }

  const typeOpts = MEAL_TYPES.map(t =>
    `<option value="${t.toLowerCase()}" ${t.toLowerCase() === entry.mealType ? 'selected' : ''}>${t}</option>`
  ).join('');

  el.innerHTML = `
    <div style="display:flex;gap:6px;align-items:end;margin-bottom:10px;">
      <div class="form-group" style="margin:0;flex:1;">
        <label class="form-label">Meal name</label>
        <input id="meal-name-${idx}" placeholder="e.g. Chicken & Rice" value="${escHtml(entry.name)}">
      </div>
      <button class="item-delete" onclick="deleteMeal(${idx})">✕</button>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;">
        <label class="form-label">Type</label>
        <select id="meal-type-${idx}">${typeOpts}</select>
      </div>
      <div></div>
    </div>
    <div class="form-row mt-8">
      <div class="form-group" style="margin:0;">
        <label class="form-label">Calories</label>
        <div class="input-with-unit">
          <input type="number" id="meal-cal-${idx}" value="${entry.calories||''}" placeholder="0" min="0">
          <span class="input-unit">kcal</span>
        </div>
      </div>
      <div class="form-group" style="margin:0;">
        <label class="form-label">Protein</label>
        <div class="input-with-unit">
          <input type="number" id="meal-prot-${idx}" value="${entry.proteinG||''}" placeholder="0" min="0">
          <span class="input-unit">g</span>
        </div>
      </div>
    </div>
    <div class="form-row mt-8">
      <div class="form-group" style="margin:0;">
        <label class="form-label">Carbs (optional)</label>
        <div class="input-with-unit">
          <input type="number" id="meal-carbs-${idx}" value="${entry.carbsG||''}" placeholder="0" min="0">
          <span class="input-unit">g</span>
        </div>
      </div>
      <div class="form-group" style="margin:0;">
        <label class="form-label">Fats (optional)</label>
        <div class="input-with-unit">
          <input type="number" id="meal-fats-${idx}" value="${entry.fatsG||''}" placeholder="0" min="0">
          <span class="input-unit">g</span>
        </div>
      </div>
    </div>
    <div id="meal-quality-${idx}" class="meal-quality" style="display:none;"></div>
  `;

  const update = debounce(() => {
    logState.meals[idx].name      = document.getElementById('meal-name-' + idx)?.value || '';
    logState.meals[idx].mealType  = document.getElementById('meal-type-' + idx)?.value || 'lunch';
    logState.meals[idx].calories  = parseInt(document.getElementById('meal-cal-' + idx)?.value) || 0;
    logState.meals[idx].proteinG  = parseInt(document.getElementById('meal-prot-' + idx)?.value) || 0;
    logState.meals[idx].carbsG    = parseInt(document.getElementById('meal-carbs-' + idx)?.value) || 0;
    logState.meals[idx].fatsG     = parseInt(document.getElementById('meal-fats-' + idx)?.value) || 0;

    // Live quality indicator
    const m = logState.meals[idx];
    const qualEl = document.getElementById('meal-quality-' + idx);
    if (qualEl && (m.calories > 0 || m.proteinG > 0 || m.carbsG > 0 || m.fatsG > 0)) {
      const q = Engine.computeMealHP(m);
      qualEl.textContent = `${q.emoji} ${q.label} — ${q.hpDelta > 0 ? '+' : ''}${q.hpDelta} HP`;
      qualEl.style.display = 'inline-block';
    } else if (qualEl) {
      qualEl.style.display = 'none';
    }

    updatePreview();
  }, 300);

  document.getElementById('meal-name-' + idx).oninput  = update;
  document.getElementById('meal-type-' + idx).onchange = update;
  document.getElementById('meal-cal-'  + idx).oninput  = update;
  document.getElementById('meal-prot-' + idx).oninput  = update;
  document.getElementById('meal-carbs-' + idx).oninput = update;
  document.getElementById('meal-fats-'  + idx).oninput = update;
}

function deleteMeal(idx) {
  logState.meals.splice(idx, 1);
  const listEl = document.getElementById('log-meals-list');
  listEl.innerHTML = '';
  logState.meals.forEach((_, i) => renderMealRow(i));
  updatePreview();
}

/* ── Session preview ─────────────────────────── */

const ACTIVITY_XP_MOD  = { cardio: 1.0, sports: 1.1, misc: 0.9 };
const EXERCISE_XP_RATE = {
  ex_pushup: 0.4, ex_situp: 0.3, ex_pullup: 0.8,
  ex_squat: 0.4, ex_idl: 0.5, ex_dumbbell: 0.5,
};

function updatePreview() {
  const player  = Store.getPlayer();
  const monster = Store.getMonsters().active;

  const itemsEl       = document.getElementById('preview-items');
  const bonusEl       = document.getElementById('preview-attack-bonus');
  const totalXpEl     = document.getElementById('preview-total-xp');
  const totalCalEl    = document.getElementById('preview-total-cal');
  const totalHpEl     = document.getElementById('preview-total-hp');

  if (!itemsEl) return;

  // XP rows per activity
  let totalXP = 0, totalCal = 0;
  const xpRows = [];

  for (const a of logState.activities) {
    const mod = ACTIVITY_XP_MOD[a.type] || 0.9;
    const xp  = Math.floor(a.durationMinutes * 1.5 * mod);
    totalXP  += xp;
    totalCal += a.estimatedCalories || 0;
    xpRows.push(`
      <div class="preview-item">
        <span class="preview-item-name">${escHtml(a.name)} ${a.durationMinutes}min</span>
        <span class="preview-item-dmg neutral">+${xp} XP</span>
      </div>
    `);
  }

  for (const ex of logState.exercises) {
    const perRep = EXERCISE_XP_RATE[ex.exerciseId] || 0.4;
    const xp     = Math.floor(ex.totalReps * perRep);
    totalXP     += xp;
    xpRows.push(`
      <div class="preview-item">
        <span class="preview-item-name">${escHtml(ex.name)} ${ex.totalReps}r</span>
        <span class="preview-item-dmg neutral">+${xp} XP</span>
      </div>
    `);
  }

  // HP rows from meals
  let totalHpDelta = 0;
  const hpRows = logState.meals.map(m => {
    if (m.calories === 0 && m.proteinG === 0) return '';
    const q = Engine.computeMealHP(m);
    const mitigated = Engine.applyDISMitigation(q.hpDelta, player.stats.DIS);
    totalHpDelta += mitigated;
    const mealXP = 10 + Math.floor((m.proteinG || 0) * 0.2);
    totalXP += mealXP;
    const cls  = mitigated > 0 ? 'hp-gain' : mitigated < 0 ? 'hp-loss' : 'hp-neutral';
    const sign = mitigated > 0 ? '+' : '';
    return `
      <div class="preview-item">
        <span class="preview-item-name">${escHtml(m.name || 'Meal')} ${q.emoji}</span>
        <span class="preview-item-hp ${cls}">${sign}${mitigated} HP</span>
      </div>
    `;
  }).filter(Boolean);

  const allRows = [...xpRows, ...hpRows];
  if (allRows.length > 0) {
    itemsEl.innerHTML = allRows.join('');
  } else {
    itemsEl.innerHTML = `<div class="muted-text" style="font-size:0.78rem;padding:4px 0;">Add items above to see preview</div>`;
  }

  // Attack bonus hint from logged types vs monster weakness
  if (bonusEl && monster && (logState.activities.length > 0 || logState.exercises.length > 0)) {
    const loggedTypes = new Set([
      ...logState.activities.map(a => a.type),
      ...logState.exercises.map(ex => ex.type),
    ]);
    const weaknesses  = monster.weaknesses  || [];
    const resistances = monster.resistances || [];
    let hint = '';
    if ([...loggedTypes].some(t => weaknesses.includes(t))) {
      hint = `<div class="attack-bonus-indicator weakness" style="margin-top:6px;margin-bottom:0;font-size:0.72rem;">🗡️ Weakness logged — +50% attack bonus vs ${escHtml(monster.name)}!</div>`;
    } else if ([...loggedTypes].every(t => resistances.includes(t))) {
      hint = `<div class="attack-bonus-indicator resistance" style="margin-top:6px;margin-bottom:0;font-size:0.72rem;">⚠️ Resistant type only — 50% damage vs ${escHtml(monster.name)}</div>`;
    }
    bonusEl.innerHTML = hint;
  } else if (bonusEl) {
    bonusEl.innerHTML = '';
  }

  if (totalXpEl)  totalXpEl.textContent  = `+${totalXP}`;
  if (totalCalEl) totalCalEl.textContent = `~${totalCal}`;
  if (totalHpEl) {
    const sign = totalHpDelta >= 0 ? '+' : '';
    totalHpEl.textContent = `${sign}${totalHpDelta} HP`;
    totalHpEl.className   = 'preview-total-value ' + (totalHpDelta >= 0 ? 'hp-preview-gain' : 'hp-preview-loss');
  }
}

/* ── Save log ────────────────────────────────── */

function saveLog() {
  const hasAnything = logState.activities.length > 0 || logState.exercises.length > 0 || logState.meals.length > 0;
  if (!hasAnything) {
    Toast.show('Add at least one activity, exercise, or meal first.', 'info');
    return;
  }

  const logEntry = {
    id:         'log_' + Date.now(),
    date:       Store.today(),
    timestamp:  Date.now(),
    activities: logState.activities.map(a => ({ ...a })),
    exercises:  logState.exercises.map(e => ({ ...e })),
    meals:      logState.meals.map(m => ({ ...m })),
    routineId:  logState.routineId || null,
  };

  const results = Engine.processLogEntry(logEntry);
  showResultModal(results);
}

/* ── Result modal ────────────────────────────── */

let _lastResults = null;

function showResultModal(results) {
  _lastResults = results;
  const statGainChips = Object.entries(results.statsGained).map(([s, v]) =>
    `<span class="stat-gain-chip">${s} +${v}</span>`
  ).join('');

  const questRows = results.questUpdates.filter(u => u.wasCompleted).map(u =>
    `<div style="color:var(--accent-green);font-size:0.82rem;">✅ ${escHtml(u.quest.title)} — COMPLETE!</div>`
  ).join('');

  // HP change rows
  const hpRows = (results.mealQualities || []).map(q =>
    `<div class="result-row">
      <span class="result-label">${escHtml(q.name || 'Meal')} ${q.emoji}</span>
      <span class="result-value ${q.hpDelta >= 0 ? 'green' : 'red'}">${q.hpDelta >= 0 ? '+' : ''}${q.hpDelta} HP</span>
    </div>`
  ).join('');

  const overageLine = results.overagePenalty > 0
    ? `<div class="result-row"><span class="result-label">⚠️ Calorie Overage</span><span class="result-value red">-${results.overagePenalty} HP</span></div>`
    : '';
  const regenLine = results.regenBonus > 0
    ? `<div class="result-row"><span class="result-label">💪 Protein Goal!</span><span class="result-value green">+${results.regenBonus} HP</span></div>`
    : '';

  const html = `
    <div class="result-title">📋 TRAINING LOG</div>

    <div class="result-row">
      <span class="result-label">XP Earned</span>
      <span class="result-value gold">+${results.xpEarned}</span>
    </div>
    ${results.streakBonus > 0 ? `
    <div class="result-row">
      <span class="result-label">🔥 Streak Bonus</span>
      <span class="result-value gold">+${results.streakBonus}</span>
    </div>` : ''}
    ${results.fullDayBonus > 0 ? `
    <div class="result-row">
      <span class="result-label">🍽️ Full Day Bonus</span>
      <span class="result-value gold">+${results.fullDayBonus}</span>
    </div>` : ''}
    ${results.routineBonus > 0 ? `
    <div class="result-row">
      <span class="result-label">📋 Routine Bonus</span>
      <span class="result-value gold">+${results.routineBonus}</span>
    </div>` : ''}

    ${(hpRows || overageLine || regenLine) ? `
    <div class="divider"></div>
    <div class="section-label">HEALTH</div>
    ${hpRows}${overageLine}${regenLine}
    <div class="result-row">
      <span class="result-label">HP Now</span>
      <span class="result-value ${results.knockedOut ? 'red' : 'green'}">${results.hpAfter} / ${results.hpMax}</span>
    </div>
    ` : ''}

    ${Object.keys(results.statsGained).length > 0 ? `
    <div class="divider"></div>
    <div class="section-label">STAT GAINS</div>
    <div class="result-stat-gains">${statGainChips}</div>
    ` : ''}

    ${questRows ? `
    <div class="divider"></div>
    <div class="section-label">QUESTS</div>
    ${questRows}
    ` : ''}

    <button class="btn btn-primary mt-16" id="result-continue-btn">CONTINUE</button>
  `;

  Modal.show(html);

  document.getElementById('result-continue-btn').onclick = () => {
    Modal.hide();

    // Show achievement toasts
    for (const ach of results.newAchievements) {
      Toast.show(`${ach.icon} Achievement unlocked: ${ach.title}`, 'achievement');
    }

    // Level up modals
    if (results.newLevels.length > 0) {
      showLevelUpModal(results.newLevels[results.newLevels.length - 1]);
      return;
    }

    // Knock-out modal (before defeat/dashboard)
    if (results.knockedOut) {
      showKnockOutModal(results);
      return;
    }

    // Defeat modal
    if (results.defeatedMonster) {
      showDefeatModal(results.defeatedMonster);
      return;
    }

    Router.navigate('dashboard');
  };
}

function showLevelUpModal(newLevel) {
  const player = Store.getPlayer();
  const daysLeft = Engine.daysUntilCycleEnd(player, Store.today());
  const html = `
    <div class="center-text">
      <div class="levelup-title">⭐ LEVEL UP! ⭐</div>
      <div class="levelup-new-level">LVL ${newLevel}</div>
      <div class="muted-text mb-16">Cosmetic level — resets in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. +50 gold earned.</div>
      <button class="btn btn-primary" id="levelup-ok-btn">GLORIOUS!</button>
    </div>
  `;
  Modal.show(html);

  document.getElementById('levelup-ok-btn').onclick = () => {
    Modal.hide();
    const results = _lastResults;
    if (results && results.knockedOut) {
      showKnockOutModal(results);
    } else if (results && results.defeatedMonster) {
      showDefeatModal(results.defeatedMonster);
    } else {
      Router.navigate('dashboard');
    }
  };
}

function showDefeatModal(defeatData) {
  const { monster, reward } = defeatData;
  const boostChips = reward.statBoosts
    ? Object.entries(reward.statBoosts).map(([s, v]) =>
        `<span class="stat-gain-chip">${s} +${v}</span>`).join('')
    : '';

  const html = `
    <div class="defeat-modal">
      <span class="defeat-art">${escHtml(monster.art)}</span>
      <div class="defeat-title">MONSTER DEFEATED!</div>
      <div class="defeat-message">"${escHtml(monster.defeatMessage)}"</div>
      <div class="defeat-rewards">
        <div class="section-label">REWARDS</div>
        <div class="result-row">
          <span class="result-label">XP</span>
          <span class="result-value gold">+${reward.xp}</span>
        </div>
        <div class="result-row">
          <span class="result-label">Gold</span>
          <span class="result-value gold">+${reward.gold} 🪙</span>
        </div>
        ${boostChips ? `<div class="result-stat-gains mt-8">${boostChips}</div>` : ''}
      </div>
      <button class="btn btn-primary" id="defeat-continue-btn">⚔️ ONWARD!</button>
    </div>
  `;

  Modal.show(html);
  document.getElementById('defeat-continue-btn').onclick = () => {
    Modal.hide();
    Toast.show(`${monster.art} ${monster.name} defeated! A new monster approaches...`, 'success');
    Router.navigate('dashboard');
  };
}

function showKnockOutModal(results) {
  const player = Store.getPlayer();
  const { STR, AGI, VIT, DIS } = player.stats;
  const html = `
    <div class="knocked-out-modal">
      <div class="knocked-out-title">💀 KNOCKED OUT 💀</div>
      <div style="font-size:0.88rem;color:var(--text-muted);margin-bottom:16px;">
        Your health reached 0. All stats have been halved and your HP has been reset.
        Eat well and exercise to recover.
      </div>
      <div class="card" style="margin-bottom:16px;">
        <div class="section-label">HP RESET TO</div>
        <div style="font-family:var(--font-display);font-size:0.7rem;color:var(--accent-red);margin-top:4px;">
          ${results.hpAfter} / ${results.hpMax}
        </div>
      </div>
      <div class="card" style="margin-bottom:16px;">
        <div class="section-label">STATS HALVED</div>
        <div style="font-family:var(--font-display);font-size:0.55rem;color:var(--text-muted);margin-top:6px;line-height:2;">
          STR:${STR}  AGI:${AGI}  VIT:${VIT}  DIS:${DIS}
        </div>
      </div>
      <button class="btn btn-primary" id="ko-continue-btn">CONTINUE</button>
    </div>
  `;
  Modal.show(html);

  document.getElementById('ko-continue-btn').onclick = () => {
    Modal.hide();
    if (results.defeatedMonster) {
      showDefeatModal(results.defeatedMonster);
    } else {
      Router.navigate('dashboard');
    }
  };
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

Router.register('log', renderLog);
