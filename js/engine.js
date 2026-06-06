/* ─────────────────────────────────────────────
   Engine — XP, stats, damage, leveling, cycles
   ───────────────────────────────────────────── */

const Engine = (() => {

  // Cycle length and decay tuning — single source of truth
  const CYCLE_DAYS         = 14;
  const DECAY_GRACE_DAYS   = 3;
  const DECAY_RATE_PER_DAY = { STR: 1.0, AGI: 0.7, VIT: 0.5, DIS: 1.5 };

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
      const xp = 10 + Math.floor((m.proteinG || 0) * 0.2);
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
  };

  const EXERCISE_STAT_PER_REP = {
    ex_pushup:   { STR: 0.05 },
    ex_situp:    { STR: 0.04 },
    ex_pullup:   { STR: 0.10, AGI: 0.02 },
    ex_squat:    { STR: 0.06 },
    ex_idl:      { STR: 0.07 },
    ex_dumbbell: { STR: 0.08 },
  };

  function computeStatDeltas(logEntry) {
    const delta = { STR_acc: 0, AGI_acc: 0, VIT_acc: 0, DIS_acc: 0 };

    for (const a of logEntry.activities) {
      const gains = ACTIVITY_STAT_PER_MIN[a.activityId]
        || { VIT: 0.2, STR: 0.1 };
      for (const [stat, rate] of Object.entries(gains)) {
        delta[stat + '_acc'] = (delta[stat + '_acc'] || 0) + rate * a.durationMinutes;
      }
    }

    for (const ex of logEntry.exercises) {
      const gains = EXERCISE_STAT_PER_REP[ex.exerciseId] || { STR: 0.05 };
      for (const [stat, rate] of Object.entries(gains)) {
        delta[stat + '_acc'] = (delta[stat + '_acc'] || 0) + rate * ex.totalReps;
      }
    }

    if (logEntry.meals.length > 0) {
      delta.VIT_acc += logEntry.meals.length * 0.5;
    }

    return delta;
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
     If full macros are present, score by macro balance.
     Otherwise fall back to the legacy calorie/protein ratio.
  ─────────────────────────────────────────────── */

  function computeMealHP(meal) {
    const cal  = meal.calories || 0;
    const prot = meal.proteinG || 0;
    const carbs = meal.carbsG;
    const fats  = meal.fatsG;
    const hasFullMacros = carbs !== undefined && carbs !== null &&
                          fats  !== undefined && fats  !== null &&
                          (carbs > 0 || fats > 0 || prot > 0);

    if (hasFullMacros && cal > 0) {
      // Macro-aware scoring
      const protCals  = prot  * 4;
      const carbCals  = (carbs || 0) * 4;
      const fatCals   = (fats  || 0) * 9;
      const macroCals = protCals + carbCals + fatCals;
      // Reject meals with no macros at all — treat as junk
      if (macroCals < cal * 0.5) return { hpDelta: -12, label: 'Junk', emoji: '🔴' };

      const protPct = protCals / Math.max(1, macroCals);
      const fatPct  = fatCals  / Math.max(1, macroCals);

      // Excellent: ≥25% protein, fat ≤40%
      if (protPct >= 0.25 && fatPct <= 0.40) return { hpDelta: 15, label: 'Excellent', emoji: '✅' };
      // Good: ≥18% protein, fat ≤50%
      if (protPct >= 0.18 && fatPct <= 0.50) return { hpDelta: 8, label: 'Good', emoji: '🟢' };
      // Neutral: ≥10% protein, fat ≤60%
      if (protPct >= 0.10 && fatPct <= 0.60) return { hpDelta: 2, label: 'Neutral', emoji: '⬜' };
      // Poor: any protein at all
      if (protPct > 0) return { hpDelta: -5, label: 'Poor', emoji: '🟡' };
      return { hpDelta: -12, label: 'Junk', emoji: '🔴' };
    }

    // Legacy fallback (calories + protein only)
    if (!prot) return { hpDelta: -12, label: 'Junk', emoji: '🔴' };
    const ratio = cal / Math.max(1, prot);
    if (ratio <= 8)  return { hpDelta: 15, label: 'Excellent', emoji: '✅' };
    if (ratio <= 15) return { hpDelta: 8,  label: 'Good',      emoji: '🟢' };
    if (ratio <= 25) return { hpDelta: 2,  label: 'Neutral',   emoji: '⬜' };
    if (ratio <= 40) return { hpDelta: -5, label: 'Poor',      emoji: '🟡' };
    return            { hpDelta: -12, label: 'Junk',      emoji: '🔴' };
  }

  function computeHPChanges(entry, player, today, fullLog) {
    const mealQualities = [];
    let hpDelta = 0;

    for (const meal of entry.meals) {
      const q = computeMealHP(meal);
      const mitigated = applyDISMitigation(q.hpDelta, player.stats.DIS);
      player.hp += mitigated;
      hpDelta   += mitigated;
      mealQualities.push({ name: meal.name || 'Meal', hpDelta: mitigated, label: q.label, emoji: q.emoji });
    }

    const todayEntries   = fullLog.filter(e => e.date === today);
    const todayCalories  = todayEntries.reduce((sum, e) => sum + e.meals.reduce((s, m) => s + (m.calories  || 0), 0), 0);
    const todayProtein   = todayEntries.reduce((sum, e) => sum + e.meals.reduce((s, m) => s + (m.proteinG  || 0), 0), 0);

    let overagePenalty = 0;
    if (todayCalories > player.goals.dailyCalories && player.hpDmgDealt !== today) {
      const overage = todayCalories - player.goals.dailyCalories;
      const rawPenalty = Math.floor((overage / player.goals.dailyCalories) * 30);
      overagePenalty = Math.abs(applyDISMitigation(-rawPenalty, player.stats.DIS));
      if (overagePenalty > 0) {
        player.hp        -= overagePenalty;
        hpDelta          -= overagePenalty;
        player.hpDmgDealt = today;
      }
    }

    let regenBonus = 0;
    if (todayProtein >= player.goals.dailyProteinG && player.hpRegenCredited !== today) {
      regenBonus = 15 + Math.floor(player.stats.DIS * 0.5);
      player.hp              = Math.min(player.hpMax, player.hp + regenBonus);
      hpDelta               += regenBonus;
      player.hpRegenCredited = today;
    }

    return { hpDelta, mealQualities, overagePenalty, regenBonus };
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

    if (player.knockedOut && player.hp >= player.hpMax * 0.5) {
      player.knockedOut = false;
    }

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

    const delta = computeStatDeltas(logEntry);

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
      overagePenalty: hpResult.overagePenalty,
      regenBonus:     hpResult.regenBonus,
      knockedOut,
      hpAfter:        hpPlayer.hp,
      hpMax:          hpPlayer.hpMax,
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
    xpToNextLevel,
    getDerivedStats,
    processLogEntry,
    computeMealHP,
    computeAttack,
    updateEnergyRegen,
    applyDISMitigation,
    rolloverCycleIfNeeded,
    applyStatDecay,
    daysUntilCycleEnd,
    statDecayStatus,
  };
})();
