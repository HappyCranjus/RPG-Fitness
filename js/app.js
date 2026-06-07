/* ─────────────────────────────────────────────
   App entry point — event bus, modal, toast,
   service worker registration, first-run,
   persistent stat header + countdown ticker.
   ───────────────────────────────────────────── */

/* ── Event bus ───────────────────────────────── */
const Bus = (() => {
  const listeners = {};
  return {
    on(event, fn)  { (listeners[event] = listeners[event] || []).push(fn); },
    emit(event, d) { (listeners[event] || []).forEach(fn => fn(d)); },
  };
})();

/* ── Modal ───────────────────────────────────── */
const Modal = (() => {
  let overlay, box, content;

  function init() {
    overlay = document.getElementById('modal-overlay');
    box     = document.getElementById('modal-box');
    content = document.getElementById('modal-content');

    overlay.addEventListener('click', e => {
      if (e.target === overlay) hide();
    });
  }

  function show(html) {
    content.innerHTML = html;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function hide() {
    overlay.classList.add('hidden');
    content.innerHTML = '';
    document.body.style.overflow = '';
  }

  return { init, show, hide };
})();

/* ── Toast ───────────────────────────────────── */
const Toast = (() => {
  function show(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = type === 'achievement' ? '🏆' : type === 'success' ? '✅' : 'ℹ️';
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-text">${escHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  return { show };
})();

/* ── Onboarding ──────────────────────────────── */
function showOnboarding() {
  const nav = document.getElementById('bottom-nav');
  nav.classList.add('hidden');

  const container = document.getElementById('screen-container');
  container.style.paddingBottom = '24px';

  function renderStep1() {
    container.innerHTML = `
      <div class="onboarding">
        <div class="onboarding-logo">⚔️</div>
        <div class="onboarding-title">RPG FITNESS</div>
        <div class="onboarding-subtitle">
          Turn every workout into an adventure.<br>
          Fight monsters. Level up. Win.
        </div>
        <div class="onboarding-form">
          <div class="form-group">
            <label class="form-label">What's your name, adventurer?</label>
            <input id="onboard-name" placeholder="Enter your name" maxlength="30" autocomplete="off">
          </div>
          <button class="btn btn-primary mt-16" id="onboard-next-1">BEGIN JOURNEY →</button>
        </div>
      </div>
    `;

    document.getElementById('onboard-next-1').onclick = () => {
      const name = document.getElementById('onboard-name').value.trim();
      if (!name) {
        Toast.show('Enter your name to continue!', 'info');
        return;
      }
      renderStep2(name);
    };

    document.getElementById('onboard-name').onkeydown = e => {
      if (e.key === 'Enter') document.getElementById('onboard-next-1').click();
    };

    setTimeout(() => document.getElementById('onboard-name')?.focus(), 100);
  }

  function renderStep2(name) {
    container.innerHTML = `
      <div class="onboarding">
        <div class="onboarding-logo">🎯</div>
        <div class="onboarding-title" style="font-size:0.7rem;">SET YOUR GOALS</div>
        <div class="onboarding-subtitle">
          These targets shape your daily Discipline tier — the multiplier on
          how fast your stats decay. Hit your goals and stats hold; ghost the
          day and they slip away faster.
        </div>
        <div class="onboarding-form">
          <div class="form-group">
            <label class="form-label">Daily Calorie Goal</label>
            <div class="input-with-unit">
              <input type="number" id="onboard-cal" value="2000" min="500" max="9999" inputmode="numeric">
              <span class="input-unit">kcal</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Daily Protein Goal</label>
            <div class="input-with-unit">
              <input type="number" id="onboard-prot" value="150" min="10" max="999" inputmode="numeric">
              <span class="input-unit">g</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Max Added Sugar (per day)</label>
            <div class="input-with-unit">
              <input type="number" id="onboard-sugar" value="36" min="0" max="500" inputmode="numeric">
              <span class="input-unit">g</span>
            </div>
            <div style="font-size:0.7rem;color:var(--text-dim);margin-top:4px;line-height:1.4;">
              Going over the limit deals HP damage (2 HP per gram over).
              Staying under = +1 discipline credit.
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="margin:0;">
              <label class="form-label">Carbs (optional)</label>
              <div class="input-with-unit">
                <input type="number" id="onboard-carbs" value="0" min="0" max="999" inputmode="numeric">
                <span class="input-unit">g</span>
              </div>
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">Fats (optional)</label>
              <div class="input-with-unit">
                <input type="number" id="onboard-fats" value="0" min="0" max="999" inputmode="numeric">
                <span class="input-unit">g</span>
              </div>
            </div>
          </div>
          <button class="btn btn-primary mt-16" id="onboard-next-2">MEET YOUR FIRST ENEMY →</button>
        </div>
      </div>
    `;

    document.getElementById('onboard-next-2').onclick = () => {
      const cal   = parseInt(document.getElementById('onboard-cal').value)   || 2000;
      const prot  = parseInt(document.getElementById('onboard-prot').value)  || 150;
      const sugar = parseInt(document.getElementById('onboard-sugar').value);
      const carbs = parseInt(document.getElementById('onboard-carbs').value) || 0;
      const fats  = parseInt(document.getElementById('onboard-fats').value)  || 0;
      finishOnboarding(name, cal, prot, carbs, fats, isNaN(sugar) ? 36 : sugar);
    };
  }

  function finishOnboarding(name, cal, prot, carbs, fats, sugarMax) {
    const player = Store.makePlayer(name, cal, prot, carbs, fats, sugarMax);
    Store.setPlayer(player);

    const today     = Store.today();
    const weekStart = Store.weekStart();
    Quests.refresh(today, weekStart);
    Monsters.spawnNext(player);

    const monster = Store.getMonsters().active;
    container.innerHTML = `
      <div class="onboarding">
        <div class="onboarding-logo">${escHtml(monster.art)}</div>
        <div class="onboarding-title" style="font-size:0.6rem;">A FOUL BEAST APPEARS!</div>
        <div style="font-size:1.1rem;font-weight:700;margin-bottom:8px;">${escHtml(monster.name)}</div>
        <div class="onboarding-subtitle">"${escHtml(monster.flavorText)}"</div>
        <div style="width:100%;max-width:360px;">
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px;">
            Log workouts and meals to deal damage and defeat it. Earn XP, level up your stats, and complete quests!
          </div>
          <button class="btn btn-primary" id="onboard-start">⚔️ BEGIN ADVENTURE</button>
        </div>
      </div>
    `;

    document.getElementById('onboard-start').onclick = () => {
      container.style.paddingBottom = '';
      nav.classList.remove('hidden');
      const statHdr = document.getElementById('stat-header');
      statHdr.classList.remove('hidden');
      updateStatHeader();
      startHeaderCountdownTicker();
      Router.init();
    };
  }

  renderStep1();
}

/* ── Persistent stat header ──────────────────── */
function updateStatHeader() {
  const player = Store.getPlayer();
  const hdr    = document.getElementById('stat-header');
  if (!player || !hdr || hdr.classList.contains('hidden')) return;

  Engine.updateEnergyRegen(player);
  Store.setPlayer(player);

  const { STR, AGI, VIT } = player.stats;
  const hp    = player.hp    ?? player.hpMax ?? 100;
  const hpMax = player.hpMax ?? (100 + VIT * 15);
  const hpPct = Math.max(0, Math.min(100, (hp / hpMax) * 100));

  const energy    = Math.floor(player.energy ?? player.maxEnergy ?? 35);
  const maxEnergy = player.maxEnergy ?? (30 + AGI * 5);
  const energyPct = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));

  const rank = (typeof Ranks !== 'undefined') ? Ranks.getRank(player) : null;
  const nameLevelEl = document.getElementById('hdr-name-level');
  if (rank) {
    nameLevelEl.innerHTML = `${escHtml(player.name)} <span class="hdr-rank-chip" style="color:${rank.color};border-color:${rank.color};">${rank.tier}</span> <span style="color:var(--text-muted);">Lv${player.level}</span>`;
  } else {
    nameLevelEl.textContent = `${player.name}  Lv${player.level}`;
  }
  document.getElementById('hdr-stats').textContent      = `STR:${STR} AGI:${AGI} VIT:${VIT}`;
  document.getElementById('hdr-hp-fill').style.width    = hpPct + '%';
  document.getElementById('hdr-hp-text').textContent    = `${hp}/${hpMax}`;
  document.getElementById('hdr-energy-fill').style.width   = energyPct + '%';
  document.getElementById('hdr-energy-text').textContent   = `${energy}/${maxEnergy}`;

  const fill = document.getElementById('hdr-hp-fill');
  if (hpPct > 60) {
    fill.style.background = 'linear-gradient(90deg, #1a7a32, var(--accent-green))';
  } else if (hpPct > 30) {
    fill.style.background = 'linear-gradient(90deg, #8b7a00, #ffcc00)';
  } else {
    fill.style.background = 'linear-gradient(90deg, var(--accent-red-dim), var(--accent-red))';
  }

  if (player.knockedOut) {
    hdr.classList.add('knocked-out');
  } else {
    hdr.classList.remove('knocked-out');
  }

  // Discipline tier chip
  const today    = Store.today();
  const todayLog = Store.getLog().filter(e => e.date === today);
  const tierInfo = Engine.disciplineTier(player, todayLog);
  const tierEl   = document.getElementById('hdr-tier');
  if (tierEl) {
    tierEl.textContent       = tierInfo.tier.short;
    tierEl.style.color       = tierInfo.tier.color;
    tierEl.style.borderColor = tierInfo.tier.color;
    tierEl.title             = `Discipline: ${tierInfo.tier.label} (${tierInfo.points}/${tierInfo.maxPoints ?? Engine.MAX_DIS_POINTS}) — decay × ${tierInfo.tier.mult.toFixed(2)}`;
  }

  updateHeaderCountdowns(player);
  updateFedChip();
}

