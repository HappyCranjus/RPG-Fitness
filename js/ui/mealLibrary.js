/* ─────────────────────────────────────────────
   Meal Library screen — manage saved meal
   templates (Protein Bar, Coffee, etc.) used by
   the Log screen's quick-add picker.
   ───────────────────────────────────────────── */

const MEAL_LIBRARY_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

// In-memory edit state. null = list view; otherwise = the template being edited.
let _mealLibraryEditing = null;

function renderMealLibrary(container) {
  if (_mealLibraryEditing) {
    renderMealLibraryEditForm(container, _mealLibraryEditing);
  } else {
    renderMealLibraryList(container);
  }
}

function renderMealLibraryList(container) {
  const library = Store.getMealLibrary();

  const rows = library.length === 0
    ? `<div class="muted-text" style="padding:18px 0;text-align:center;">No templates yet. Tap below to add your first one.</div>`
    : library.map(t => {
        const macros = [
          `${t.calories || 0} cal`,
          t.proteinG ? `${t.proteinG}p` : null,
          t.fiberG   ? `${t.fiberG}fb`  : null,
          t.carbsG   ? `${t.carbsG}c`   : null,
          t.fatsG    ? `${t.fatsG}f`    : null,
          t.addedSugarG ? `${t.addedSugarG}🍬` : null,
        ].filter(Boolean).join(' · ');
        const typeLabel = t.mealType
          ? t.mealType.charAt(0).toUpperCase() + t.mealType.slice(1)
          : '—';
        return `
          <div class="settings-row" style="gap:10px;">
            <div style="flex:1;min-width:0;">
              <div class="settings-label" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(t.name || '(unnamed)')}</div>
              <div class="settings-sublabel">${escHtml(macros)} · ${escHtml(typeLabel)}</div>
            </div>
            <button class="btn btn-secondary btn-sm" style="width:auto;" onclick="editMealTemplate('${t.id}')">✎</button>
            <button class="btn btn-danger btn-sm" style="width:auto;" onclick="deleteMealTemplate('${t.id}')">✕</button>
          </div>
        `;
      }).join('');

  container.innerHTML = `
    <div class="screen-title">MEAL LIBRARY</div>
    <div class="muted-text mb-12" style="line-height:1.5;">
      Save meals you eat often — like a protein bar or a cup of coffee — so you can
      add them to a log entry in one tap from the Meals section.
    </div>

    <div class="card">
      <div class="card-title" style="margin-bottom:10px;">YOUR TEMPLATES (${library.length})</div>
      ${rows}
    </div>

    <button class="btn btn-primary mt-12" onclick="addNewMealTemplate()">+ ADD NEW TEMPLATE</button>
    <button class="btn btn-secondary mt-8" onclick="Router.navigate('settings')">← BACK TO SETTINGS</button>
  `;
}

