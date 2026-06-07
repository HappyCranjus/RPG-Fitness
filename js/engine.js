/* ─────────────────────────────────────────────
   Engine — XP, stats, damage, leveling, cycles,
   30-min stat decay, daily Discipline Tier,
   added-sugar damage, AGI dodge, VIT resist.
   ───────────────────────────────────────────── */

const Engine = (() => {

  /* ── Stat curve: cost(n → n+1) = 8 + n ──
     Cumulative acc to reach stat N: 8*(N-1) + (N-1)*N/2 .
     A pushup still adds 0.05 STR_acc — the threshold to the
     next stat just gets longer as you climb. Linear-with-slope
     keeps high stats reachable while still rewarding the climb.
  ─────────────────────────────────────────── */
  const StatCurve = (() => {
    function costFor(n)           { return 8 + n; }
    function cumulativeFor(stat)  {
      const n = Math.max(0, stat - 1);
      return 8 * n + (n * (n + 1)) / 2;
    }
    function statFromAcc(acc) {
      let stat = 1, used = 0;
      while (used + costFor(stat) <= acc) {
        used += costFor(stat);
        stat++;
        if (stat > 500) break; // safety
      }
      return { stat, accIntoLevel: acc - used, nextCost: costFor(stat) };
    }
    function progressPct(acc) {
      const { accIntoLevel, nextCost } = statFromAcc(acc);
      return Math.min(100, Math.max(0, Math.round((accIntoLevel / nextCost) * 100)));
    }
    function nextThreshold(acc) {
      const { nextCost } = statFromAcc(acc);
      return nextCost;
    }
    return { costFor, cumulativeFor, statFromAcc, progressPct, nextThreshold };
  })();

  /* ── Tuning constants ─────────────────────── */

  const CYCLE_DAYS = 14;

  // Stat decay (acc per day, before tier multiplier).
  // Tier multiplier comes from today's discipline behavior.
  const STAT_DECAY_PER_DAY = { STR: 5, AGI: 4, VIT: 3 };
  const STAT_DECAY_TICK_MS = 30 * 60 * 1000;  // 30 minutes

  // HP survival loop
  const HP_DECAY_PER_HOUR          = 2;
  const MONSTER_ATTACK_INTERVAL_MS = 6 * 60 * 60 * 1000;
  const MONSTER_ATTACK_DAMAGE      = 10;

  // Daily HP bonuses for hitting nutrition milestones.
  const CAL_HEAL_BONUS_1   = 800;
  const CAL_HEAL_BONUS_2   = 1600;
  const CAL_HEAL_BONUS_HP  = 10;
  const PROTEIN_HEAL_BONUS = 30;

  // Added-sugar penalty: 2 HP per gram over the daily limit.
  const SUGAR_DMG_PER_GRAM = 2;

  // XP needed to reach the next level from `level`
  function xpToNextLevel(level) {
    return Math.floor(100 * Math.pow(level, 1.4));
  }

  // Derived combat stats (computed at runtime, never stored)
  function getDerivedStats(player) {
    const { STR, AGI, VIT } = player.stats;
    return {
      ATK: Math.floor(STR * 5),
      DEF: Math.floor(VIT * 1.5),    // soft "toughness" readout
      SPD: Math.floor(AGI * 2.0),
      MP:  Math.floor(VIT * 3.0),
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

  /* ── VIT-mitigated HP decay ──
     Accumulates fractional debt so resist scales smoothly.
     Resist = min(30%, VIT × 1%).
  ─────────────────────────────────────────── */

  function applyHpDecay(player, now) {
    if (!player.lastHpTickAt) {
      player.lastHpTickAt = now;
      return { damage: 0 };
    }
    if (player.knockedOut) {
      player.lastHpTickAt = now;
      return { damage: 0 };
    }
    const hours = (now - player.lastHpTickAt) / 3600000;
    if (hours <= 0) return { damage: 0 };

    const resist = Math.min(0.30, (player.stats.VIT || 1) * 0.01);
    const drain  = HP_DECAY_PER_HOUR * (1 - resist) * hours;
    player.hpDebt = (player.hpDebt || 0) + drain;

    const whole = Math.floor(player.hpDebt);
    if (whole > 0) {
      player.hp     = Math.max(0, (player.hp || 0) - whole);
      player.hpDebt = player.hpDebt - whole;
    }
    player.lastHpTickAt = now;
    return { damage: whole };
  }

  /* ── Monster 6h attacks with AGI dodge ──
     Each tick: dodge chance = min(50%, AGI × 1.5%).
     RNG is seeded per-tick so reloads don't change outcomes.
  ─────────────────────────────────────────── */

  function tickRng(seed) {
    // Simple deterministic hash → [0, 1)
    let x = seed | 0;
    x = (x ^ 61) ^ (x >>> 16);
    x = (x + (x << 3)) | 0;
    x = (x ^ (x >>> 4));
    x = Math.imul(x, 0x27d4eb2d);
    x = x ^ (x >>> 15);
    return ((x >>> 0) % 100000) / 100000;
  }

  function applyMonsterAttacks(player, monster, now) {
    if (!monster || !player.lastMonsterAttackAt || player.knockedOut) {
      player.lastMonsterAttackAt = now;
      return { damage: 0, ticksApplied: 0, dodged: 0 };
    }
    const elapsed = now - player.lastMonsterAttackAt;
    const ticks   = Math.floor(elapsed / MONSTER_ATTACK_INTERVAL_MS);
    if (ticks <= 0) return { damage: 0, ticksApplied: 0, dodged: 0 };

    const dodgeChance = Math.min(0.50, (player.stats.AGI || 1) * 0.015);
    let landed = 0, dodged = 0;
    const anchor = player.lastMonsterAttackAt;
    for (let i = 0; i < ticks; i++) {
      const r = tickRng(anchor + i * MONSTER_ATTACK_INTERVAL_MS);
      if (r < dodgeChance) dodged++;
      else                 landed++;
    }
    const damage = landed * MONSTER_ATTACK_DAMAGE;
    player.hp = Math.max(0, (player.hp || 0) - damage);
    player.lastMonsterAttackAt += ticks * MONSTER_ATTACK_INTERVAL_MS;
    return { damage, ticksApplied: ticks, landed, dodged };
  }

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

  /* ── Explicit attack (Combat screen button) ──
     STR weakness amplifier: 1.5 + STR × 0.03.
  ─────────────────────────────────────────── */

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
      multiplier = 1.5 + (player.stats.STR || 1) * 0.03;
      matchType = 'weakness';
    } else if (loggedTypes.size > 0 && [...loggedTypes].every(t => resistances.includes(t))) {
      multiplier = 0.5;
      matchType = 'resistance';
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

  /* ── Rotating 6-hour activity bonus ─────────── */

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
    const delta = { STR_acc: 0, AGI_acc: 0, VIT_acc: 0 };
    let bonusApplied = false;

    for (const a of logEntry.activities) {
      const gains = ACTIVITY_STAT_PER_MIN[a.activityId] || { VIT: 0.2, STR: 0.1 };
      const isBonus = bonus && bonus.kind === 'activity' && bonus.itemId === a.activityId;
      const mult    = isBonus ? bonus.multiplier : 1;
      if (isBonus) bonusApplied = true;
      for (const [stat, rate] of Object.entries(gains)) {
        if (!((stat + '_acc') in delta)) continue;  // DIS and other dropped stats are no-ops
        delta[stat + '_acc'] += rate * a.durationMinutes * mult;
      }
    }

    for (const ex of logEntry.exercises) {
      const gains = EXERCISE_STAT_PER_REP[ex.exerciseId] || { STR: 0.05 };
      const isBonus = bonus && bonus.kind === 'exercise' && bonus.itemId === ex.exerciseId;
      const mult    = isBonus ? bonus.multiplier : 1;
      if (isBonus) bonusApplied = true;
      for (const [stat, rate] of Object.entries(gains)) {
        if (!((stat + '_acc') in delta)) continue;
        delta[stat + '_acc'] += rate * ex.totalReps * mult;
      }
    }

    return { delta, bonusApplied };
  }

  function applyStatDeltas(player, delta, today) {
    const gained = {};
    for (const key of Object.keys(delta)) {
      if (delta[key] <= 0) continue;
      const stat = key.replace('_acc', '');
      if (!(stat in player.stats)) continue;
      player.statPoints[key] = (player.statPoints[key] || 0) + delta[key];
      const newStatVal = StatCurve.statFromAcc(player.statPoints[key]).stat;
      if (newStatVal > player.stats[stat]) {
        gained[stat] = newStatVal - player.stats[stat];
        player.stats[stat] = newStatVal;
      }
      if (player.statDecay) player.statDecay[stat + '_lastGain'] = today;
    }
    return gained;
  }

  /* ── Discipline tier ──
     Computed live from today's log: workout + protein + calories +
     sugar-under-limit credits. Maps 0–4 points to a multiplier on
     ALL stat decay rates.
  ─────────────────────────────────────────── */

  const TIER_DEF = [
    { pts: 0, label: 'Very Low',  short: 'VL', mult: 1.5, color: '#e63946' },
    { pts: 1, label: 'Low',       short: 'L',  mult: 1.2, color: '#ff8c00' },
    { pts: 2, label: 'Moderate',  short: 'M',  mult: 1.0, color: '#ffd700' },
    { pts: 3, label: 'High',      short: 'H',  mult: 0.8, color: '#9aa75c' },
    { pts: 4, label: 'Very High', short: 'VH', mult: 0.6, color: '#2dc653' },
  ];

  function tierFor(points) {
    const p = Math.max(0, Math.min(4, points));
    return TIER_DEF[p];
  }

  function disciplineTier(player, todayLog) {
    const credits = {
      showUp:   false,
      protein:  false,
      calories: false,
      sugar:    false,
    };
    if (!Array.isArray(todayLog)) todayLog = [];

    if (todayLog.some(e => (e.activities && e.activities.length > 0) || (e.exercises && e.exercises.length > 0))) {
      credits.showUp = true;
    }

    const totalProtein = todayLog.reduce((s, e) =>
      s + (e.meals || []).reduce((ms, m) => ms + (m.proteinG || 0), 0), 0);
    if (totalProtein >= (player.goals.dailyProteinG || Infinity)) {
      credits.protein = true;
    }

    const totalCal = todayLog.reduce((s, e) =>
      s + (e.meals || []).reduce((ms, m) => ms + (m.calories || 0), 0), 0);
    const goalCal = player.goals.dailyCalories || 0;
    if (goalCal > 0 && totalCal > 0 && Math.abs(totalCal - goalCal) / goalCal <= 0.10) {
      credits.calories = true;
    }

    const totalSugar = todayLog.reduce((s, e) =>
      s + (e.meals || []).reduce((ms, m) => ms + (m.addedSugarG || 0), 0), 0);
    const sugarMax = player.goals.dailyAddedSugarMaxG ?? 36;
    const anyMealsLogged = todayLog.some(e => (e.meals || []).length > 0);
    if (anyMealsLogged && totalSugar <= sugarMax) {
      credits.sugar = true;
    }

    const points = (credits.showUp?1:0) + (credits.protein?1:0)
                 + (credits.calories?1:0) + (credits.sugar?1:0);
    const tier   = tierFor(points);
    return { points, credits, tier, totals: { protein: totalProtein, calories: totalCal, sugar: totalSugar } };
  }

  /* ── 30-min stat decay tick (continuous, lazy) ──
     Single global anchor advances by consumed time. Tier
     multiplier from yesterday's behavior (or today's if mid-day)
     scales per-stat drain. Stats drop when accumulator floors
     below the cumulative threshold for the current stat.
  ─────────────────────────────────────────── */

  function applyStatDecay(player, today) {
    const now = Date.now();
    if (!player.lastStatDecayTickAt) {
      player.lastStatDecayTickAt = now;
      return { decayed: {}, ticksApplied: 0, multiplier: 1, points: 0, tier: tierFor(2) };
    }
    if (player.knockedOut) {
      player.lastStatDecayTickAt = now;
      return { decayed: {}, ticksApplied: 0, multiplier: 1, points: 0, tier: tierFor(2) };
    }
    const elapsed = now - player.lastStatDecayTickAt;
    const ticks   = Math.floor(elapsed / STAT_DECAY_TICK_MS);
    if (ticks <= 0) {
      return { decayed: {}, ticksApplied: 0, multiplier: 1, points: 0, tier: tierFor(2) };
    }

    // Current discipline tier scales the drain.
    const todayLog = Store.getLog().filter(e => e.date === today);
    const tierInfo = disciplineTier(player, todayLog);
    const mult     = tierInfo.tier.mult;

    const decayed = {};
    const ticksAsHoursFraction = (ticks * STAT_DECAY_TICK_MS) / 3600000;
    for (const stat of ['STR', 'AGI', 'VIT']) {
      if (!(stat in player.stats)) continue;
      const base    = STAT_DECAY_PER_DAY[stat] || 0;
      const drainHr = base / 24;
      const drain   = drainHr * mult * ticksAsHoursFraction;
      if (drain <= 0) continue;
      const accKey  = stat + '_acc';
      const before  = player.stats[stat];
      player.statPoints[accKey] = Math.max(0, (player.statPoints[accKey] || 0) - drain);
      const after   = StatCurve.statFromAcc(player.statPoints[accKey]).stat;
      if (after < before) {
        decayed[stat] = before - after;
        player.stats[stat] = Math.max(1, after);
      }
    }
    player.lastStatDecayTickAt += ticks * STAT_DECAY_TICK_MS;

    // Recompute HP/Energy ceilings if VIT/AGI dropped
    if (decayed.VIT) {
      player.hpMax = 100 + (player.stats.VIT * 15);
      if (player.hp > player.hpMax) player.hp = player.hpMax;
    }
    if (decayed.AGI) {
      player.maxEnergy = 30 + (player.stats.AGI * 5);
      if (player.energy > player.maxEnergy) player.energy = player.maxEnergy;
    }
    if (Object.keys(decayed).length > 0) {
      player.cycleDecayHits = (player.cycleDecayHits || 0) + 1;
    }

    if (player.statDecay) player.statDecay.lastDecayCheck = today;
    return { decayed, ticksApplied: ticks, multiplier: mult, points: tierInfo.points, tier: tierInfo.tier };
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

  /* ── Cycle rollover ──────────────────────── */

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

    const cycleEnd = new Date(player.cycleStart + 'T00:00:00');
    cycleEnd.setDate(cycleEnd.getDate() + CYCLE_DAYS - 1);
    const cycleEndISO = cycleEnd.toISOString().slice(0, 10);

    const statSum = (player.stats.STR || 0) + (player.stats.AGI || 0) + (player.stats.VIT || 0);
    Store.appendCycleHistory({
      cycleStart:    player.cycleStart,
      cycleEnd:      cycleEndISO,
      peakLevel:     player.cyclePeakLevel || player.level || 1,
      totalXpEarned: player.cycleXpEarned  || 0,
      daysActive:    player.cycleDaysActive || 0,
      decayHits:     player.cycleDecayHits  || 0,
      finalStatSum:  statSum,
    });

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

  /* ── Damage computation ───────────────────── */

  function weaknessMultiplier(STR) {
    return 1.5 + (STR || 1) * 0.03;
  }

  function damageForItem(type, baseDamage, monster, player) {
    const weak = monster.weaknesses || [];
    const res  = monster.resistances || [];
    if (weak.includes(type)) {
      return { dmg: Math.floor(baseDamage * weaknessMultiplier(player.stats.STR)), match: 'weakness' };
    }
    if (res.includes(type)) {
      return { dmg: Math.floor(baseDamage * 0.5), match: 'resistance' };
    }
    return { dmg: baseDamage, match: 'neutral' };
  }

  function computeDamage(logEntry, monster, player) {
    if (!monster) return { total: 0, breakdown: [] };
    const derived = getDerivedStats(player);
    const breakdown = [];
    let total = 0;

    for (const a of logEntry.activities) {
      const base = Math.floor(a.durationMinutes * 1.2);
      const { dmg, match } = damageForItem(a.type, base, monster, player);
      total += dmg;
      breakdown.push({ name: a.name + ' ' + a.durationMinutes + 'min', dmg, match });
    }

    for (const ex of logEntry.exercises) {
      const base = Math.floor(ex.totalReps * 0.3);
      const { dmg, match } = damageForItem(ex.type, base, monster, player);
      total += dmg;
      breakdown.push({ name: ex.name + ' ' + ex.totalReps + ' reps', dmg, match });
    }

    if (logEntry.meals.length > 0) {
      const base = Math.floor(derived.MP / 4) * logEntry.meals.length;
      const { dmg, match } = damageForItem('diet', Math.max(base, 1), monster, player);
      total += dmg;
      breakdown.push({ name: 'Meals logged', dmg, match });
    }

    return { total, breakdown };
  }

  /* ── Preview (called live from log form) ──── */

  function previewDamage(activities, exercises, meals, monster, player) {
    const tempEntry = { activities, exercises, meals };
    const dmgResult = monster ? computeDamage(tempEntry, monster, player) : { total: 0, breakdown: [] };

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

    // Stat delta preview, factoring active bonus.
    const bonus = getActiveBonus(Date.now());
    const { delta, bonusApplied } = computeStatDeltas(tempEntry, bonus);
    const statPreview = { STR: delta.STR_acc || 0, AGI: delta.AGI_acc || 0, VIT: delta.VIT_acc || 0 };

    return { ...dmgResult, totalXP, totalCal, statPreview, bonusApplied };
  }

  /* ── Food quality / HP — meals heal, sugar overage damages ── */

  function computeMealHeal(meal, todayCaloriesBefore, dailyCalGoal) {
    if (todayCaloriesBefore >= dailyCalGoal) return 0;
    return Math.floor((meal.calories || 0) / 100)
         + Math.floor((meal.proteinG || 0) /   3);
  }

  // Only the portion of THIS meal that crosses the daily sugar limit.
  function sugarOverageForMeal(meal, sugarBefore, sugarMax) {
    const gThis = meal.addedSugarG || 0;
    const before = Math.max(0, sugarBefore - sugarMax);
    const after  = Math.max(0, sugarBefore + gThis - sugarMax);
    return Math.max(0, after - before);
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
    const sugarMax     = player.goals.dailyAddedSugarMaxG ?? 36;

    // Pre-entry day totals (fullLog already includes the just-appended entry, so exclude it).
    const priorToday = fullLog.filter(e => e.date === today && e.id !== entry.id);
    let runningCal     = priorToday.reduce((sum, e) => sum + e.meals.reduce((s, m) => s + (m.calories || 0), 0), 0);
    let runningProtein = priorToday.reduce((sum, e) => sum + e.meals.reduce((s, m) => s + (m.proteinG || 0), 0), 0);
    let runningSugar   = priorToday.reduce((sum, e) => sum + e.meals.reduce((s, m) => s + (m.addedSugarG || 0), 0), 0);

    const mealQualities = [];
    let mealHealTotal = 0;
    let sugarDmgTotal = 0;
    let cal800Bonus   = 0;
    let cal1600Bonus  = 0;
    let proteinBonus  = 0;

    for (const meal of entry.meals) {
      const heal      = computeMealHeal(meal, runningCal, dailyCalGoal);
      const overage   = sugarOverageForMeal(meal, runningSugar, sugarMax);
      const sugarDmg  = overage * SUGAR_DMG_PER_GRAM;
      const quality   = classifyMeal(meal);
      const netHp     = heal - sugarDmg;

      if (heal > 0)     { player.hp += heal;     mealHealTotal += heal; }
      if (sugarDmg > 0) { player.hp -= sugarDmg; sugarDmgTotal += sugarDmg; }

      mealQualities.push({
        name: meal.name || 'Meal',
        hp: netHp,
        heal,
        sugarDmg,
        overage,
        label: quality.label,
        emoji: quality.emoji,
      });

      runningCal     += meal.calories || 0;
      runningProtein += meal.proteinG || 0;
      runningSugar   += meal.addedSugarG || 0;

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

    player.hp = Math.min(player.hpMax, Math.max(0, player.hp));
    const hpDelta = mealHealTotal - sugarDmgTotal + cal800Bonus + cal1600Bonus + proteinBonus;

    return {
      hpDelta,
      mealQualities,
      sugarTotalToday: runningSugar,
      sugarMax,
      hpBreakdown: { mealHeal: mealHealTotal, sugarDmg: sugarDmgTotal, cal800Bonus, cal1600Bonus, proteinBonus },
    };
  }

  function triggerKnockOut(player) {
    for (const stat of ['STR', 'AGI', 'VIT']) {
      if (!(stat in player.stats)) continue;
      player.stats[stat]               = Math.max(1, Math.floor(player.stats[stat] / 2));
      player.statPoints[stat + '_acc'] = Math.max(0, Math.floor((player.statPoints[stat + '_acc'] || 0) / 2));
    }
    player.hpMax      = 100 + (player.stats.VIT * 15);
    player.hp         = Math.floor(player.hpMax * 0.5);
    player.maxEnergy  = 30 + (player.stats.AGI * 5);
    player.energy     = Math.min(player.energy || 0, player.maxEnergy);
    player.knockedOut = true;
    player.lastHpTickAt        = Date.now();
    player.lastMonsterAttackAt = Date.now();
    player.lastStatDecayTickAt = Date.now();
    Quests.resetDailyWeeklyProgress();
  }

  /* ── Main entry point ─────────────────────── */

  function processLogEntry(logEntry) {
    const player   = Store.getPlayer();
    const today    = Store.today();
    const log      = Store.getLog();
    const todayLog = log.filter(e => e.date === today);

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

    const statsGained = applyStatDeltas(player, delta, today);

    if (statsGained.VIT) {
      player.hpMax = 100 + (player.stats.VIT * 15);
    }
    if (statsGained.AGI) {
      player.maxEnergy = 30 + (player.stats.AGI * 5);
      player.energy    = Math.min(player.energy || 0, player.maxEnergy);
    }

    const newLevels = checkLevelUp(player);

    logEntry.xpEarned    = xpResult.total;
    logEntry.routineBonus = routineBonus;
    logEntry.statsGained = statsGained;

    Store.appendLog(logEntry);
    Store.setPlayer(player);
    Store.recordStatSnapshot(player, today);

    const questUpdates = Quests.updateProgress(today, Store.weekStart());

    const freshPlayer   = Store.getPlayer();
    const freshMonsters = Store.getMonsters();
    const newAchievements = Achievements.check(freshPlayer, freshMonsters);

    const hpPlayer = Store.getPlayer();
    hpPlayer.hpMax = 100 + (hpPlayer.stats.VIT * 15);
    const hpResult = computeHPChanges(logEntry, hpPlayer, today, Store.getLog());

    // A meal-heal that pushes HP above 0 revives a KO'd player.
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

    // Compute final tier after the log lands so the modal can show it.
    const tierAfter = disciplineTier(hpPlayer, [...todayLog, logEntry]);

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
      sugarTotalToday: hpResult.sugarTotalToday,
      sugarMax:        hpResult.sugarMax,
      knockedOut,
      hpAfter:        hpPlayer.hp,
      hpMax:          hpPlayer.hpMax,
      bonusApplied,
      bonus:          bonusApplied ? activeBonus : null,
      statDeltas:     { STR: delta.STR_acc || 0, AGI: delta.AGI_acc || 0, VIT: delta.VIT_acc || 0 },
      tier:           tierAfter,
    };
  }

  /* ── Public introspection helpers ─────────── */

  function daysUntilCycleEnd(player, today) {
    if (!player.cycleStart) return CYCLE_DAYS;
    const elapsed = daysBetween(player.cycleStart, today);
    return Math.max(0, CYCLE_DAYS - elapsed);
  }

  // Time until the next 30-min stat decay tick fires.
  function msUntilNextStatTick(player, now) {
    if (!player.lastStatDecayTickAt) return STAT_DECAY_TICK_MS;
    const elapsed = (now || Date.now()) - player.lastStatDecayTickAt;
    const next = STAT_DECAY_TICK_MS - (elapsed % STAT_DECAY_TICK_MS);
    return Math.max(0, next);
  }

  // Time until the next integer HP loss given current VIT and accumulated debt.
  function msUntilNextHpTick(player, now) {
    if (player.knockedOut) return Infinity;
    const resist = Math.min(0.30, (player.stats.VIT || 1) * 0.01);
    const drainPerMs = (HP_DECAY_PER_HOUR * (1 - resist)) / 3600000;
    if (drainPerMs <= 0) return Infinity;
    const debtNeeded = 1 - (player.hpDebt || 0);
    const last = player.lastHpTickAt || Date.now();
    const accruedSinceLast = drainPerMs * ((now || Date.now()) - last);
    const remaining = Math.max(0, debtNeeded - accruedSinceLast);
    return Math.ceil(remaining / drainPerMs);
  }

  return {
    // constants
    CYCLE_DAYS,
    STAT_DECAY_PER_DAY,
    STAT_DECAY_TICK_MS,
    BONUS_POOL,
    BONUS_WINDOW_MS,
    BONUS_MULTIPLIER,
    HP_DECAY_PER_HOUR,
    MONSTER_ATTACK_INTERVAL_MS,
    MONSTER_ATTACK_DAMAGE,
    SUGAR_DMG_PER_GRAM,
    TIER_DEF,

    // math helpers
    statCurve: StatCurve,
    xpToNextLevel,
    getDerivedStats,
    weaknessMultiplier,

    // main flows
    processLogEntry,
    computeMealHeal,
    sugarOverageForMeal,
    classifyMeal,
    computeAttack,
    updateEnergyRegen,
    applyHpDecay,
    applyMonsterAttacks,
    applySurvivalTicks,
    rolloverCycleIfNeeded,
    applyStatDecay,
    disciplineTier,
    tierFor,

    // introspection
    daysUntilCycleEnd,
    msUntilNextStatTick,
    msUntilNextHpTick,

    // bonus rotation
    getActiveBonus,
    rollBonus,

    // previews
    previewDamage,
  };
})();