function updateHeaderCountdowns(player) {
  const statNextEl = document.getElementById('hdr-stat-next');
  const hpNextEl   = document.getElementById('hdr-hp-next');
  const now = Date.now();
  if (statNextEl) {
    const ms = Engine.msUntilNextStatTick(player, now);
    statNextEl.textContent = `⏳ stat ${formatMs(ms)}`;
  }
  if (hpNextEl) {
    const ms = Engine.msUntilNextHpTick(player, now);
    hpNextEl.textContent = `🩸 ${formatMs(ms)}`;
  }
}

function formatMs(ms) {
  if (!isFinite(ms) || ms <= 0) return '—';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h${String(m % 60).padStart(2,'0')}m`;
  }
  return `${m}:${String(s).padStart(2,'0')}`;
}

let _headerCountdownTimer = null;
function startHeaderCountdownTicker() {
  if (_headerCountdownTimer) clearInterval(_headerCountdownTimer);
  _headerCountdownTimer = setInterval(() => {
    const player = Store.getPlayer();
    if (!player) return;
    updateHeaderCountdowns(player);
  }, 30 * 1000);
}

function updateFedChip() {
  const el = document.getElementById('hdr-fed');
  if (!el) return;
  const log = Store.getLog();
  let latestMealTs = 0;
  for (const entry of log) {
    if (entry.meals && entry.meals.length > 0 && entry.timestamp > latestMealTs) {
      latestMealTs = entry.timestamp;
    }
  }
  if (!latestMealTs) {
    el.textContent = '🍽 Not yet fed';
    el.className = 'hdr-fed hdr-fed-warn';
    return;
  }
  const hoursSince = Math.floor((Date.now() - latestMealTs) / 3600000);
  el.textContent = hoursSince === 0
    ? '🍽 Fed just now'
    : `🍽 Fed ${hoursSince}h ago`;
  let cls = 'hdr-fed';
  if (hoursSince >= 16)      cls += ' hdr-fed-danger';
  else if (hoursSince >= 8)  cls += ' hdr-fed-warn';
  el.className = cls;
}

Bus.on('stats-updated', updateStatHeader);

/* ── Service worker registration ─────────────── */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }
}

/* ── Bootstrap ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  Modal.init();
  registerSW();

  if (Store.isFirstRun()) {
    showOnboarding();
  } else {
    const nav = document.getElementById('bottom-nav');
    nav.classList.remove('hidden');
    const statHdr = document.getElementById('stat-header');
    statHdr.classList.remove('hidden');

    const today     = Store.today();
    const weekStart = Store.weekStart();
    const player    = Store.getPlayer();
    const rollResult  = Engine.rolloverCycleIfNeeded(player, today);
    const decayResult = Engine.applyStatDecay(player, today);

    const activeMonster = Store.getMonsters().active;
    const survival = Engine.applySurvivalTicks(player, activeMonster, Date.now());
    Store.setPlayer(player);
    Store.recordStatSnapshot(player, today);

    const priorBonus = Store.getBonus();
    const activeBonus = Engine.getActiveBonus(Date.now());
    const bonusJustRolled = priorBonus && activeBonus.itemId !== priorBonus.itemId
                          && priorBonus.windowEnd <= Date.now();

    if (rollResult.rolled) {
      Toast.show('🔄 New 2-week cycle started! Level reset; stats preserved.', 'info');
    }
    if (Object.keys(decayResult.decayed).length > 0) {
      const lost = Object.entries(decayResult.decayed).map(([s, v]) => `${s}-${v}`).join(' ');
      Toast.show(`💀 Stat decay (${decayResult.tier.label}): ` + lost, 'info');
    }
    if (survival.attack && survival.attack.landed > 0 && activeMonster && !survival.knockedOut) {
      const name = activeMonster.name || 'Monster';
      Toast.show(`💢 ${name} struck ${survival.attack.landed}× (-${survival.attack.damage} HP)`, 'info');
    }
    if (survival.attack && survival.attack.dodged > 0) {
      Toast.show(`🌀 Dodged ${survival.attack.dodged}× (AGI shielded you)`, 'success');
    }
    if (survival.decay.damage > 0 && !survival.knockedOut) {
      Toast.show(`⏳ Passive HP drain: -${survival.decay.damage} HP. Eat something!`, 'info');
    }
    if (survival.knockedOut) {
      Toast.show('💀 You collapsed! Eat to recover.', 'info');
    }
    if (bonusJustRolled) {
      Toast.show(`⭐ New bonus: ${activeBonus.icon} ${activeBonus.label} — +25% for 6h`, 'success');
    }

    updateStatHeader();
    startHeaderCountdownTicker();

    Quests.refresh(today, weekStart);

    const monsters = Store.getMonsters();
    if (!monsters.active) {
      Monsters.spawnNext(Store.getPlayer());
    }

    Router.init();
  }
});
