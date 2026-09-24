/* ─────────────────────────────────────────────
   Combat screen — monster + ability system
   ───────────────────────────────────────────── */

function renderCombat(container) {
  const player   = Store.getPlayer();
  const monsters = Store.getMonsters();
  const monster  = monsters.active;
  const attacks  = Store.getAttacks();
  const today    = Store.today();
  const todayLogs = Store.getLog().filter(e => e.date === today);
  const hofEntries = monsters.defeated.slice().reverse();

  container.innerHTML = `
    <div class="screen-title">COMBAT</div>

    ${monster ? renderActiveMonster(monster, player, todayLogs) : renderNoActiveMonster()}

    <!-- Attack history -->
    <div class="card mt-12">
      <div class="card-title" style="margin-bottom:10px;">ATTACK LOG</div>
      ${attacks.length === 0
        ? `<div class="muted-text">No attacks yet. Choose an ability to deal damage!</div>`
        : attacks.slice(0, 20).map(a => `
            <div class="combat-log-entry">
              <div>
                <div style="font-size:0.85rem;font-weight:600;">${escHtml(a.monsterName || 'Monster')}</div>
                <div class="combat-log-date">${escHtml(a.date)}
                  ${a.abilityName ? ` · ${escHtml(a.abilityName)}` : ''}
                  ${a.matchType === 'weakness' ? ' ✓ weakness' : a.matchType === 'resistance' ? ' ✗ resist' : ''}
                  ${a.statusApplied ? ` · ${escHtml(a.statusApplied)}` : ''}
                </div>
              </div>
              <div class="combat-log-dmg">${a.dmg > 0 ? `-${a.dmg} ❤️` : a.healAmt > 0 ? `+${a.healAmt} HP` : a.statusApplied ? `✨ ${escHtml(a.statusApplied)}` : '—'}</div>
            </div>
          `).join('')
      }
    </div>

    <!-- Hall of fame -->
    ${hofEntries.length > 0 ? `
    <div class="card mt-12">
      <div class="card-title" style="margin-bottom:10px;">HALL OF FAME (${monsters.killCount} killed)</div>
      ${hofEntries.map((d, i) => `
        <div class="hof-entry">
          <div class="hof-rank">${i+1}</div>
          <span style="font-size:1.4rem;">${escHtml(d.art)}</span>
          <div style="flex:1;">
            <div style="font-size:0.88rem;font-weight:600;">${escHtml(d.name)}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);">${escHtml(d.defeatedAt.slice(0,10))}</div>
          </div>
          <div style="font-size:0.72rem;color:var(--accent-gold);text-align:right;">
            +${d.reward.xp}XP
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
  `;

  // Bind ability buttons
  if (monster) {
    document.querySelectorAll('.ability-btn[data-ability-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const abilityId = btn.dataset.abilityId;
        if (!btn.disabled) handleUseAbility(abilityId, monster);
      });
    });
    const shopBtn = document.getElementById('shop-btn');
    if (shopBtn) shopBtn.addEventListener('click', () => showAbilityShop(Store.getPlayer()));
  }
}

/* ── Active monster card ──────────────────────── */

