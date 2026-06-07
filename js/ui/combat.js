/* ─────────────────────────────────────────────
   Combat screen — monster detail + ATTACK button
   ───────────────────────────────────────────── */

function renderCombat(container) {
  const player  = Store.getPlayer();
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
        ? `<div class="muted-text">No attacks yet. Tap ATTACK to deal damage!</div>`
        : attacks.slice(0, 20).map(a => `
            <div class="combat-log-entry">
              <div>
                <div style="font-size:0.85rem;font-weight:600;">${escHtml(a.monsterName || 'Monster')}</div>
                <div class="combat-log-date">${escHtml(a.date)}${a.matchType === 'weakness' ? ' ✓ weakness' : a.matchType === 'resistance' ? ' ✗ resist' : ''}</div>
              </div>
              <div class="combat-log-dmg">-${a.dmg} ❤️</div>
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

  // Bind attack button
  const attackBtn = document.getElementById('attack-btn');
  if (attackBtn && monster) {
    attackBtn.onclick = () => handleAttack(monster);
  }
}

function renderActiveMonster(monster, player, todayLogs) {
  const hpPct    = Math.max(0, Math.round((monster.hpCurrent / monster.hpMax) * 100));
  const weakStr  = (monster.weaknesses || []).map(capitalizeType).join(', ') || '—';
  const resStr   = (monster.resistances || []).map(capitalizeType).join(', ') || '—';

  // Energy state
  const energy    = Math.floor(player.energy || 0);
  const maxEnergy = player.maxEnergy || 35;
  const energyPct = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));
  const regenRate = (3 + player.stats.AGI * 0.5).toFixed(1);
  const canAttack = energy >= 10;

  // Attack bonus from today's logged types
  const { bonusText, bonusClass } = getAttackBonusInfo(player, monster, todayLogs);

  // Estimated regen time if low energy
  let rechargeText = '';
  if (!canAttack) {
    const hoursNeeded = (10 - energy) / (3 + player.stats.AGI * 0.5);
    rechargeText = hoursNeeded < 1
      ? `~${Math.ceil(hoursNeeded * 60)}min`
      : `~${hoursNeeded.toFixed(1)}h`;
  }

  const attackDmg = Math.floor(player.stats.STR * 5);
  const weaknesses = monster.weaknesses || [];
  const loggedTypes = getTodayLoggedTypes(todayLogs);
  const matchesWeakness = [...loggedTypes].some(t => weaknesses.includes(t));
  const weaknessMult = Engine.weaknessMultiplier(player.stats.STR);
  const expectedDmg = matchesWeakness ? Math.floor(attackDmg * weaknessMult) : attackDmg;

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

      <div class="monster-tags mt-8">
        <span class="tag tag-weak">⬆ Weak: ${escHtml(weakStr)}</span>
        ${resStr !== '—' ? `<span class="tag tag-res">⬇ Resists: ${escHtml(resStr)}</span>` : ''}
      </div>
    </div>

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
        Regens ${regenRate}/hr (AGI ${player.stats.AGI}) — raise AGI via sports &amp; swimming
      </div>
    </div>

    <!-- Attack bonus indicator -->
    <div class="attack-bonus-indicator ${canAttack ? bonusClass : 'no-energy'}">
      ${canAttack
        ? bonusText
        : `⚡ Out of energy — recharges in ${rechargeText}`}
    </div>

    <!-- ATTACK button -->
    <button
      id="attack-btn"
      class="btn btn-primary"
      style="${!canAttack ? 'opacity:0.4;pointer-events:none;' : ''}"
      ${!canAttack ? 'disabled' : ''}
    >
      ⚔️ ATTACK${canAttack ? ` (~${expectedDmg} dmg)` : ' (no energy)'}
    </button>

    <div id="attack-result-area" style="min-height:40px;"></div>
  `;
}

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

function handleAttack(monster) {
  const player    = Store.getPlayer();
  const today     = Store.today();
  const todayLogs = Store.getLog().filter(e => e.date === today);

  const result = Engine.computeAttack(player, monster, todayLogs);

  if (result.noEnergy) {
    Toast.show('Not enough energy! Wait for it to recharge.', 'info');
    return;
  }

  // Apply damage
  monster.hpCurrent = Math.max(0, monster.hpCurrent - result.dmg);

  // Save state
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
    types:       result.loggedTypes || [],
  });

  Bus.emit('stats-updated');

  // Show result inline
  const resultArea = document.getElementById('attack-result-area');
  if (resultArea) {
    const bonusLabel = result.matchType === 'weakness'  ? ' (weakness bonus!)'
                     : result.matchType === 'resistance' ? ' (resistance penalty)'
                     : '';
    resultArea.innerHTML = `<div class="attack-result">⚔️ -${result.dmg} ❤️${escHtml(bonusLabel)}</div>`;
  }

  // Check for defeat
  if (monster.hpCurrent <= 0) {
    const defeatData = Monsters.handleDefeat(null, monster);
    setTimeout(() => showCombatDefeatModal(defeatData), 800);
    return;
  }

  // Re-render combat after short delay so user sees the result flash
  setTimeout(() => Router.navigate('combat'), 1200);
}

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
Router.register('combat', renderCombat);  // alias for old hash bookmarks
