/* ─────────────────────────────────────────────
   Settings screen
   ───────────────────────────────────────────── */

function renderSettings(container) {
  const player = Store.getPlayer();
  const body = player.body || {};
  const muscleTargets = (player.goals && player.goals.weeklyMuscleTargets) || { push: 2, pull: 2, legs: 2, core: 2 };
  const stretchTarget = (player.goals && player.goals.weeklyStretchTarget != null) ? player.goals.weeklyStretchTarget : 2;
  const totalInches = body.heightIn || 0;
  const heightFt = totalInches ? Math.floor(totalInches / 12) : '';
  const heightInRem = totalInches ? (totalInches % 12) : '';

  const actLevels = [
    [1.2,   'Sedentary (desk job, little exercise)'],
    [1.375, 'Lightly Active (1–3 days/wk)'],
    [1.55,  'Moderately Active (3–5 days/wk)'],
    [1.725, 'Very Active (6–7 days/wk)'],
    [1.9,   'Extra Active (physical job or 2× daily)'],
  ];
  const actOpts = actLevels.map(([v, l]) =>
    `<option value="${v}" ${(body.activityLevel || 1.375) == v ? 'selected' : ''}>${l}</option>`
  ).join('');

  container.innerHTML = `
    <div class="screen-title">SETTINGS</div>

    <div class="card">
      <div class="card-title" style="margin-bottom:14px;">PROFILE</div>

      <div class="form-group">
        <label class="form-label">Player Name</label>
        <input id="settings-name" value="${escHtml(player.name)}" maxlength="30">
      </div>

      <div class="form-group">
        <label class="form-label">Daily Calorie Goal <span style="font-size:0.7rem;color:var(--text-dim);">(auto-set from Body &amp; Deficit below when body stats are entered)</span></label>
        <div class="input-with-unit">
          <input type="number" id="settings-cal" value="${player.goals.dailyCalories}" min="500" max="9999">
          <span class="input-unit">kcal</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Daily Protein Goal</label>
        <div class="input-with-unit">
          <input type="number" id="settings-prot" value="${player.goals.dailyProteinG}" min="10" max="999">
          <span class="input-unit">g</span>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Daily Fiber Goal</label>
          <div class="input-with-unit">
            <input type="number" id="settings-fiber" value="${player.goals.dailyFiberG ?? 30}" min="0" max="200">
            <span class="input-unit">g</span>
          </div>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Daily Water Goal</label>
          <div class="input-with-unit">
            <input type="number" id="settings-water" value="${player.goals.dailyWaterOz ?? 64}" min="0" max="256">
            <span class="input-unit">oz</span>
          </div>
        </div>
      </div>
      <div class="muted-text" style="font-size:0.74rem;margin-top:-4px;margin-bottom:10px;">
        Hitting BOTH fiber and water targets earns one discipline credit.
      </div>

      <div class="form-group">
        <label class="form-label">Weight Target (optional)</label>
        <div class="input-with-unit">
          <input type="number" id="settings-weight-target" value="${player.goals.weightTargetLbs ?? ''}" min="50" max="500" placeholder="lbs">
          <span class="input-unit">lbs</span>
        </div>
        <div class="muted-text" style="font-size:0.72rem;margin-top:4px;line-height:1.4;">
          Shown as a reference line on the weight chart in DATA.
        </div>
      </div>

      <details>
        <summary style="cursor:pointer;font-size:0.78rem;color:var(--text-muted);margin-bottom:10px;">Advanced macros (carbs / fats / sugar)</summary>

        <div class="form-row">
          <div class="form-group" style="margin:0;">
            <label class="form-label">Carbs Goal</label>
            <div class="input-with-unit">
              <input type="number" id="settings-carbs" value="${player.goals.dailyCarbsG || 0}" min="0" max="999">
              <span class="input-unit">g</span>
            </div>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Fats Goal</label>
            <div class="input-with-unit">
              <input type="number" id="settings-fats" value="${player.goals.dailyFatsG || 0}" min="0" max="999">
              <span class="input-unit">g</span>
            </div>
          </div>
        </div>

        <div class="form-group mt-8">
          <label class="form-label">Max Added Sugar (per day)</label>
          <div class="input-with-unit">
            <input type="number" id="settings-sugar" value="${player.goals.dailyAddedSugarMaxG ?? 36}" min="0" max="500">
            <span class="input-unit">g</span>
          </div>
          <div class="muted-text" style="font-size:0.72rem;margin-top:4px;line-height:1.4;">
            Going over deals HP damage (${Engine.SUGAR_DMG_PER_GRAM} HP per gram over). Tracked but no longer a DIS credit.
          </div>
        </div>
      </details>

      <button class="btn btn-primary" onclick="saveSettings()">SAVE CHANGES</button>
    </div>

    <div class="card mt-12">
      <div class="card-title" style="margin-bottom:10px;">BODY &amp; DEFICIT</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px;">
        Enter your stats to auto-calculate a calorie target via Mifflin-St Jeor. Saves to your calorie goal above.
      </div>

      <div class="form-row">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Height</label>
          <div style="display:flex;gap:6px;">
            <div class="input-with-unit" style="flex:1;">
              <input type="number" id="settings-height-ft" value="${heightFt}" min="3" max="8" placeholder="ft" style="text-align:center;">
              <span class="input-unit">ft</span>
            </div>
            <div class="input-with-unit" style="flex:1;">
              <input type="number" id="settings-height-in" value="${heightInRem}" min="0" max="11" placeholder="in" style="text-align:center;">
              <span class="input-unit">in</span>
            </div>
          </div>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Weight</label>
          <div class="input-with-unit">
            <input type="number" id="settings-body-weight" value="${body.weightLbs || ''}" min="50" max="500" placeholder="lbs" style="text-align:center;">
            <span class="input-unit">lbs</span>
          </div>
        </div>
      </div>

      <div class="form-row mt-8">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Age</label>
          <input type="number" id="settings-age" value="${body.age || ''}" min="13" max="99" placeholder="years" style="text-align:center;">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Biological Sex</label>
          <select id="settings-sex">
            <option value="male" ${body.sex !== 'female' ? 'selected' : ''}>Male</option>
            <option value="female" ${body.sex === 'female' ? 'selected' : ''}>Female</option>
          </select>
        </div>
      </div>

      <div class="form-group mt-8">
        <label class="form-label">Activity Level</label>
        <select id="settings-activity-level">${actOpts}</select>
      </div>

      <div class="form-group mt-8">
        <label class="form-label">Daily Deficit Goal</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
          <button class="water-chip" onclick="setDeficit(250)">−250</button>
          <button class="water-chip" onclick="setDeficit(500)">−500</button>
          <button class="water-chip" onclick="setDeficit(750)">−750</button>
          <button class="water-chip" onclick="setDeficit(1000)">−1000</button>
        </div>
        <div class="input-with-unit">
          <input type="number" id="settings-deficit" value="${body.deficitGoal != null ? body.deficitGoal : 500}" min="0" max="1500">
          <span class="input-unit">kcal/day</span>
        </div>
      </div>

      <div id="tdee-preview" style="margin-top:10px;padding:10px;background:var(--surface-2,var(--surface));border-radius:8px;font-size:0.8rem;color:var(--text-dim);">
        Enter height, weight, and age to see your TDEE estimate.
      </div>

      <div class="divider" style="margin:14px 0;"></div>

      <div class="card-title" style="margin-bottom:6px;">WEEKLY TRAINING TARGETS</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px;">Sessions per week for each muscle group and stretching.</div>

      <div class="form-row">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Push (Chest/Shoulders)</label>
          <input type="number" id="settings-target-push" value="${muscleTargets.push}" min="0" max="7" style="text-align:center;">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Pull (Back/Biceps)</label>
          <input type="number" id="settings-target-pull" value="${muscleTargets.pull}" min="0" max="7" style="text-align:center;">
        </div>
      </div>
      <div class="form-row mt-8">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Legs (Quads/Hams)</label>
          <input type="number" id="settings-target-legs" value="${muscleTargets.legs}" min="0" max="7" style="text-align:center;">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Core (Abs/Back)</label>
          <input type="number" id="settings-target-core" value="${muscleTargets.core}" min="0" max="7" style="text-align:center;">
        </div>
      </div>
      <div class="form-group mt-8">
        <label class="form-label">Stretching sessions / week</label>
        <input type="number" id="settings-target-stretch" value="${stretchTarget}" min="0" max="7" style="text-align:center;">
      </div>

      <button class="btn btn-primary mt-12" onclick="saveSettings()">SAVE CHANGES</button>
    </div>

    <div class="card mt-12">
      <div class="card-title" style="margin-bottom:14px;">LIBRARY</div>

      <div class="settings-row">
        <div>
          <div class="settings-label">Meal Library</div>
          <div class="settings-sublabel">Save meals you eat often for one-tap logging</div>
        </div>
        <button class="btn btn-secondary btn-sm" style="width:auto;" onclick="Router.navigate('meal-library')">Open</button>
      </div>
    </div>

    <div class="card mt-12">
      <div class="card-title" style="margin-bottom:14px;">DATA</div>

      <div class="settings-row">
        <div>
          <div class="settings-label">Export Data</div>
          <div class="settings-sublabel">Download all your data as JSON</div>
        </div>
        <button class="btn btn-secondary btn-sm" style="width:auto;" onclick="exportData()">Export</button>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-label">Import Data</div>
          <div class="settings-sublabel">Restore from a JSON backup</div>
        </div>
        <button class="btn btn-secondary btn-sm" style="width:auto;" onclick="document.getElementById('import-file').click()">Import</button>
        <input type="file" id="import-file" accept=".json" style="display:none;" onchange="importData(event)">
      </div>

      <div class="divider"></div>

      <div class="settings-row">
        <div>
          <div class="settings-label" style="color:var(--accent-red);">Reset All Data</div>
          <div class="settings-sublabel">Delete everything and start over</div>
        </div>
        <button class="btn btn-danger btn-sm" style="width:auto;" onclick="confirmReset()">Reset</button>
      </div>
    </div>

    <div class="card mt-12">
      <div class="card-title" style="margin-bottom:10px;">ABOUT</div>
      <div class="muted-text">RPG Fitness — A gamified fitness tracker.<br>All data stored locally on your device.</div>
    </div>
  `;

  // Wire live TDEE preview
  ['settings-height-ft','settings-height-in','settings-body-weight','settings-age',
   'settings-sex','settings-activity-level','settings-deficit'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.oninput = updateTdeePreview; el.onchange = updateTdeePreview; }
  });
  updateTdeePreview();
}

