/* ─────────────────────────────────────────────
   Log Entry screen — Activities, Exercises, Meals
   with live battle preview, stat-delta preview,
   and added-sugar tracking.
   ───────────────────────────────────────────── */

const ACTIVITY_DEFS = [
  { id: 'act_jog',     name: 'Jogging / Running', icon: '🏃', calPerMin: 10, type: 'cardio' },
  { id: 'act_swim',    name: 'Swimming',           icon: '🏊', calPerMin: 9,  type: 'cardio' },
  { id: 'act_bball',   name: 'Basketball / Sports',icon: '🏀', calPerMin: 8,  type: 'sports' },
  { id: 'act_walkdog', name: 'Walking the Dog',    icon: '🐕', calPerMin: 4,  type: 'cardio' },
  { id: 'act_sex',     name: 'Sex',                icon: '❤️', calPerMin: 5,  type: 'cardio' },
  { id: 'act_cycle',   name: 'Cycling',            icon: '🚴', calPerMin: 8,  type: 'cardio' },
  { id: 'act_hike',    name: 'Hiking',             icon: '🥾', calPerMin: 6,  type: 'cardio' },
  { id: 'act_yoga',    name: 'Yoga / Stretching',  icon: '🧘', calPerMin: 3,  type: 'misc' },
  { id: 'act_custom',  name: 'Custom Activity',    icon: '⚡', calPerMin: 6,  type: 'misc' },
];

const EXERCISE_DEFS = [
  { id: 'ex_pushup',   name: 'Push-ups',           icon: '💪', type: 'bodyweight' },
  { id: 'ex_situp',    name: 'Sit-ups / Crunches', icon: '🔥', type: 'bodyweight' },
  { id: 'ex_pullup',   name: 'Pull-ups / Chin-ups',icon: '🏋️', type: 'bodyweight' },
  { id: 'ex_squat',    name: 'Squats',             icon: '🦵', type: 'bodyweight' },
  { id: 'ex_lunge',    name: 'Lunges',             icon: '🦵', type: 'bodyweight' },
  { id: 'ex_dip',      name: 'Dips',               icon: '💪', type: 'bodyweight' },
  { id: 'ex_burpee',   name: 'Burpees',            icon: '🔥', type: 'bodyweight' },
  { id: 'ex_plank',    name: 'Plank (sec held)',   icon: '⏱', type: 'bodyweight' },
  { id: 'ex_idl',      name: 'Inverted Leg Raises',icon: '🦵', type: 'bodyweight' },
  { id: 'ex_dumbbell', name: 'Dumbbell Exercise',  icon: '🏋️', type: 'weighted' },
  { id: 'ex_bench',    name: 'Bench Press',        icon: '🏋️', type: 'weighted' },
  { id: 'ex_row',      name: 'Bent-over Row',      icon: '🏋️', type: 'weighted' },
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

  const preselectRoutine = (() => {
    const m = window.location.hash.match(/[?&]routine=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  })();

  // Today's sugar total before this entry (for the running counter UI).
  const player = Store.getPlayer();
  const sugarMax = player.goals.dailyAddedSugarMaxG ?? 36;
  const today = Store.today();
  const priorSugar = Store.getLog()
    .filter(e => e.date === today)
    .reduce((s, e) => s + (e.meals || []).reduce((ms, m) => ms + (m.addedSugarG || 0), 0), 0);

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

      <div class="card mb-12" style="padding:10px 12px;">
        <div class="section-label" style="margin-bottom:6px;">Quick-add from your library</div>
        <select id="log-meal-template-picker" style="width:100%;">
          ${buildMealTemplateOptions()}
        </select>
        <div style="font-size:0.7rem;color:var(--text-dim);margin-top:4px;line-height:1.3;">
          Manage your library in Settings → Meal Library.
        </div>
      </div>

      <div id="sugar-running-row" style="display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;margin-bottom:8px;">
        <span style="color:var(--text-muted);">🍬 Sugar today:</span>
        <span id="sugar-running-text" style="font-family:var(--font-display);font-size:0.5rem;color:var(--text-primary);">
          ${priorSugar}/${sugarMax}g
        </span>
      </div>
      <div id="log-meals-list"></div>
      <div class="add-entry-row" id="add-meal-btn">
        <span>+</span> Add Meal
      </div>
    </div>

    <!-- Session preview -->
    <div class="battle-preview" id="battle-preview">
      <div class="battle-preview-title">📋 SESSION PREVIEW</div>
      <div id="preview-items"></div>
      <div id="preview-stat-deltas" style="margin-top:6px;display:none;"></div>
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
    logState.meals.push({ name: '', calories: 0, proteinG: 0, fiberG: 0, carbsG: 0, fatsG: 0, addedSugarG: 0, mealType: 'lunch' });
    renderMealRow(logState.meals.length - 1);
    updatePreview();
  };

  document.getElementById('save-log-btn').onclick = saveLog;

  document.getElementById('log-routine-picker').onchange = (e) => {
    applyRoutine(e.target.value);
  };

  const mealPicker = document.getElementById('log-meal-template-picker');
  if (mealPicker) {
    mealPicker.onchange = (e) => {
      applyMealTemplate(e.target.value);
      e.target.value = '';
    };
  }

  if (preselectRoutine) {
    applyRoutine(preselectRoutine);
  }

  updatePreview();
}