function renderActiveMonster(monster, player, todayLogs) {
  const hpPct    = Math.max(0, Math.round((monster.hpCurrent / monster.hpMax) * 100));
  const weakStr  = (monster.weaknesses || []).map(capitalizeType).join(', ') || '—';
  const resStr   = (monster.resistances || []).map(capitalizeType).join(', ') || '—';

  const energy    = Math.floor(player.energy || 0);
  const maxEnergy = player.maxEnergy || 35;
  const energyPct = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));
  const regenRate = (3 + player.stats.AGI * 0.5).toFixed(1);

  const { bonusText, bonusClass } = getAttackBonusInfo(player, monster, todayLogs);
  const stunned = Engine.isPlayerStunned(player, Date.now());

  return `
    <div class="monster-card" style="cursor:default;">
      <div class="monster-header">
        <span class="monster-art" style="font-size:2.5rem;">${escHtml(monster.art)}</span>
        <div class="monster-info">
          <div class="monster-name">${escHtml(monster.name)}</div>
          <div class="monster-tier">Tier ${Monsters.tierLabel(monster.tier)}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;font-style:italic;">"${escHtml(monster.flavorText)}"</div>
        </div>
      </div>

      <div class="monster-hp-label">
        <span>HP</span>
        <span class="monster-hp-value">${monster.hpCurrent} / ${monster.hpMax}</span>
      </div>
      <div class="progress-track" style="height:14px;">
        <div class="progress-fill progress-fill-red" style="width:${hpPct}%"></div>
      </div>

      ${renderMonsterStatusPills(monster)}

      ${monster.lastMove ? `
      <div class="last-enemy-move">
        Last action: <strong>${escHtml(monster.lastMove.name)}</strong>
        ${monster.lastMove.damage > 0 ? `→ -${monster.lastMove.damage} HP` : ''}
        ${monster.lastMove.effects && monster.lastMove.effects.length ? `· ${monster.lastMove.effects.map(escHtml).join(', ')}` : ''}
      </div>` : ''}

      <div class="monster-tags mt-8">
        <span class="tag tag-weak">⬆ Weak: ${escHtml(weakStr)}</span>
        ${resStr !== '—' ? `<span class="tag tag-res">⬇ Resists: ${escHtml(resStr)}</span>` : ''}
      </div>
    </div>

    <!-- Player status effects -->
    ${renderPlayerStatusPills(player)}

    <!-- Energy bar -->
    <div class="card" style="padding:12px 16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:0.78rem;color:var(--text-muted);">⚡ ENERGY</span>
        <span style="font-family:var(--font-display);font-size:0.42rem;color:var(--accent-blue);">${energy} / ${maxEnergy}</span>
      </div>
      <div class="progress-track" style="height:8px;">
        <div class="progress-fill energy-fill" style="width:${energyPct}%"></div>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:5px;">
        Regens ${regenRate}/hr${stunned ? ' <span style="color:var(--accent-red);">×0.5 (stunned)</span>' : ''}
      </div>
    </div>

    <!-- Attack bonus indicator -->
    <div class="attack-bonus-indicator ${bonusClass}">
      ${bonusText}
    </div>

    <!-- Stun banner -->
    ${stunned ? `<div class="stun-banner">⚡ STUNNED — only Power Strike available</div>` : ''}

    <!-- Ability grid -->
    <div class="ability-grid-header">
      <span style="font-size:0.72rem;color:var(--text-muted);">ABILITIES</span>
      <button class="btn-shop" id="shop-btn">🪙 SHOP (${player.gold} gold)</button>
    </div>
    ${renderAbilityGrid(player, monster, todayLogs)}

    <div id="attack-result-area" style="min-height:40px;"></div>
  `;
}

/* ── Status effect pills ─────────────────────── */

function renderPlayerStatusPills(player) {
  const effects = (player.statusEffects || []);
  if (effects.length === 0) return '';
  const now = Date.now();
  const pills = effects.map(e => {
    const icons   = { poison: '☠️', stun: '⚡', exhaust: '😮‍💨', dmg_down: '⬇️', def_down: '🔓', def_up: '🛡', dmg_up: '🔥' };
    const labels  = { poison: 'Poisoned', stun: 'Stunned', exhaust: 'Exhausted', dmg_down: 'Weakened', def_down: 'Exposed', def_up: 'Shielded', dmg_up: 'Fury' };
    const icon    = icons[e.type]  || '❓';
    const label   = labels[e.type] || e.type;
    const detail  = e.type === 'stun'
      ? `${Math.ceil(Math.max(0, (e.expiresAt - now) / 60000))}m`
      : `${e.ticksRemaining}t`;
    const isBad   = ['poison','stun','exhaust','dmg_down','def_down'].includes(e.type);
    const color   = isBad ? 'var(--accent-red)' : 'var(--accent-green)';
    return `<span class="status-pill" style="border-color:${color};color:${color};">${icon} ${label} (${detail})</span>`;
  }).join('');
  return `<div class="status-pills-row player-effects"><span style="font-size:0.65rem;color:var(--text-muted);margin-right:4px;">YOU:</span>${pills}</div>`;
}

function renderMonsterStatusPills(monster) {
  const effects = (monster.statusEffects || []);
  if (effects.length === 0) return '';
  const icons   = { def_up: '🛡', dmg_up: '🔥', poison: '☠️', stun: '⚡', def_down: '🔓', dmg_down: '⬇️' };
  const labels  = { def_up: 'Armored', dmg_up: 'Enraged', poison: 'Poisoned', stun: 'Stunned', def_down: 'Exposed', dmg_down: 'Weakened' };
  const pills = effects.map(e => {
    const icon  = icons[e.type]  || '❓';
    const label = labels[e.type] || e.type;
    const ticks = e.type === 'stun' ? `${e.ticksRemaining}t` : `${e.ticksRemaining}t`;
    const isBad = ['poison','stun','def_down','dmg_down'].includes(e.type);
    const color = isBad ? 'var(--accent-red)' : 'var(--accent-blue)';
    return `<span class="status-pill" style="border-color:${color};color:${color};">${icon} ${label} (${ticks})</span>`;
  }).join('');
  return `<div class="status-pills-row monster-effects"><span style="font-size:0.65rem;color:var(--text-muted);margin-right:4px;">ENEMY:</span>${pills}</div>`;
}