function updateTdeePreview() {
  const ftVal  = parseInt(document.getElementById('settings-height-ft')?.value) || 0;
  const inVal  = parseInt(document.getElementById('settings-height-in')?.value) || 0;
  const totalIn = ftVal * 12 + inVal;
  const weightLbs = parseFloat(document.getElementById('settings-body-weight')?.value) || 0;
  const age    = parseInt(document.getElementById('settings-age')?.value) || 0;
  const sex    = document.getElementById('settings-sex')?.value || 'male';
  const actLevel = parseFloat(document.getElementById('settings-activity-level')?.value) || 1.375;
  const deficit  = parseInt(document.getElementById('settings-deficit')?.value) || 500;
  const el = document.getElementById('tdee-preview');
  if (!el) return;
  if (!totalIn || !weightLbs || !age) {
    el.innerHTML = '<span style="color:var(--text-dim);">Enter height, weight, and age to see your TDEE estimate.</span>';
    return;
  }
  const heightCm = totalIn * 2.54;
  const weightKg = weightLbs * 0.453592;
  const offset   = sex === 'female' ? -161 : 5;
  const bmr      = 10 * weightKg + 6.25 * heightCm - 5 * age + offset;
  const tdee     = Math.round(bmr * actLevel);
  const target   = Math.max(1200, tdee - deficit);
  el.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;">
      <div style="text-align:center;">
        <div style="font-size:0.65rem;color:var(--text-dim);">BMR</div>
        <div style="font-family:var(--font-display);font-size:0.65rem;color:var(--text-primary);">${Math.round(bmr)}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:0.65rem;color:var(--text-dim);">TDEE</div>
        <div style="font-family:var(--font-display);font-size:0.65rem;color:var(--text-primary);">${tdee}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:0.65rem;color:var(--text-dim);">TARGET</div>
        <div style="font-family:var(--font-display);font-size:0.65rem;color:var(--accent-green);">${target}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:0.65rem;color:var(--text-dim);">DEFICIT</div>
        <div style="font-family:var(--font-display);font-size:0.65rem;color:var(--accent-gold);">−${deficit}</div>
      </div>
    </div>
    <div style="font-size:0.7rem;color:var(--text-dim);margin-top:6px;">Saving will set your daily calorie goal to <strong style="color:var(--text-primary);">${target} kcal</strong>.</div>
  `;
}

function setDeficit(n) {
  const el = document.getElementById('settings-deficit');
  if (el) { el.value = n; updateTdeePreview(); }
}

function saveSettings() {
  const player  = Store.getPlayer();
  const newName  = document.getElementById('settings-name')?.value.trim();
  const newCal   = parseInt(document.getElementById('settings-cal')?.value)   || player.goals.dailyCalories;
  const newProt  = parseInt(document.getElementById('settings-prot')?.value)  || player.goals.dailyProteinG;
  const newFiber = parseInt(document.getElementById('settings-fiber')?.value);
  const newWater = parseInt(document.getElementById('settings-water')?.value);
  const newWTRaw = document.getElementById('settings-weight-target')?.value;
  const newCarbs = parseInt(document.getElementById('settings-carbs')?.value) || 0;
  const newFats  = parseInt(document.getElementById('settings-fats')?.value)  || 0;
  const newSugar = parseInt(document.getElementById('settings-sugar')?.value);

  if (newName) player.name = newName;
  player.goals.dailyProteinG = newProt;
  player.goals.dailyFiberG   = isNaN(newFiber) ? (player.goals.dailyFiberG ?? 30) : newFiber;
  player.goals.dailyWaterOz  = isNaN(newWater) ? (player.goals.dailyWaterOz ?? 64) : newWater;
  player.goals.weightTargetLbs = (newWTRaw === '' || newWTRaw == null)
    ? null
    : (parseFloat(newWTRaw) || null);
  player.goals.dailyCarbsG   = newCarbs;
  player.goals.dailyFatsG    = newFats;
  player.goals.dailyAddedSugarMaxG = isNaN(newSugar) ? (player.goals.dailyAddedSugarMaxG ?? 36) : newSugar;

  // Body stats
  const ftVal  = parseInt(document.getElementById('settings-height-ft')?.value) || 0;
  const inVal  = parseInt(document.getElementById('settings-height-in')?.value) || 0;
  const totalIn = ftVal * 12 + inVal;
  const bodyWeight = parseFloat(document.getElementById('settings-body-weight')?.value) || 0;
  const age = parseInt(document.getElementById('settings-age')?.value) || 0;

  if (!player.body) player.body = {};
  player.body.heightIn      = totalIn || null;
  player.body.weightLbs     = bodyWeight || null;
  player.body.age           = age || null;
  player.body.sex           = document.getElementById('settings-sex')?.value || 'male';
  player.body.activityLevel = parseFloat(document.getElementById('settings-activity-level')?.value) || 1.375;
  player.body.deficitGoal   = parseInt(document.getElementById('settings-deficit')?.value) || 500;

  // Muscle group & stretch targets
  if (!player.goals.weeklyMuscleTargets) player.goals.weeklyMuscleTargets = {};
  player.goals.weeklyMuscleTargets.push = Math.max(0, parseInt(document.getElementById('settings-target-push')?.value) || 0);
  player.goals.weeklyMuscleTargets.pull = Math.max(0, parseInt(document.getElementById('settings-target-pull')?.value) || 0);
  player.goals.weeklyMuscleTargets.legs = Math.max(0, parseInt(document.getElementById('settings-target-legs')?.value) || 0);
  player.goals.weeklyMuscleTargets.core = Math.max(0, parseInt(document.getElementById('settings-target-core')?.value) || 0);
  player.goals.weeklyStretchTarget = Math.max(0, parseInt(document.getElementById('settings-target-stretch')?.value) || 0);

  // If body stats are complete, auto-calculate calorie goal from TDEE
  const tdeeResult = Engine.computeTDEE(player);
  if (tdeeResult) {
    player.goals.dailyCalories = tdeeResult.targetCalories;
  } else {
    player.goals.dailyCalories = newCal;
  }

  Store.setPlayer(player);
  Toast.show('Settings saved!', 'success');
}

function exportData() {
  const data = {
    exportedAt: new Date().toISOString(),
    player:       Store.getPlayer(),
    log:          Store.getLog(),
    quests:       Store.getQuests(),
    monsters:     Store.getMonsters(),
    achievements: Store.getAchievements(),
    weightLog:    Store.getWeightLog(),
    sleepLog:     Store.getSleepLog(),
    waterLog:     Store.getWaterLog(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `rpgfitness-backup-${Store.today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  Toast.show('Data exported!', 'success');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.player) throw new Error('Invalid backup file');
      if (!confirm('This will overwrite all your current data. Are you sure?')) return;

      if (data.player)       Store.setPlayer(data.player);
      if (data.log)         { /* appendLog won't work; write directly */
        localStorage.setItem('eapp_log', JSON.stringify(data.log));
      }
      if (data.quests)      Store.setQuests(data.quests);
      if (data.monsters)    Store.setMonsters(data.monsters);
      if (data.achievements)Store.setAchievements(data.achievements);
      if (data.weightLog)   localStorage.setItem('eapp_weightLog', JSON.stringify(data.weightLog));
      if (data.sleepLog)    localStorage.setItem('eapp_sleepLog',  JSON.stringify(data.sleepLog));
      if (data.waterLog)    localStorage.setItem('eapp_waterLog',  JSON.stringify(data.waterLog));

      Toast.show('Data imported successfully!', 'success');
      Router.navigate('dashboard');
    } catch (err) {
      Toast.show('Import failed: invalid file.', 'info');
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // reset input
}

function confirmReset() {
  const modal = `
    <div class="center-text">
      <div style="font-size:2.5rem;margin-bottom:12px;">⚠️</div>
      <div class="card-title" style="margin-bottom:12px;color:var(--accent-red);">RESET ALL DATA?</div>
      <div class="muted-text mb-16">This will permanently delete your character, all logs, and progress. This cannot be undone.</div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-secondary" style="flex:1;" onclick="Modal.hide()">Cancel</button>
        <button class="btn btn-danger" style="flex:1;" onclick="resetAll()">DELETE EVERYTHING</button>
      </div>
    </div>
  `;
  Modal.show(modal);
}

function resetAll() {
  Store.clearAll();
  Modal.hide();
  location.reload();
}

Router.register('settings', renderSettings);