function buildMealTemplateOptions() {
  const library = Store.getMealLibrary();
  if (library.length === 0) {
    return `<option value="">— No saved meals yet — add some in Settings →</option>`;
  }
  const sorted = [...library].sort((a, b) =>
    (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()));
  const opts = sorted.map(t => {
    const macros = [
      `${t.calories || 0}cal`,
      t.proteinG ? `${t.proteinG}p` : null,
      t.addedSugarG ? `${t.addedSugarG}🍬` : null,
    ].filter(Boolean).join(' · ');
    return `<option value="${escHtml(t.id)}">${escHtml(t.name || '(unnamed)')} — ${escHtml(macros)}</option>`;
  }).join('');
  return `<option value="">— Add custom meal —</option>${opts}`;
}

function applyMealTemplate(id) {
  if (!id) return;
  const t = Store.getMealLibrary().find(x => x.id === id);
  if (!t) return;
  // Copy the template's values into a fresh meal entry — later edits to the
  // template don't propagate to already-logged meals.
  logState.meals.push({
    name:        t.name || '',
    calories:    t.calories || 0,
    proteinG:    t.proteinG || 0,
    fiberG:      t.fiberG || 0,
    carbsG:      t.carbsG || 0,
    fatsG:       t.fatsG || 0,
    addedSugarG: t.addedSugarG || 0,
    mealType:    t.mealType || 'lunch',
  });
  renderMealRow(logState.meals.length - 1);
  updatePreview();
  Toast.show(`Added "${t.name}"`, 'success');
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

  const bonus = Engine.getActiveBonus(Date.now());
  const bonusChip = (bonus && bonus.kind === 'activity' && bonus.itemId === entry.activityId)
    ? `<span class="bonus-chip-inline">⭐ +25% bonus</span>` : '';

  el.innerHTML = `
    <div class="form-row" style="align-items:start;">
      <div class="form-group" style="margin:0;">
        <label class="form-label">Activity ${bonusChip}</label>
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

  const bonus = Engine.getActiveBonus(Date.now());
  const bonusChip = (bonus && bonus.kind === 'exercise' && bonus.itemId === entry.exerciseId)
    ? `<span class="bonus-chip-inline">⭐ +25% bonus</span>` : '';

  el.innerHTML = `
    <div class="form-group" style="margin-bottom:10px;">
      <label class="form-label">Exercise ${bonusChip}</label>
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
    <div class="form-group" style="margin:8px 0 0;">
      <label class="form-label">Fiber</label>
      <div class="input-with-unit">
        <input type="number" id="meal-fiber-${idx}" value="${entry.fiberG||''}" placeholder="0" min="0">
        <span class="input-unit">g</span>
      </div>
    </div>
    <details class="meal-extra-macros" style="margin-top:8px;">
      <summary style="cursor:pointer;font-size:0.78rem;color:var(--text-muted);">Other macros (optional)</summary>
      <div class="form-row mt-8">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Carbs</label>
          <div class="input-with-unit">
            <input type="number" id="meal-carbs-${idx}" value="${entry.carbsG||''}" placeholder="0" min="0">
            <span class="input-unit">g</span>
          </div>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Fats</label>
          <div class="input-with-unit">
            <input type="number" id="meal-fats-${idx}" value="${entry.fatsG||''}" placeholder="0" min="0">
            <span class="input-unit">g</span>
          </div>
        </div>
      </div>
      <div class="form-group" style="margin:8px 0 0;">
        <label class="form-label">Added Sugar (2 HP per gram over the daily limit)</label>
        <div class="input-with-unit">
          <input type="number" id="meal-sugar-${idx}" value="${entry.addedSugarG||''}" placeholder="0" min="0">
          <span class="input-unit">g</span>
        </div>
      </div>
    </details>
    <div id="meal-quality-${idx}" class="meal-quality" style="display:none;"></div>
  `;

  const update = debounce(() => {
    logState.meals[idx].name        = document.getElementById('meal-name-' + idx)?.value || '';
    logState.meals[idx].mealType    = document.getElementById('meal-type-' + idx)?.value || 'lunch';
    logState.meals[idx].calories    = parseInt(document.getElementById('meal-cal-' + idx)?.value) || 0;
    logState.meals[idx].proteinG    = parseInt(document.getElementById('meal-prot-' + idx)?.value) || 0;
    logState.meals[idx].carbsG      = parseInt(document.getElementById('meal-carbs-' + idx)?.value) || 0;
    logState.meals[idx].fatsG       = parseInt(document.getElementById('meal-fats-' + idx)?.value) || 0;
    logState.meals[idx].addedSugarG = parseInt(document.getElementById('meal-sugar-' + idx)?.value) || 0;
    logState.meals[idx].fiberG      = parseInt(document.getElementById('meal-fiber-' + idx)?.value) || 0;

    const m = logState.meals[idx];
    const qualEl = document.getElementById('meal-quality-' + idx);
    if (qualEl && (m.calories > 0 || m.proteinG > 0 || m.addedSugarG > 0)) {
      const cls = Engine.classifyMeal(m);
      const goal = (Store.getPlayer()?.goals?.dailyCalories) || 2000;
      const heal = Engine.computeMealHeal(m, 0, goal);
      const sugarMax = Store.getPlayer()?.goals?.dailyAddedSugarMaxG ?? 36;
      // Simple per-meal sugar damage display assumes you're at 0 sugar — for
      // real numbers see the session preview below.
      const overage = Math.max(0, (m.addedSugarG || 0) - sugarMax);
      const sugarDmg = overage * Engine.SUGAR_DMG_PER_GRAM;
      const net = heal - sugarDmg;
      const sign = net >= 0 ? '+' : '';
      qualEl.innerHTML = `${cls.emoji} ${cls.label} — ${sign}${net} HP${sugarDmg > 0 ? ` (sugar -${sugarDmg})` : ''}`;
      qualEl.style.display = 'inline-block';
    } else if (qualEl) {
      qualEl.style.display = 'none';
    }

    updatePreview();
  }, 300);

  document.getElementById('meal-name-' + idx).oninput   = update;
  document.getElementById('meal-type-' + idx).onchange  = update;
  document.getElementById('meal-cal-'  + idx).oninput   = update;
  document.getElementById('meal-prot-' + idx).oninput   = update;
  document.getElementById('meal-fiber-' + idx).oninput  = update;
  document.getElementById('meal-carbs-' + idx).oninput  = update;
  document.getElementById('meal-fats-'  + idx).oninput  = update;
  document.getElementById('meal-sugar-' + idx).oninput  = update;
}

function deleteMeal(idx) {
  logState.meals.splice(idx, 1);
  const listEl = document.getElementById('log-meals-list');
  listEl.innerHTML = '';
  logState.meals.forEach((_, i) => renderMealRow(i));
  updatePreview();
}

/* ── Session preview ─────────────────────────── */

function updatePreview() {
  const player  = Store.getPlayer();
  const monster = Store.getMonsters().active;

  const itemsEl       = document.getElementById('preview-items');
  const statsEl       = document.getElementById('preview-stat-deltas');
  const bonusEl       = document.getElementById('preview-attack-bonus');
  const totalXpEl     = document.getElementById('preview-total-xp');
  const totalCalEl    = document.getElementById('preview-total-cal');
  const totalHpEl     = document.getElementById('preview-total-hp');
  const sugarTextEl   = document.getElementById('sugar-running-text');

  if (!itemsEl) return;

  const preview = Engine.previewDamage(
    logState.activities, logState.exercises, logState.meals,
    monster, player
  );

  const rows = [];

  for (const a of logState.activities) {
    rows.push(`
      <div class="preview-item">
        <span class="preview-item-name">${escHtml(a.name)} ${a.durationMinutes}min</span>
        <span class="preview-item-dmg neutral">+${Math.floor(a.durationMinutes * 1.5 * (a.type === 'sports' ? 1.1 : a.type === 'cardio' ? 1 : 0.9))} XP</span>
      </div>
    `);
  }

  for (const ex of logState.exercises) {
    const xp = preview.totalXP; // not per-row; we'll fall back to summing
    rows.push(`
      <div class="preview-item">
        <span class="preview-item-name">${escHtml(ex.name)} ${ex.totalReps}r</span>
        <span class="preview-item-dmg neutral">workout</span>
      </div>
    `);
  }

  // Meal HP rows w/ sugar damage taken into account
  const sugarMax = player.goals.dailyAddedSugarMaxG ?? 36;
  const today    = Store.today();
  const priorEntries = Store.getLog().filter(e => e.date === today);
  let runningCal   = priorEntries.reduce((sum, e) => sum + e.meals.reduce((s, m) => s + (m.calories || 0), 0), 0);
  let runningSugar = priorEntries.reduce((sum, e) => sum + e.meals.reduce((s, m) => s + (m.addedSugarG || 0), 0), 0);
  let totalHpDelta = 0;
  for (const m of logState.meals) {
    if (m.calories === 0 && m.proteinG === 0 && (m.addedSugarG || 0) === 0) continue;
    const cls       = Engine.classifyMeal(m);
    const heal      = Engine.computeMealHeal(m, runningCal, player.goals.dailyCalories);
    const overage   = Engine.sugarOverageForMeal(m, runningSugar, sugarMax);
    const sugarDmg  = overage * Engine.SUGAR_DMG_PER_GRAM;
    const net       = heal - sugarDmg;
    totalHpDelta   += net;
    runningCal     += m.calories || 0;
    runningSugar   += m.addedSugarG || 0;
    const sign = net >= 0 ? '+' : '';
    const cls2 = net > 0 ? 'hp-gain' : (net < 0 ? 'hp-loss' : 'hp-neutral');
    rows.push(`
      <div class="preview-item">
        <span class="preview-item-name">${escHtml(m.name || 'Meal')} ${cls.emoji}${sugarDmg > 0 ? ` 🍬-${sugarDmg}` : ''}</span>
        <span class="preview-item-hp ${cls2}">${sign}${net} HP</span>
      </div>
    `);
  }

  itemsEl.innerHTML = rows.length > 0
    ? rows.join('')
    : `<div class="muted-text" style="font-size:0.78rem;padding:4px 0;">Add items above to see preview</div>`;

  // Stat-delta preview
  const sp = preview.statPreview || { STR:0, AGI:0, VIT:0 };
  const anyStat = sp.STR + sp.AGI + sp.VIT > 0;
  if (statsEl) {
    if (anyStat) {
      const fmt = (v) => v > 0 ? `+${v.toFixed(2)}` : '0';
      statsEl.style.display = '';
      statsEl.innerHTML = `
        <div class="preview-stat-row">
          <span class="preview-stat-label">Stat bars</span>
          <span class="preview-stat-chips">
            <span class="stat-delta-chip stat-bar-str-text">STR ${fmt(sp.STR)}</span>
            <span class="stat-delta-chip stat-bar-agi-text">AGI ${fmt(sp.AGI)}</span>
            <span class="stat-delta-chip stat-bar-vit-text">VIT ${fmt(sp.VIT)}</span>
          </span>
        </div>
      `;
    } else {
      statsEl.style.display = 'none';
    }
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
      const mult = Engine.weaknessMultiplier(player.stats.STR);
      hint = `<div class="attack-bonus-indicator weakness" style="margin-top:6px;margin-bottom:0;font-size:0.72rem;">🗡️ Weakness logged — ×${mult.toFixed(2)} attack vs ${escHtml(monster.name)}!</div>`;
    } else if ([...loggedTypes].every(t => resistances.includes(t))) {
      hint = `<div class="attack-bonus-indicator resistance" style="margin-top:6px;margin-bottom:0;font-size:0.72rem;">⚠️ Resistant type only — 50% damage vs ${escHtml(monster.name)}</div>`;
    }
    bonusEl.innerHTML = hint;
  } else if (bonusEl) {
    bonusEl.innerHTML = '';
  }

  if (totalXpEl)  totalXpEl.textContent  = `+${preview.totalXP}`;
  if (totalCalEl) totalCalEl.textContent = `~${preview.totalCal}`;
  if (totalHpEl) {
    const sign = totalHpDelta >= 0 ? '+' : '';
    totalHpEl.textContent = `${sign}${totalHpDelta} HP`;
    totalHpEl.className   = 'preview-total-value ' + (totalHpDelta >= 0 ? 'hp-preview-gain' : 'hp-preview-loss');
  }

  // Sugar running total
  if (sugarTextEl) {
    const projected = runningSugar;
    const overChip = projected > sugarMax ? ` ⚠ over` : '';
    sugarTextEl.textContent = `${projected}/${sugarMax}g${overChip}`;
    sugarTextEl.style.color = projected > sugarMax ? 'var(--accent-red)' : 'var(--text-primary)';
  }
}

/* ── Save log ────────────────────────────────── */

function saveLog() {
  const hasAnything = logState.activities.length > 0 || logState.exercises.length > 0 || logState.meals.length > 0;
  if (!hasAnything) {
    Toast.show('Add at least one activity, exercise, or meal first.', 'info');
    return;
  }

  const playerBefore = Store.getPlayer();
  const accBefore = {
    STR: playerBefore.statPoints.STR_acc || 0,
    AGI: playerBefore.statPoints.AGI_acc || 0,
    VIT: playerBefore.statPoints.VIT_acc || 0,
  };
  const statsBefore = { ...playerBefore.stats };

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
  results._accBefore   = accBefore;
  results._statsBefore = statsBefore;
  showResultModal(results);
}

/* ── Result modal ────────────────────────────── */

let _lastResults = null;

function showResultModal(results) {
  _lastResults = results;
  const player = Store.getPlayer();

  const statGainChips = Object.entries(results.statsGained).map(([s, v]) =>
    `<span class="stat-gain-chip">${s} +${v}</span>`
  ).join('');

  // Bar-advance rows: show acc-before vs acc-after for each stat that moved.
  const barRows = ['STR', 'AGI', 'VIT'].map(s => {
    const delta = (results.statDeltas && results.statDeltas[s]) || 0;
    if (delta <= 0.005) return '';
    const accBefore = (results._accBefore && results._accBefore[s]) || 0;
    const accAfter  = (player.statPoints[s + '_acc']) || 0;
    const beforeCurve = Engine.statCurve.statFromAcc(accBefore);
    const afterCurve  = Engine.statCurve.statFromAcc(accAfter);
    const beforePct = Engine.statCurve.progressPct(accBefore);
    const afterPct  = Engine.statCurve.progressPct(accAfter);
    return `
      <div class="bar-advance-row">
        <div class="bar-advance-label">${s} +${delta.toFixed(2)} acc</div>
        <div class="bar-advance-bar">
          <div class="bar-advance-track">
            <div class="bar-advance-fill stat-bar-${s.toLowerCase()}" style="width:${beforePct}%"></div>
            <div class="bar-advance-overlay stat-bar-${s.toLowerCase()}" style="left:${beforePct}%;width:${Math.max(0, afterPct - beforePct)}%"></div>
          </div>
          <div class="bar-advance-text">
            ${beforeCurve.accIntoLevel.toFixed(1)}/${beforeCurve.nextCost} → ${afterCurve.accIntoLevel.toFixed(1)}/${afterCurve.nextCost}
          </div>
        </div>
      </div>
    `;
  }).join('');

  const questRows = results.questUpdates.filter(u => u.wasCompleted).map(u =>
    `<div style="color:var(--accent-green);font-size:0.82rem;">✅ ${escHtml(u.quest.title)} — COMPLETE!</div>`
  ).join('');

  // HP change rows — per-meal lines (net could be negative)
  const hpRows = (results.mealQualities || []).map(q => {
    const sign = q.hp >= 0 ? '+' : '';
    const cls  = q.hp > 0 ? 'green' : (q.hp < 0 ? 'red' : '');
    const sugarTag = q.sugarDmg > 0 ? ` <span style="color:var(--accent-red);font-size:0.75rem;">🍬-${q.sugarDmg}</span>` : '';
    return `<div class="result-row">
      <span class="result-label">🍽 ${escHtml(q.name || 'Meal')} ${q.emoji}${sugarTag}</span>
      <span class="result-value ${cls}">${sign}${q.hp} HP</span>
    </div>`;
  }).join('');

  const bd = results.hpBreakdown || {};
  const cal800Line = bd.cal800Bonus > 0
    ? `<div class="result-row"><span class="result-label">🎯 Calorie milestone (800)</span><span class="result-value green">+${bd.cal800Bonus} HP</span></div>` : '';
  const cal1600Line = bd.cal1600Bonus > 0
    ? `<div class="result-row"><span class="result-label">🎯 Calorie milestone (1600)</span><span class="result-value green">+${bd.cal1600Bonus} HP</span></div>` : '';
  const proteinLine = bd.proteinBonus > 0
    ? `<div class="result-row"><span class="result-label">🥩 Protein goal hit!</span><span class="result-value green">+${bd.proteinBonus} HP</span></div>` : '';
  const sugarLine = bd.sugarDmg > 0
    ? `<div class="result-row"><span class="result-label">🍬 Total sugar damage</span><span class="result-value red">-${bd.sugarDmg} HP</span></div>` : '';

  const tier = results.tier;
  const tierRow = tier ? `
    <div class="result-row">
      <span class="result-label">📊 Discipline tier</span>
      <span class="result-value" style="color:${tier.tier.color}">${tier.tier.label} (${tier.points}/${tier.maxPoints ?? 6}) × ${tier.tier.mult.toFixed(2)}</span>
    </div>
  ` : '';

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
    ${results.bonusApplied && results.bonus ? `
    <div class="result-row">
      <span class="result-label">⭐ ${results.bonus.icon} ${escHtml(results.bonus.label)} Bonus</span>
      <span class="result-value gold">+25% STAT</span>
    </div>` : ''}

    ${tierRow}

    ${(hpRows || cal800Line || cal1600Line || proteinLine || sugarLine) ? `
    <div class="divider"></div>
    <div class="section-label">HEALTH</div>
    ${hpRows}${cal800Line}${cal1600Line}${proteinLine}${sugarLine}
    <div class="result-row">
      <span class="result-label">HP Now</span>
      <span class="result-value ${results.knockedOut ? 'red' : 'green'}">${results.hpAfter} / ${results.hpMax}</span>
    </div>
    ` : ''}

    ${barRows ? `
    <div class="divider"></div>
    <div class="section-label">BAR ADVANCE</div>
    ${barRows}
    ` : ''}

    ${Object.keys(results.statsGained).length > 0 ? `
    <div class="divider"></div>
    <div class="section-label">STAT LEVEL-UPS</div>
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

    for (const ach of results.newAchievements) {
      Toast.show(`${ach.icon} Achievement unlocked: ${ach.title}`, 'achievement');
    }

    if (results.newLevels.length > 0) {
      showLevelUpModal(results.newLevels[results.newLevels.length - 1]);
      return;
    }

    if (results.knockedOut) {
      showKnockOutModal(results);
      return;
    }

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
  const { STR, AGI, VIT } = player.stats;
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
          STR:${STR}  AGI:${AGI}  VIT:${VIT}
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