/* ── Ability grid ────────────────────────────── */

function renderAbilityGrid(player, monster, todayLogs) {
  if (typeof ABILITY_CATALOG === 'undefined') return `<div class="muted-text">Abilities not loaded.</div>`;

  const ownedIds = player.abilities || ['ab_strike'];
  const stunned  = Engine.isPlayerStunned(player, Date.now());

  const typeColors = {
    attack:   'var(--accent-red)',
    heal:     'var(--accent-green)',
    poison:   '#9b59b6',
    stun:     'var(--accent-gold)',
    def_up:   'var(--accent-blue)',
    def_down: '#e67e22',
    dmg_up:   'var(--accent-red)',
    exhaust:  'var(--text-muted)',
    cleanse:  'var(--accent-green)',
  };

  const abilityCards = ownedIds.map(abilityId => {
    const ab = ABILITY_CATALOG.find(a => a.id === abilityId);
    if (!ab) return '';

    // Compute energy cost with exhaust
    const exhaustEff = (player.statusEffects || []).find(e => e.type === 'exhaust');
    const costMult   = exhaustEff ? (exhaustEff.energyCostMult || 1.5) : 1.0;
    const actualCost = Math.ceil(ab.energyCost * costMult);
    const canAfford  = (player.energy || 0) >= actualCost;
    const isStunLocked = stunned && abilityId !== 'ab_strike';
    const disabled   = !canAfford || isStunLocked;

    // Estimate damage for attack abilities
    let dmgPreview = '';
    if (ab.effect && ab.effect.baseDmgMult && monster) {
      const loggedTypes = getTodayLoggedTypes(todayLogs);
      const weaknesses  = monster.weaknesses || [];
      const matchesWeak = [...loggedTypes].some(t => weaknesses.includes(t));
      const typeMult    = matchesWeak ? (1.5 + player.stats.STR * 0.03) : 1.0;
      const monsterDefMult = Engine.getMonsterDefMult ? Engine.getMonsterDefMult(monster) : 1.0;
      const playerDmgMult  = 1.0; // simplified for preview
      const est = Math.floor(player.stats.STR * 5 * ab.effect.baseDmgMult * typeMult * playerDmgMult * monsterDefMult);
      dmgPreview = `<span class="ability-dmg">~${est} dmg</span>`;
    } else if (ab.effect && ab.effect.healFlat) {
      dmgPreview = `<span class="ability-dmg" style="color:var(--accent-green);">+${ab.effect.healFlat} HP</span>`;
    } else if (ab.type === 'cleanse') {
      dmgPreview = `<span class="ability-dmg" style="color:var(--accent-green);">removes debuffs</span>`;
    }

    const color = typeColors[ab.type] || 'var(--text-muted)';
    const costLabel = costMult > 1 ? `<span style="color:var(--accent-red);">${actualCost}⚡</span>` : `${actualCost}⚡`;

    return `
      <button
        class="ability-btn"
        data-ability-id="${ab.id}"
        style="border-color:${color};${disabled ? 'opacity:0.4;pointer-events:none;' : ''}"
        ${disabled ? 'disabled' : ''}
        title="${escHtml(ab.description)}"
      >
        <span class="ability-icon">${ab.icon}</span>
        <span class="ability-name">${escHtml(ab.name)}</span>
        <span class="ability-cost">${costLabel}</span>
        ${dmgPreview}
      </button>
    `;
  }).join('');

  return `<div class="ability-grid">${abilityCards}</div>`;
}

/* ── Ability use handler ─────────────────────── */

