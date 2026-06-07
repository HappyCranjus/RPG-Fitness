/* ─────────────────────────────────────────────
   Engine — XP, stats, damage, leveling, cycles
   ───────────────────────────────────────────── */

const Engine = (() => {

  // Cycle length and decay tuning — single source of truth
  const CYCLE_DAYS         = 14;
  const DECAY_GRACE_DAYS   = 3;
  const DECAY_RATE_PER_DAY = { STR: 1.0, AGI: 0.7, VIT: 0.5, DIS: 1.5 };

  // Survival loop: passive HP drain + monster 6-hour ticks.
  // Combined target ≈ 88 HP/day at base rates.
  const HP_DECAY_PER_HOUR          = 2;
  const MONSTER_ATTACK_INTERVAL_MS = 6 * 60 * 60 * 1000;
  const MONSTER_ATTACK_DAMAGE      = 10;

  // Daily HP bonuses for hitting nutrition milestones.
  const CAL_HEAL_BONUS_1   = 800;
  const CAL_HEAL_BONUS_2   = 1600;
  const CAL_HEAL_BONUS_HP  = 10;
  const PROTEIN_HEAL_BONUS = 30;

  // XP needed to reach the next level from `level`
  function xpToNextLevel(level) {
    return Math.floor(100 * Math.pow(level, 1.4));
  }

  // Derived combat stats (computed at runtime, never stored)
  function getDerivedStats(player) {
    const { STR, AGI, VIT, DIS } = player.stats;
    return {
      ATK: Math.floor(STR * 5),                  // pure stat-based; level is cosmetic
      DEF: Math.floor(DIS * 3),                  // junk food damage resistance display
      SPD: Math.floor(AGI * 2.0),                // energy regen rate display
      MP:  Math.floor(VIT * 3.0 + DIS * 2.0),   // kept for display
    };
  }

  /* ── Energy regen (lazy, call before any energy read) ── */

  function updateEnergyRegen(player) {
    if (!player.lastEnergyUpdate) {
      player.lastEnergyUpdate = new Date().toISOString();
      return;
    }
    const hoursElapsed = (Date.now() - new Date(player.lastEnergyUpdate).getTime()) / 3600000;
    const regen = hoursElapsed * (3 + player.stats.AGI * 0.5);
    player.energy = Math.min(player.maxEnergy || 35, (player.energy || 0) + regen);
    player.lastEnergyUpdate = new Date().toISOString();
  }

  /* ── Passive HP decay (lazy, applied on app open) ──
     Drains HP at HP_DECAY_PER_HOUR. Advances anchor only by the
     consumed time so partial intervals carry forward and frequent
     check-ins don't accidentally lose decay.
  ─────────────────────────────────────────────── */

  function applyHpDecay(player, now) {
    if (!player.lastHpTickAt) {
      player.lastHpTickAt = now;
      return { damage: 0 };
    }
    if (player.knockedOut) {
      player.lastHpTickAt = now;
      return { damage: 0 };
    }
    const msPerUnit = 3600000 / HP_DECAY_PER_HOUR;
    const elapsed   = now - player.lastHpTickAt;
    const units     = Math.floor(elapsed / msPerUnit);
    if (units <= 0) return { damage: 0 };
    player.hp = Math.max(0, (player.hp || 0) - units);
    player.lastHpTickAt += units * msPerUnit;
    return { damage: units };
  }

  /* ── Monster 6-hour attack ticks (lazy) ──
     The active monster lands MONSTER_ATTACK_DAMAGE every 6h. If the
     player has been offline for 18h, three ticks apply at once.
     Knocked-out players take no further attacks until they recover.
  ─────────────────────────────────────────────── */

  function applyMonsterAttacks(player, monster, now) {
    if (!monster || !player.lastMonsterAttackAt || player.knockedOut) {
      player.lastMonsterAttackAt = now;
      return { damage: 0, ticksApplied: 0 };
    }
    const elapsed = now - player.lastMonsterAttackAt;
    const ticks   = Math.floor(elapsed / MONSTER_ATTACK_INTERVAL_MS);
    if (ticks <= 0) return { damage: 0, ticksApplied: 0 };
    const damage = ticks * MONSTER_ATTACK_DAMAGE;
    player.hp = Math.max(0, (player.hp || 0) - damage);
    player.lastMonsterAttackAt += ticks * MONSTER_ATTACK_INTERVAL_MS;
    return { damage, ticksApplied: ticks };
  }

  // Combined survival tick used on bootstrap. Returns the damage from each
  // source and whether the cumulative damage knocked the player out.
  function applySurvivalTicks(player, monster, now) {
    const decay  = applyHpDecay(player, now);
    const attack = applyMonsterAttacks(player, monster, now);
    let knockedOut = false;
    if (player.hp <= 0 && !player.knockedOut) {
      triggerKnockOut(player);
      knockedOut = true;
    }
    return { decay, attack, knockedOut };
  }

  /* ── DIS mitigation for negative HP deltas ── */

  function applyDISMitigation(hpDelta, DIS) {
    if (hpDelta >= 0) return hpDelta;
    const reduction = Math.min(0.5, DIS * 0.03);
    return Math.ceil(hpDelta * (1 - reduction));
  }

  /* ── Explicit attack (called from Combat screen button) ── */

  function computeAttack(player, monster, todayLogs) {
    updateEnergyRegen(player);
    if ((player.energy || 0) < 10) {
      return { dmg: 0, noEnergy: true, multiplier: 1, matchType: 'none', baseDmg: 0 };
    }
    const baseDmg = Math.floor(player.stats.STR * 5);

    const loggedTypes = new Set();
    for (const entry of todayLogs) {
      for (const a of (entry.activities || [])) loggedTypes.add(a.type);
      for (const ex of (entry.exercises || [])) loggedTypes.add(ex.type);
    }

    let multiplier = 1.0;
    let matchType = 'neutral';
    const weaknesses = monster.weaknesses || [];
    const resistances = monster.resistances || [];
    if ([...loggedTypes].some(t => weaknesses.includes(t))) {
      multiplier = 1.5; matchType = 'weakness';
    } else if (loggedTypes.size > 0 && [...loggedTypes].every(t => resistances.includes(t))) {
      multiplier = 0.5; matchType = 'resistance';
    }

    const finalDmg = Math.floor(baseDmg * multiplier);
    player.energy = Math.max(0, (player.energy || 10) - 10);
    player.lastEnergyUpdate = new Date().toISOString();

    return { dmg: finalDmg, baseDmg, multiplier, matchType, noEnergy: false, loggedTypes: [...loggedTypes] };
  }

  /* ── XP calculation ───────────────────────── */

  const ACTIVITY_TYPE_MOD  = { cardio: 1.0, sports: 1.1, misc: 0.9 };
  const EXERCISE_XP_PER_REP = {
    ex_pushup:   0.4, ex_situp:  0.3, ex_pullup:  0.8,
    ex_squat:    0.4, ex_idl:    0.5, ex_dumbbell: 0.5,
    ex_lunge:    0.4, ex_dip:    0.7, ex_burpee:  1.2,
    ex_plank:    0.1, ex_bench:  0.7, ex_row:     0.6,
  };

  function computeXP(logEntry, streakDays) {
    let total = 0;
    const breakdown = [];

    for (const a of logEntry.activities) {
      const mod = ACTIVITY_TYPE_MOD[a.type] || 0.9;
      const xp  = Math.floor(a.durationMinutes * 1.5 * mod);
      total += xp;
      breakdown.push({ name: a.name, xp });
    }

    for (const ex of logEntry.exercises) {
      const perRep = EXERCISE_XP_PER_REP[ex.exerciseId] || 0.4;
      const xp = Math.floor(ex.totalReps * perRep);
      total += xp;
      breakdown.push({ name: ex.name, xp });
    }

    for (const m of logEntry.meals) {
      // Base 15 XP per meal — rewards logging anything, healthy or not.
      const xp = 15 + Math.floor((m.proteinG || 0) * 0.2);
      total += xp;
    }

    const streakBonus = Math.min(streakDays * 5, 50);
    total += streakBonus;

    return { total, breakdown, streakBonus };
  }

  /* ── Stat accumulator computation ──────────── */

  const ACTIVITY_STAT_PER_MIN = {
    act_jog:     { STR: 0.1, VIT: 0.4, AGI: 0.1 },
    act_swim:    { STR: 0.2, VIT: 0.3, AGI: 0.3 },
    act_bball:   { STR: 0.1, VIT: 0.2, AGI: 0.5 },
    act_walkdog: { VIT: 0.2 },
    act_cycle:   { STR: 0.1, VIT: 0.4, AGI: 0.1 },
    act_hike:    { STR: 0.1, VIT: 0.5 },
    act_yoga:    { AGI: 0.4, VIT: 0.2 },
  };

  const EXERCISE_STAT_PER_REP = {
    ex_pushup:   { STR: 0.05 },
    ex_situp:    { STR: 0.04 },
    ex_pullup:   { STR: 0.10, AGI: 0.02 },
    ex_squat:    { STR: 0.06 },
    ex_idl:      { STR: 0.07 },
    ex_dumbbell: { STR: 0.08 },
    ex_lunge:    { STR: 0.05, AGI: 0.02 },
    ex_dip:      { STR: 0.10 },
    ex_burpee:   { STR: 0.05, AGI: 0.05, VIT: 0.04 },
    ex_plank:    { STR: 0.02, VIT: 0.01 },
    ex_bench:    { STR: 0.12 },
    ex_row:      { STR: 0.10, AGI: 0.02 },
  };

  /* ── Rotating 6-hour activity bonus ─────────────
     A randomly-picked activity or exercise gets +25% stat
     gain for 6 hours. One bonus is always active; it auto-rolls
     to a new one when the window expires.
  ─────────────────────────────────────────────── */

  const BONUS_WINDOW_MS = 6 * 60 * 60 * 1000;
  const BONUS_MULTIPLIER = 1.25;

  const BONUS_POOL = [
    { itemId: 'act_jog',     kind: 'activity', label: 'Jogging',     icon: '🏃' },
    { itemId: 'act_swim',    kind: 'activity', label: 'Swimming',    icon: '🏊' },
    { itemId: 'act_bball',   kind: 'activity', label: 'Basketball',  icon: '🏀' },
    { itemId: 'act_walkdog', kind: 'activity', label: 'Dog Walking', icon: '🐕' },
    { itemId: 'act_cycle',   kind: 'activity', label: 'Cycling',     icon: '🚴' },
    { itemId: 'act_hike',    kind: 'activity', label: 'Hiking',      icon: '🥾' },
    { itemId: 'act_yoga',    kind: 'activity', label: 'Yoga',        icon: '🧘' },
    { itemId: 'ex_pushup',   kind: 'exercise', label: 'Push-ups',    icon: '💪' },
    { itemId: 'ex_situp',    kind: 'exercise', label: 'Sit-ups',     icon: '🔥' },
    { itemId: 'ex_pullup',   kind: 'exercise', label: 'Pull-ups',    icon: '🏋️' },
    { itemId: 'ex_squat',    kind: 'exercise', label: 'Squats',      icon: '🦵' },
    { itemId: 'ex_idl',      kind: 'exercise', label: 'Leg Raises',  icon: '🦵' },
    { itemId: 'ex_dumbbell', kind: 'exercise', label: 'Dumbbells',   icon: '🏋️' },
    { itemId: 'ex_lunge',    kind: 'exercise', label: 'Lunges',      icon: '🦵' },
    { itemId: 'ex_dip',      kind: 'exercise', label: 'Dips',        icon: '💪' },
    { itemId: 'ex_burpee',   kind: 'exercise', label: 'Burpees',     icon: '🔥' },
    { itemId: 'ex_plank',    kind: 'exercise', label: 'Plank',       icon: '⏱' },
    { itemId: 'ex_bench',    kind: 'exercise', label: 'Bench Press', icon: '🏋️' },
    { itemId: 'ex_row',      kind: 'exercise', label: 'Bent Row',    icon: '🏋️' },
  ];

  function rollBonus(now) {
    const pick = BONUS_POOL[Math.floor(Math.random() * BONUS_POOL.length)];
    const bonus = {
      itemId:      pick.itemId,
      kind:        pick.kind,
      label:       pick.label,
      icon:        pick.icon,
      multiplier:  BONUS_MULTIPLIER,
      windowStart: now,
      windowEnd:   now + BONUS_WINDOW_MS,
    };
    Store.setBonus(bonus);
    return bonus;
  }

  function getActiveBonus(now) {
    const current = Store.getBonus();
    if (current && current.windowEnd > now) return current;
    return rollBonus(now);
  }

  function computeStatDeltas(logEntry, bonus) {
    const delta = { STR_acc: 0, AGI_acc: 0, VIT_acc: 0, DIS_acc: 0 };
    let bonusApplied = false;

    for (const a of logEntry.activities) {
      const gains = ACTIVITY_STAT_PER_MIN[a.activityId]
        || { VIT: 0.2, STR: 0.1 };
      const isBonus = bonus && bonus.kind === 'activity' && bonus.itemId === a.activityId;
      const mult    = isBonus ? bonus.multiplier : 1;
      if (isBonus) bonusApplied = true;
      for (const [stat, rate] of Object.entries(gains)) {
        delta[stat + '_acc'] = (delta[stat + '_acc'] || 0) + rate * a.durationMinutes * mult;
      }
    }

    for (const ex of logEntry.exercises) {
      const gains = EXERCISE_STAT_PER_REP[ex.exerciseId] || { STR: 0.05 };
      const isBonus = bonus && bonus.kind === 'exercise' && bonus.itemId === ex.exerciseId;
      const mult    = isBonus ? bonus.multiplier : 1;
      if (isBonus) bonusApplied = true;
      for (const [stat, rate] of Object.entries(gains)) {
        delta[stat + '_acc'] = (delta[stat + '_acc'] || 0) + rate * ex.totalReps * mult;
      }
    }

    if (logEntry.meals.length > 0) {
      delta.VIT_acc += logEntry.meals.length * 0.5;
    }

    return { delta, bonusApplied };
  }

  function applyStatDeltas(player, delta, today) {
    const gained = {};
    for (const key of Object.keys(delta)) {
      if (delta[key] <= 0) continue;
      const stat = key.replace('_acc', '');
      player.statPoints[key] = (player.statPoints[key] || 0) + delta[key];
      const newStatVal = Math.floor(player.statPoints[key] / 10) + 1;
      if (newStatVal > player.stats[stat]) {
        gained[stat] = newStatVal - player.stats[stat];
        player.stats[stat] = newStatVal;
      }
      // Record most recent gain timestamp for decay tracking
      if (player.statDecay) player.statDecay[stat + '_lastGain'] = today;
    }
    return gained;
  }

  /* ── DIS accumulation (once per day) ─────────
     Returns how much DIS_acc to add and what was credited
  ─────────────────────────────────────────────── */

  function computeDIScredits(player, todayLog, today) {
    const credits = player.disCredits || { showUp: null, protein: null, calories: null, macros: null };
    let disAcc = 0;
    const credited = [];

    if (credits.showUp !== today && todayLog.some(e => e.activities.length > 0 || e.exercises.length > 0)) {
      disAcc += 3;
      credits.showUp = today;
      credited.push('showUp');
    }

    const todayProtein = todayLog.reduce((sum, e) =>
      sum + e.meals.reduce((s, m) => s + (m.proteinG || 0), 0), 0);
    if (credits.protein !== today && todayProtein >= player.goals.dailyProteinG) {
      disAcc += 3;
      credits.protein = today;
      credited.push('protein');
      player.proteinGoalHits = (player.proteinGoalHits || 0) + 1;
    }

    const todayCals = todayLog.reduce((sum, e) =>
      sum + e.meals.reduce((s, m) => s + (m.calories || 0), 0), 0);
    const goal = player.goals.dailyCalories;
    if (credits.calories !== today && todayCals > 0 && Math.abs(todayCals - goal) / goal <= 0.10) {
      disAcc += 2;
      credits.calories = today;
      credited.push('calories');
      player.calorieGoalHits = (player.calorieGoalHits || 0) + 1;
    }

    // Macro bonus: all three (protein/carbs/fats) goals hit in one day
    const carbsGoal = player.goals.dailyCarbsG || 0;
    const fatsGoal  = player.goals.dailyFatsG  || 0;
    if (credits.macros !== today && carbsGoal > 0 && fatsGoal > 0) {
      const todayCarbs = todayLog.reduce((sum, e) =>
        sum + e.meals.reduce((s, m) => s + (m.carbsG || 0), 0), 0);
      const todayFats = todayLog.reduce((sum, e) =>
        sum + e.meals.reduce((s, m) => s + (m.fatsG || 0), 0), 0);
      if (todayProtein >= player.goals.dailyProteinG &&
          todayCarbs   >= carbsGoal &&
          todayFats    >= fatsGoal) {
        disAcc += 3;
        credits.macros = today;
        credited.push('macros');
        player.macroGoalHits = (player.macroGoalHits || 0) + 1;
      }
    }

    player.disCredits = credits;
    return { disAcc, credited };
  }

  /* ── Leveling (cosmetic — no stat gains) ────── */

  function checkLevelUp(player) {
    const results = [];
    while (player.xp >= player.xpToNextLevel) {
      player.xp -= player.xpToNextLevel;
      player.level += 1;
      player.xpToNextLevel = xpToNextLevel(player.level);
      player.gold += 50;
      if (player.level > (player.cyclePeakLevel || 1)) {
        player.cyclePeakLevel = player.level;
      }
      results.push(player.level);
    }
    return results;
  }

  /* ── Streak ───────────────────────────────── */

  function updateStreak(player, today) {
    if (!player.lastLogDate) {
      player.streakDays = 1;
    } else {
      const last = new Date(player.lastLogDate);
      const now  = new Date(today);
      const diffDays = Math.round((now - last) / 86400000);
      if (diffDays === 1) {
        player.streakDays += 1;
      } else if (diffDays === 0) {
        // same day, no change
      } else {
        player.streakDays = 1;
      }
    }
    player.lastLogDate = today;
  }

  /* ── Cycle rollover ──────────────────────────
     Archives the current biweekly cycle if it has ended,
     then starts a fresh one (level resets, stats persist).
  ─────────────────────────────────────────────── */

  function daysBetween(fromISO, toISO) {
    const from = new Date(fromISO + 'T00:00:00');
    const to   = new Date(toISO   + 'T00:00:00');
    return Math.floor((to - from) / 86400000);
  }

  function rolloverCycleIfNeeded(player, today) {
    if (!player.cycleStart) {
      player.cycleStart      = today;
      player.cyclePeakLevel  = player.level || 1;
      player.cycleXpEarned   = 0;
      player.cycleDaysActive = 0;
      player.cycleDecayHits  = 0;
      return { rolled: false };
    }

    const elapsed = daysBetween(player.cycleStart, today);
    if (elapsed < CYCLE_DAYS) return { rolled: false };

    // Archive completed cycle
    const cycleEnd = new Date(player.cycleStart + 'T00:00:00');
    cycleEnd.setDate(cycleEnd.getDate() + CYCLE_DAYS - 1);
    const cycleEndISO = cycleEnd.toISOString().slice(0, 10);

    Store.appendCycleHistory({
      cycleStart:    player.cycleStart,
      cycleEnd:      cycleEndISO,
      peakLevel:     player.cyclePeakLevel || player.level || 1,
      totalXpEarned: player.cycleXpEarned  || 0,
      daysActive:    player.cycleDaysActive || 0,
      decayHits:     player.cycleDecayHits  || 0,
      finalStatSum:  player.stats.STR + player.stats.AGI + player.stats.VIT + player.stats.DIS,
    });

    // Roll a new cycle starting today
    player.level             = 1;
    player.xp                = 0;
    player.xpToNextLevel     = 100;
    player.cycleStart        = today;
    player.cyclePeakLevel    = 1;
    player.cycleXpEarned     = 0;
    player.cycleDaysActive   = 0;
    player.cycleDecayHits    = 0;
    player.cycleLastActiveDate = null;

    return { rolled: true };
  }

  /* ── Stat decay ──────────────────────────────
     Each stat decays after a grace period of inactivity.
     We compare today against the stat's lastGain date and
     drain the accumulator at the configured per-stat rate.
  ─────────────────────────────────────────────── */

  function applyStatDecay(player, today) {
    if (!player.statDecay) return { decayed: {} };

    // Don't decay multiple times the same day
    if (player.statDecay.lastDecayCheck === today) return { decayed: {} };

    const decayed = {};
    let anyDecay  = false;

    for (const stat of ['STR', 'AGI', 'VIT', 'DIS']) {
      const lastGainISO = player.statDecay[stat + '_lastGain'];
      if (!lastGainISO) continue;
      const idle = daysBetween(lastGainISO, today);
      if (idle <= DECAY_GRACE_DAYS) continue;

      const decayDays    = idle - DECAY_GRACE_DAYS;
      const lossPerDay   = DECAY_RATE_PER_DAY[stat] || 0.5;
      // We already decayed N days previously — compute days NEW since lastDecayCheck
      const lastCheckISO = player.statDecay.lastDecayCheck || lastGainISO;
      const sinceCheck   = Math.max(1, daysBetween(lastCheckISO, today));
      const lossNow      = Math.min(decayDays, sinceCheck) * lossPerDay;
      if (lossNow <= 0) continue;

      const accKey = stat + '_acc';
      const before = player.stats[stat];
      player.statPoints[accKey] = Math.max(0, (player.statPoints[accKey] || 0) - lossNow);
      const after = Math.max(1, Math.floor(player.statPoints[accKey] / 10) + 1);
      if (after < before) {
        decayed[stat] = before - after;
        player.stats[stat] = after;
        anyDecay = true;
      }
    }

    if (anyDecay) {
      // Recompute HP/Energy ceilings if VIT/AGI dropped
      player.hpMax = 100 + (player.stats.VIT * 15);
      if (player.hp > player.hpMax) player.hp = player.hpMax;
      player.maxEnergy = 30 + (player.stats.AGI * 5);
      if (player.energy > player.maxEnergy) player.energy = player.maxEnergy;
      player.cycleDecayHits = (player.cycleDecayHits || 0) + 1;
    }

    player.statDecay.lastDecayCheck = today;
    return { decayed };
  }

  /* ── Damage computation ───────────────────── */

  function damageForItem(type, baseDamage, monster) {
    const weak = monster.weaknesses || [];
    const res  = monster.resistances || [];
    if (weak.includes(type)) return { dmg: Math.floor(baseDamage * 1.5), match: 'weakness' };
    if (res.includes(type))  return { dmg: Math.floor(baseDamage * 0.5), match: 'resistance' };
    return { dmg: baseDamage, match: 'neutral' };
  }

  function computeDamage(logEntry, monster, player) {
    if (!monster) return { total: 0, breakdown: [] };
    const derived = getDerivedStats(player);
    const breakdown = [];
    let total = 0;

    for (const a of logEntry.activities) {
      const base = Math.floor(a.durationMinutes * 1.2);
      const { dmg, match } = damageForItem(a.type, base, monster);
      total += dmg;
      breakdown.push({ name: a.name + ' ' + a.durationMinutes + 'min', dmg, match });
    }

    for (const ex of logEntry.exercises) {
      const base = Math.floor(ex.totalReps * 0.3);
      const { dmg, match } = damageForItem(ex.type, base, monster);
      total += dmg;
      breakdown.push({ name: ex.name + ' ' + ex.totalReps + ' reps', dmg, match });
    }

    if (logEntry.meals.length > 0) {
      const base = Math.floor(derived.MP / 4) * logEntry.meals.length;
      const { dmg, match } = damageForItem('diet', Math.max(base, 1), monster);
      total += dmg;
      breakdown.push({ name: 'Meals logged', dmg, match });
    }

    return { total, breakdown };
  }

  /* ── Preview (called live from log form) ──── */

  function previewDamage(activities, exercises, meals, monster, player) {
    if (!monster) return { total: 0, breakdown: [], totalXP: 0, totalCal: 0 };

    const tempEntry = { activities, exercises, meals };
    const dmgResult = computeDamage(tempEntry, monster, player);

    let totalXP = 0;
    let totalCal = 0;

    for (const a of activities) {
      const mod = ACTIVITY_TYPE_MOD[a.type] || 0.9;
      totalXP += Math.floor(a.durationMinutes * 1.5 * mod);
      totalCal += a.estimatedCalories || 0;
    }
    for (const ex of exercises) {
      const perRep = EXERCISE_XP_PER_REP[ex.exerciseId] || 0.4;
      totalXP += Math.floor(ex.totalReps * perRep);
    }
    for (const m of meals) {
      totalXP += 10 + Math.floor((m.proteinG || 0) * 0.2);
    }

    return { ...dmgResult, totalXP, totalCal };
  }

  /* ── Food quality / HP ───────────────────────
     Every logged meal heals — junk a little, balanced a lot.
     Per-meal heal: floor(cal/100) + floor(protein/3), gated by
     "still under today's calorie goal." Plus three one-shot daily
     bonuses for crossing 800 cal, 1600 cal, and the protein goal.
     classifyMeal is purely cosmetic feedback for the picker.
  ─────────────────────────────────────────────── */

  function computeMealHeal(meal, todayCaloriesBefore, dailyCalGoal) {
    if (todayCaloriesBefore >= dailyCalGoal) return 0;
    return Math.floor((meal.calories || 0) / 100)
         + Math.floor((meal.proteinG || 0) /   3);
  }

  function classifyMeal(meal) {
    const cal  = meal.calories || 0;
    const prot = meal.proteinG || 0;
    if (cal <= 0 && prot <= 0) return { label: 'Empty',     emoji: '⬜' };
    const protPer100 = cal > 0 ? (prot / cal) * 100 : 0;
    if (protPer100 >= 8) return { label: 'Excellent', emoji: '✅' };
    if (protPer100 >= 5) return { label: 'Good',      emoji: '🟢' };
    if (protPer100 >= 2) return { label: 'Neutral',   emoji: '⬜' };
    return                { label: 'Junk',      emoji: '🟡' };
  }

  function resetDailyHealsIfNewDay(player, today) {
    if (!player.dailyHealsAwarded || player.dailyHealsAwarded.date !== today) {
      player.dailyHealsAwarded = { date: today, cal800: false, cal1600: false, protein: false };
    }
  }

  function computeHPChanges(entry, player, today, fullLog) {
    resetDailyHealsIfNewDay(player, today);

    const dailyCalGoal = player.goals.dailyCalories;
    const proteinGoal  = player.goals.dailyProteinG;

    // Pre-entry day totals (fullLog already includes the just-appended entry, so exclude it).
    const priorToday = fullLog.filter(e => e.date === today && e.id !== entry.id);
    let runningCal     = priorToday.reduce((sum, e) => sum + e.meals.reduce((s, m) => s + (m.calories || 0), 0), 0);
    let runningProtein = priorToday.reduce((sum, e) => sum + e.meals.reduce((s, m) => s + (m.proteinG || 0), 0), 0);

    const mealQualities = [];
    let mealHealTotal = 0;
    let cal800Bonus   = 0;
    let cal1600Bonus  = 0;
    let proteinBonus  = 0;

    for (const meal of entry.meals) {
      const heal    = computeMealHeal(meal, runningCal, dailyCalGoal);
      const quality = classifyMeal(meal);
      if (heal > 0) {
        player.hp     += heal;
        mealHealTotal += heal;
      }
      mealQualities.push({ name: meal.name || 'Meal', hp: heal, label: quality.label, emoji: quality.emoji });

      runningCal     += meal.calories || 0;
      runningProtein += meal.proteinG || 0;

      if (!player.dailyHealsAwarded.cal800 && runningCal >= CAL_HEAL_BONUS_1) {
        cal800Bonus = CAL_HEAL_BONUS_HP;
        player.hp  += CAL_HEAL_BONUS_HP;
        player.dailyHealsAwarded.cal800 = true;
      }
      if (!player.dailyHealsAwarded.cal1600 && runningCal >= CAL_HEAL_BONUS_2) {
        cal1600Bonus = CAL_HEAL_BONUS_HP;
        player.hp   += CAL_HEAL_BONUS_HP;
        player.dailyHealsAwarded.cal1600 = true;
      }
      if (!player.dailyHealsAwarded.protein && runningProtein >= proteinGoal) {
        proteinBonus = PROTEIN_HEAL_BONUS;
        player.hp   += PROTEIN_HEAL_BONUS;
        player.dailyHealsAwarded.protein = true;
        player.proteinGoalHits = (player.proteinGoalHits || 0) + 1;
      }
    }

    player.hp = Math.min(player.hpMax, player.hp);
    const hpDelta = mealHealTotal + cal800Bonus + cal1600Bonus + proteinBonus;

    return {
      hpDelta,
      mealQualities,
      hpBreakdown: { mealHeal: mealHealTotal, cal800Bonus, cal1600Bonus, proteinBonus },
    };
  }

  function triggerKnockOut(player) {
    for (const stat of ['STR', 'AGI', 'VIT', 'DIS']) {
      player.stats[stat]               = Math.max(1, Math.floor(player.stats[stat] / 2));
      player.statPoints[stat + '_acc'] = Math.max(0, Math.floor(player.statPoints[stat + '_acc'] / 2));
    }
    player.hpMax      = 100 + (player.stats.VIT * 15);
    player.hp         = Math.floor(player.hpMax * 0.5);
    player.maxEnergy  = 30 + (player.stats.AGI * 5);
    player.energy     = Math.min(player.energy || 0, player.maxEnergy);
    player.knockedOut = true;
    // Reset survival anchors so post-KO HP doesn't immediately re-tick.
    player.lastHpTickAt        = Date.now();
    player.lastMonsterAttackAt = Date.now();
    Quests.resetDailyWeeklyProgress();
  }

  /* ── Main entry point ─────────────────────── */

  function processLogEntry(logEntry) {
    const player = Store.getPlayer();
    const today  = Store.today();
    const log      = Store.getLog();
    const todayLog = log.filter(e => e.date === today);

    // Roll cycle and apply decay before crediting today's work
    rolloverCycleIfNeeded(player, today);
    applyStatDecay(player, today);

    updateEnergyRegen(player);

    const todayLogWithNew = [...todayLog, logEntry];

    updateStreak(player, today);
    const xpResult = computeXP(logEntry, player.streakDays);

    const mainMealTypes = new Set(todayLogWithNew.flatMap(e =>
      e.meals.map(m => m.mealType).filter(t => ['breakfast','lunch','dinner'].includes(t))));
    let fullDayBonus = 0;
    if (mainMealTypes.size >= 3) {
      const alreadyBonused = todayLog.some(e => e._fullDayBonus);
      if (!alreadyBonused) {
        fullDayBonus = 25;
        logEntry._fullDayBonus = true;
      }
    }
    xpResult.total += fullDayBonus;

    // Routine completion bonus (XP × rank mult)
    let routineBonus = 0;
    if (logEntry.routineId && typeof Routines !== 'undefined') {
      const r = Routines.getRoutine(logEntry.routineId);
      if (r) {
        const mult = { E: 1, D: 1.2, C: 1.4, B: 1.6, A: 1.8, S: 2.0 }[r.rank] || 1;
        routineBonus = Math.floor(25 * mult);
        xpResult.total += routineBonus;
      }
    }

    player.xp += xpResult.total;
    player.totalXpEarned += xpResult.total;
    player.cycleXpEarned = (player.cycleXpEarned || 0) + xpResult.total;
    if (player.cycleLastActiveDate !== today) {
      player.cycleDaysActive  = (player.cycleDaysActive || 0) + 1;
      player.cycleLastActiveDate = today;
    }

    player.totalActivitiesLogged += logEntry.activities.length;
    player.totalExercisesLogged  += logEntry.exercises.length;
    player.totalMealsLogged      += logEntry.meals.length;

    const activeBonus = getActiveBonus(Date.now());
    const { delta, bonusApplied } = computeStatDeltas(logEntry, activeBonus);

    const { disAcc } = computeDIScredits(player, todayLogWithNew, today);
    delta.DIS_acc = (delta.DIS_acc || 0) + disAcc;

    const statsGained = applyStatDeltas(player, delta, today);

    if (statsGained.VIT) {
      player.hpMax = 100 + (player.stats.VIT * 15);
    }
    if (statsGained.AGI) {
      player.maxEnergy = 30 + (player.stats.AGI * 5);
      player.energy    = Math.min(player.energy || 0, player.maxEnergy);
    }

    // Level-up: cosmetic only — no stat changes, no hpMax/maxEnergy shifts
    const newLevels = checkLevelUp(player);

    // Streak milestone DIS bonus
    const milestones = [7, 14, 21, 30, 60, 90];
    const mHit = player.streakMilestonesHit || [];
    for (const m of milestones) {
      if (player.streakDays >= m && !mHit.includes(m)) {
        player.statPoints.DIS_acc += 5;
        const newDIS = Math.floor(player.statPoints.DIS_acc / 10) + 1;
        if (newDIS > player.stats.DIS) {
          statsGained.DIS = (statsGained.DIS || 0) + (newDIS - player.stats.DIS);
          player.stats.DIS = newDIS;
        }
        mHit.push(m);
      }
    }
    player.streakMilestonesHit = mHit;

    logEntry.xpEarned    = xpResult.total;
    logEntry.routineBonus = routineBonus;
    logEntry.statsGained = statsGained;

    Store.appendLog(logEntry);
    Store.setPlayer(player);
    Store.recordStatSnapshot(player, today);

    const questUpdates = Quests.updateProgress(today, Store.weekStart());

    const defeatedMonster = null;

    const freshPlayer   = Store.getPlayer();
    const freshMonsters = Store.getMonsters();
    const newAchievements = Achievements.check(freshPlayer, freshMonsters);

    const hpPlayer = Store.getPlayer();
    hpPlayer.hpMax = 100 + (hpPlayer.stats.VIT * 15);
    const hpResult = computeHPChanges(logEntry, hpPlayer, today, Store.getLog());

    // A meal heal that pushes you above 0 HP revives a knocked-out player.
    if (hpPlayer.knockedOut && hpPlayer.hp > 0) {
      hpPlayer.knockedOut = false;
    }

    let knockedOut = false;
    if (hpPlayer.hp <= 0) {
      triggerKnockOut(hpPlayer);
      knockedOut = true;
    } else {
      hpPlayer.hp = Math.min(hpPlayer.hp, hpPlayer.hpMax);
    }

    Store.setPlayer(hpPlayer);
    Bus.emit('stats-updated');

    return {
      xpEarned:       xpResult.total,
      streakBonus:    xpResult.streakBonus,
      fullDayBonus,
      routineBonus,
      statsGained,
      newLevels,
      questUpdates,
      newAchievements,
      defeatedMonster: null,
      hpDelta:        hpResult.hpDelta,
      mealQualities:  hpResult.mealQualities,
      hpBreakdown:    hpResult.hpBreakdown,
      knockedOut,
      hpAfter:        hpPlayer.hp,
      hpMax:          hpPlayer.hpMax,
      bonusApplied,
      bonus:          bonusApplied ? activeBonus : null,
    };
  }

  /* ── Public introspection helpers ─────────── */

  function daysUntilCycleEnd(player, today) {
    if (!player.cycleStart) return CYCLE_DAYS;
    const elapsed = daysBetween(player.cycleStart, today);
    return Math.max(0, CYCLE_DAYS - elapsed);
  }

  function statDecayStatus(player, today) {
    // Returns { STR: {idle, decayingIn}, ... }
    const out = {};
    if (!player.statDecay) return out;
    for (const stat of ['STR', 'AGI', 'VIT', 'DIS']) {
      const last = player.statDecay[stat + '_lastGain'];
      if (!last) continue;
      const idle = daysBetween(last, today);
      out[stat] = {
        idle,
        decayingIn: Math.max(0, DECAY_GRACE_DAYS - idle),
        isDecaying: idle > DECAY_GRACE_DAYS,
      };
    }
    return out;
  }

  return {
    CYCLE_DAYS,
    DECAY_GRACE_DAYS,
    DECAY_RATE_PER_DAY,
    BONUS_POOL,
    BONUS_WINDOW_MS,
    BONUS_MULTIPLIER,
    HP_DECAY_PER_HOUR,
    MONSTER_ATTACK_INTERVAL_MS,
    MONSTER_ATTACK_DAMAGE,
    xpToNextLevel,
    getDerivedStats,
    processLogEntry,
    computeMealHeal,
    classifyMeal,
    computeAttack,
    updateEnergyRegen,
    applyHpDecay,
    applyMonsterAttacks,
    applySurvivalTicks,
    applyDISMitigation,
    rolloverCycleIfNeeded,
    applyStatDecay,
    daysUntilCycleEnd,
    statDecayStatus,
    getActiveBonus,
    rollBonus,
  };
})();