function renderMealLibraryEditForm(container, draft) {
  const typeOpts = MEAL_LIBRARY_TYPES.map(t =>
    `<option value="${t}" ${t === (draft.mealType || 'breakfast') ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`
  ).join('');

  const isNew = !draft.id;

  container.innerHTML = `
    <div class="screen-title">${isNew ? 'NEW' : 'EDIT'} MEAL TEMPLATE</div>

    <div class="card">
      <div class="form-group">
        <label class="form-label">Name</label>
        <input id="ml-name" placeholder="e.g. Protein Bar" maxlength="40" value="${escHtml(draft.name || '')}">
      </div>

      <div class="form-row">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Calories</label>
          <div class="input-with-unit">
            <input type="number" id="ml-cal" value="${draft.calories || ''}" placeholder="0" min="0">
            <span class="input-unit">kcal</span>
          </div>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Protein</label>
          <div class="input-with-unit">
            <input type="number" id="ml-prot" value="${draft.proteinG || ''}" placeholder="0" min="0">
            <span class="input-unit">g</span>
          </div>
        </div>
      </div>

      <div class="form-group mt-8">
        <label class="form-label">Fiber</label>
        <div class="input-with-unit">
          <input type="number" id="ml-fiber" value="${draft.fiberG || ''}" placeholder="0" min="0">
          <span class="input-unit">g</span>
        </div>
      </div>

      <details style="margin-top:8px;">
        <summary style="cursor:pointer;font-size:0.78rem;color:var(--text-muted);">Other macros (optional)</summary>
        <div class="form-row mt-8">
          <div class="form-group" style="margin:0;">
            <label class="form-label">Carbs</label>
            <div class="input-with-unit">
              <input type="number" id="ml-carbs" value="${draft.carbsG || ''}" placeholder="0" min="0">
              <span class="input-unit">g</span>
            </div>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Fats</label>
            <div class="input-with-unit">
              <input type="number" id="ml-fats" value="${draft.fatsG || ''}" placeholder="0" min="0">
              <span class="input-unit">g</span>
            </div>
          </div>
        </div>

        <div class="form-group mt-12">
          <label class="form-label">Added Sugar</label>
          <div class="input-with-unit">
            <input type="number" id="ml-sugar" value="${draft.addedSugarG || ''}" placeholder="0" min="0">
            <span class="input-unit">g</span>
          </div>
        </div>
      </details>

      <div class="form-group">
        <label class="form-label">Default meal type</label>
        <select id="ml-type">${typeOpts}</select>
      </div>

      <button class="btn btn-primary" onclick="saveMealTemplate()">SAVE TEMPLATE</button>
      <button class="btn btn-secondary mt-8" onclick="cancelMealTemplateEdit()">CANCEL</button>
    </div>
  `;

  setTimeout(() => document.getElementById('ml-name')?.focus(), 80);
}

/* ── Action handlers ──────────────────────────── */

function addNewMealTemplate() {
  _mealLibraryEditing = {
    id: null,
    name: '',
    calories: 0,
    proteinG: 0,
    fiberG: 0,
    carbsG: 0,
    fatsG: 0,
    addedSugarG: 0,
    mealType: 'breakfast',
  };
  Router.refresh();
}

function editMealTemplate(id) {
  const t = Store.getMealLibrary().find(x => x.id === id);
  if (!t) return;
  _mealLibraryEditing = { ...t };
  Router.refresh();
}

function deleteMealTemplate(id) {
  const t = Store.getMealLibrary().find(x => x.id === id);
  if (!t) return;
  if (!confirm(`Delete "${t.name}" from your library?`)) return;
  const next = Store.getMealLibrary().filter(x => x.id !== id);
  Store.setMealLibrary(next);
  Toast.show('Template deleted', 'success');
  Router.refresh();
}

function saveMealTemplate() {
  const name = document.getElementById('ml-name')?.value.trim();
  if (!name) {
    Toast.show('Give the template a name first.', 'info');
    return;
  }
  const draft = {
    id:          _mealLibraryEditing.id || ('ml_' + Date.now()),
    name,
    calories:    parseInt(document.getElementById('ml-cal')?.value)   || 0,
    proteinG:    parseInt(document.getElementById('ml-prot')?.value)  || 0,
    fiberG:      parseInt(document.getElementById('ml-fiber')?.value) || 0,
    carbsG:      parseInt(document.getElementById('ml-carbs')?.value) || 0,
    fatsG:       parseInt(document.getElementById('ml-fats')?.value)  || 0,
    addedSugarG: parseInt(document.getElementById('ml-sugar')?.value) || 0,
    mealType:    document.getElementById('ml-type')?.value || 'breakfast',
  };

  const library = Store.getMealLibrary();
  const existingIdx = library.findIndex(x => x.id === draft.id);
  if (existingIdx >= 0) library[existingIdx] = draft;
  else                  library.push(draft);
  Store.setMealLibrary(library);

  _mealLibraryEditing = null;
  Toast.show('Template saved!', 'success');
  Router.refresh();
}

function cancelMealTemplateEdit() {
  _mealLibraryEditing = null;
  Router.refresh();
}

Router.register('meal-library', renderMealLibrary);