function handleUseAbility(abilityId, monster) {
  const player    = Store.getPlayer();
  const today     = Store.today();
  const todayLogs = Store.getLog().filter(e => e.date === today);

  const result = Engine.useAbility(abilityId, player, monster, todayLogs);

  if (!result.success) {
    if (result.reason === 'stunned')   { Toast.show('⚡ You are stunned — only Power Strike is available!', 'info'); return; }
    if (result.reason === 'no_energy') { Toast.show(`Not enough energy! Need ${result.cost}⚡.`, 'info'); return; }
    if (result.reason === 'not_owned') { Toast.show('You haven\'t learned that ability yet.', 'info'); return; }
    Toast.show('Cannot use ability right now.', 'info');
    return;
  }

  // Save updated player and monster
  Store.setPlayer(player);
  const monsters = Store.getMonsters();
  monsters.active = monster;
  Store.setMonsters(monsters);

  // Log the attack
  Store.appendAttack({
    date:        today,
    dmg:         result.dmg,
    matchType:   result.matchType,
    monsterName: monster.name,
    monsterArt:  monster.art,
    abilityName: result.abilityName,
    healAmt:     result.healAmt || 0,
    statusApplied: result.statusAppliedToMonster || result.statusAppliedToSelf || (result.cleansed ? 'cleanse' : null),
  });

  Bus.emit('stats-updated');

  // Show inline result
  const resultArea = document.getElementById('attack-result-area');
  if (resultArea) {
    let msg = `${result.abilityIcon} <strong>${escHtml(result.abilityName)}</strong>`;
    if (result.dmg > 0) {
      const bonus = result.matchType === 'weakness' ? ' <span style="color:var(--accent-gold);">(weakness!)</span>' : result.matchType === 'resistance' ? ' <span style="color:var(--accent-red);">(resisted)</span>' : '';
      msg += ` → -${result.dmg} ❤️${bonus}`;
    }
    if (result.healAmt > 0)               msg += ` +${result.healAmt} HP 💚`;
    if (result.statusAppliedToMonster)     msg += ` · <span style="color:#9b59b6;">${escHtml(result.statusAppliedToMonster)}</span> applied`;
    if (result.statusAppliedToSelf)        msg += ` · <span style="color:var(--accent-blue);">${escHtml(result.statusAppliedToSelf)}</span> active`;
    if (result.cleansed)                   msg += ` · ✨ debuffs cleared`;
    resultArea.innerHTML = `<div class="attack-result">${msg}</div>`;
  }

  // Check for monster defeat
  if (monster.hpCurrent <= 0) {
    const defeatData = Monsters.handleDefeat(null, monster);
    setTimeout(() => showCombatDefeatModal(defeatData), 800);
    return;
  }

  // Re-render
  setTimeout(() => Router.navigate('combat'), 1200);
}

/* ── Ability shop ────────────────────────────── */

function showAbilityShop(player) {
  if (typeof ABILITY_CATALOG === 'undefined') return;
  const owned = player.abilities || ['ab_strike'];

  const available = ABILITY_CATALOG.filter(ab => !owned.includes(ab.id));
  if (available.length === 0) {
    Modal.show(`
      <div style="padding:16px;text-align:center;">
        <div style="font-size:1.5rem;margin-bottom:8px;">🎉</div>
        <div style="font-family:var(--font-display);font-size:0.6rem;color:var(--accent-gold);">ALL ABILITIES UNLOCKED</div>
        <div class="muted-text mt-8">You've mastered every skill.</div>
        <button class="btn btn-secondary mt-16" onclick="Modal.hide()">CLOSE</button>
      </div>
    `);
    return;
  }

  const rows = available.map(ab => {
    const canBuy    = player.gold >= ab.goldCost && player.level >= ab.reqLevel;
    const levelLock = player.level < ab.reqLevel;
    const goldLock  = player.gold < ab.goldCost;
    const lockReason = levelLock ? `Requires Lv${ab.reqLevel}` : goldLock ? `Need ${ab.goldCost - player.gold} more gold` : '';

    return `
      <div class="shop-item${!canBuy ? ' locked' : ''}">
        <div class="shop-item-head">
          <span class="shop-item-icon">${ab.icon}</span>
          <div class="shop-item-info">
            <div class="shop-item-name">${escHtml(ab.name)}</div>
            <div class="shop-item-desc">${escHtml(ab.description)}</div>
          </div>
        </div>
        <div class="shop-item-foot">
          <span class="shop-item-cost">${ab.goldCost === 0 ? 'FREE' : `${ab.goldCost} 🪙`} · Lv${ab.reqLevel}</span>
          ${lockReason ? `<span class="shop-item-lock">${escHtml(lockReason)}</span>` : ''}
          <button class="btn btn-primary btn-sm shop-buy-btn"
            style="width:auto;${!canBuy ? 'opacity:0.4;pointer-events:none;' : ''}"
            data-ability-id="${ab.id}"
            ${!canBuy ? 'disabled' : ''}
          >BUY</button>
        </div>
      </div>
    `;
  }).join('');

  Modal.show(`
    <div class="shop-modal">
      <div class="shop-title">⚔️ ABILITY SHOP</div>
      <div class="shop-balance">Gold: ${player.gold} 🪙 · Level ${player.level}</div>
      <div class="shop-items">${rows}</div>
      <button class="btn btn-secondary mt-16" onclick="Modal.hide()">CLOSE</button>
    </div>
  `);

  document.querySelectorAll('.shop-buy-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const abilityId = btn.dataset.abilityId;
      purchaseAbility(abilityId);
    });
  });
}

