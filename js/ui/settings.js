/* ─────────────────────────────────────────────
   Settings screen
   ───────────────────────────────────────────── */

function renderSettings(container) {
  const player = Store.getPlayer();

  container.innerHTML = `
    <div class="screen-title">SETTINGS</div>

    <div class="card">
      <div class="card-title" style="margin-bottom:14px;">PROFILE</div>

      <div class="form-group">
        <label class="form-label">Player Name</label>
        <input id="settings-name" value="${escHtml(player.name)}" maxlength="30">
      </div>

      <div class="form-group">
        <label class="form-label">Daily Calorie Goal</label>
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

      <div class="form-group">
        <label class="form-label">Max Added Sugar (per day)</label>
        <div class="input-with-unit">
          <input type="number" id="settings-sugar" value="${player.goals.dailyAddedSugarMaxG ?? 36}" min="0" max="500">
          <span class="input-unit">g</span>
        </div>
        <div class="muted-text" style="font-size:0.72rem;margin-top:4px;line-height:1.4;">
          Going over deals HP damage (${Engine.SUGAR_DMG_PER_GRAM} HP per gram over). Staying under earns a discipline credit.
        </div>
      </div>

      <div class="form-row">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Carbs Goal (optional)</label>
          <div class="input-with-unit">
            <input type="number" id="settings-carbs" value="${player.goals.dailyCarbsG || 0}" min="0" max="999">
            <span class="input-unit">g</span>
          </div>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Fats Goal (optional)</label>
          <div class="input-with-unit">
            <input type="number" id="settings-fats" value="${player.goals.dailyFatsG || 0}" min="0" max="999">
            <span class="input-unit">g</span>
          </div>
        </div>
      </div>
      <div class="muted-text" style="font-size:0.74rem;margin-top:-4px;margin-bottom:10px;">
        Carbs and fats are tracked for your reference — they don't affect the discipline tier directly.
      </div>

      <button class="btn btn-primary" onclick="saveSettings()">SAVE CHANGES</button>
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
}

function saveSettings() {
  const player  = Store.getPlayer();
  const newName  = document.getElementById('settings-name')?.value.trim();
  const newCal   = parseInt(document.getElementById('settings-cal')?.value)   || player.goals.dailyCalories;
  const newProt  = parseInt(document.getElementById('settings-prot')?.value)  || player.goals.dailyProteinG;
  const newCarbs = parseInt(document.getElementById('settings-carbs')?.value) || 0;
  const newFats  = parseInt(document.getElementById('settings-fats')?.value)  || 0;
  const newSugar = parseInt(document.getElementById('settings-sugar')?.value);

  if (newName) player.name = newName;
  player.goals.dailyCalories = newCal;
  player.goals.dailyProteinG = newProt;
  player.goals.dailyCarbsG   = newCarbs;
  player.goals.dailyFatsG    = newFats;
  player.goals.dailyAddedSugarMaxG = isNaN(newSugar) ? (player.goals.dailyAddedSugarMaxG ?? 36) : newSugar;

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