function purchaseAbility(abilityId) {
  const ab = ABILITY_CATALOG.find(a => a.id === abilityId);
  if (!ab) return;
  const player = Store.getPlayer();

  if (player.level < ab.reqLevel) { Toast.show(`Requires Level ${ab.reqLevel}.`, 'info'); return; }
  if (player.gold < ab.goldCost)  { Toast.show('Not enough gold.', 'info'); return; }

  player.gold -= ab.goldCost;
  if (!Array.isArray(player.abilities)) player.abilities = ['ab_strike'];
  if (!player.abilities.includes(abilityId)) player.abilities.push(abilityId);
  Store.setPlayer(player);

  Toast.show(`${ab.icon} ${ab.name} learned!`, 'success');
  Bus.emit('stats-updated');
  Modal.hide();
  Router.navigate('combat');
}

/* ── Attack bonus info ───────────────────────── */

function getAttackBonusInfo(player, monster, todayLogs) {
  const loggedTypes = getTodayLoggedTypes(todayLogs);
  const weaknesses  = monster.weaknesses  || [];
  const resistances = monster.resistances || [];

  const baseDmg = Math.floor(player.stats.STR * 5);
  const mult    = Engine.weaknessMultiplier(player.stats.STR);
  const pct     = Math.round((mult - 1) * 100);

  if (loggedTypes.size === 0) {
    return {
      bonusText:  `🗡️ No training logged today — base ${baseDmg} dmg. Log a workout for the weakness bonus!`,
      bonusClass: 'neutral',
    };
  }

  const typesArr = [...loggedTypes];
  if (typesArr.some(t => weaknesses.includes(t))) {
    const matching = typesArr.filter(t => weaknesses.includes(t)).map(capitalizeType).join(', ');
    return {
      bonusText:  `💪 ${matching} logged → ×${mult.toFixed(2)} (+${pct}%) damage!`,
      bonusClass: 'weakness',
    };
  }

  if (typesArr.every(t => resistances.includes(t))) {
    return {
      bonusText:  `⚠️ Only resistant types logged → 50% damage`,
      bonusClass: 'resistance',
    };
  }

  return {
    bonusText:  `🗡️ ${typesArr.map(capitalizeType).join(', ')} logged — neutral damage (${baseDmg} dmg). Try logging ${weaknesses.map(capitalizeType).join(' or ')} for ×${mult.toFixed(2)}!`,
    bonusClass: 'neutral',
  };
}

function getTodayLoggedTypes(todayLogs) {
  const loggedTypes = new Set();
  for (const entry of todayLogs) {
    for (const a  of (entry.activities || [])) loggedTypes.add(a.type);
    for (const ex of (entry.exercises  || [])) loggedTypes.add(ex.type);
  }
  return loggedTypes;
}

/* ── Defeat modal ────────────────────────────── */

function showCombatDefeatModal(defeatData) {
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
      <button class="btn btn-primary" id="combat-defeat-btn">⚔️ ONWARD!</button>
    </div>
  `;

  Modal.show(html);
  document.getElementById('combat-defeat-btn').onclick = () => {
    Modal.hide();
    Toast.show(`${monster.art} ${monster.name} defeated! A new monster approaches...`, 'success');
    Router.navigate('combat');
  };
}

function renderNoActiveMonster() {
  return `
    <div class="card center-text">
      <div style="font-size:2.5rem;margin-bottom:8px;">🏆</div>
      <div class="card-title">All monsters defeated!</div>
      <div class="muted-text mt-8">Log a workout to spawn a new one.</div>
    </div>
  `;
}

Router.register('battles', renderCombat);
Router.register('combat',  renderCombat);
