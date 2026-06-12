const Store = (() => {
  const PREFIX = 'eapp_';

  function get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }

  // Format a Date as a local YYYY-MM-DD string. Using toISOString() would
  // emit the UTC date, which causes "today" to roll over at UTC midnight
  // instead of the user's local midnight.
  function formatLocalDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function todayISO() {
    return formatLocalDate(new Date());
  }

  function makePlayer(name, dailyCalories, dailyProteinG, dailyCarbsG, dailyFatsG, dailyAddedSugarMaxG) {
    const today = todayISO();
    const now   = Date.now();
    return {
      name,
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      gold: 0,
      stats: { STR: 1, AGI: 1, VIT: 1 },
      statPoints: { STR_acc: 0, AGI_acc: 0, VIT_acc: 0 },
      statDecay: {
        STR_lastGain: today, AGI_lastGain: today,
        VIT_lastGain: today,
        lastDecayCheck: today,
      },
      goals: {
        dailyCalories: Number(dailyCalories),
        dailyProteinG: Number(dailyProteinG),
        dailyCarbsG:   Number(dailyCarbsG || 0),
        dailyFatsG:    Number(dailyFatsG || 0),
        dailyAddedSugarMaxG: Number(dailyAddedSugarMaxG || 36),
        dailyFiberG:   30,
        dailyWaterOz:  64,
        weightTargetLbs: null,
      },
      cycleStart: today,
      cyclePeakLevel: 1,
      cycleXpEarned: 0,
      cycleDaysActive: 0,
      cycleDecayHits: 0,
      cycleLastActiveDate: null,
      totalActivitiesLogged: 0,
      totalExercisesLogged: 0,
      totalMealsLogged: 0,
      totalXpEarned: 0,
      proteinGoalHits: 0,
      calorieGoalHits: 0,
      streakDays: 0,
      lastLogDate: null,
      streakMilestonesHit: [],
      hp:              115,
      hpMax:           115,
      hpDebt:          0,
      knockedOut:      false,
      lastHpTickAt:        now,
      lastMonsterAttackAt: now,
      lastStatDecayTickAt: now,
      dailyHealsAwarded:   { date: today, cal800: false, cal1600: false, protein: false },
      dailyStatBonusAwarded: { date: today, protein: false, fiberWater: false, calZone: false },
      energy:          35,
      maxEnergy:       35,
      lastEnergyUpdate: null,
      statCurveMigrated: true,
      createdAt: new Date().toISOString(),
    };
  }

  function getPlayer() {
    const p = get('player');
    if (!p) return null;
    const today = todayISO();
    const now   = Date.now();

    // Pre-existing migrations — fields that older saves may lack.
    if (p.hp === undefined) {
      p.hpMax       = 100 + ((p.stats.VIT || 1) * 15);
      p.hp          = p.hpMax;
      p.knockedOut  = false;
    }
    if (p.energy === undefined) {
      p.maxEnergy        = 30 + ((p.stats.AGI || 1) * 5);
      p.energy           = p.maxEnergy;
      p.lastEnergyUpdate = null;
    }
    if (!p.cycleStart) {
      p.cycleStart       = today;
      p.cyclePeakLevel   = p.level || 1;
      p.cycleXpEarned    = 0;
      p.cycleDaysActive  = 0;
      p.cycleDecayHits   = 0;
      p.cycleLastActiveDate = p.lastLogDate || null;
    }
    if (p.lastHpTickAt === undefined)        p.lastHpTickAt        = now;
    if (p.lastMonsterAttackAt === undefined) p.lastMonsterAttackAt = now;
    if (!p.dailyHealsAwarded || p.dailyHealsAwarded.date === undefined) {
      p.dailyHealsAwarded = { date: today, cal800: false, cal1600: false, protein: false };
    }
    if (!p.dailyStatBonusAwarded || p.dailyStatBonusAwarded.date === undefined) {
      p.dailyStatBonusAwarded = { date: today, protein: false, fiberWater: false, calZone: false };
    }

    // ── Cohesion-pass migration ────────────────
    // One-time reset to the new 3-stat curve so the displayed stat
    // numbers start fresh under the new threshold math. We also
    // initialize sugar goal, decay anchor, and HP debt accumulator.
    if (!p.statCurveMigrated) {
      p.stats = { STR: 1, AGI: 1, VIT: 1 };
      p.statPoints = { STR_acc: 0, AGI_acc: 0, VIT_acc: 0 };
      p.statDecay  = {
        STR_lastGain: today, AGI_lastGain: today, VIT_lastGain: today,
        lastDecayCheck: today,
      };
      if (!p.goals) p.goals = {};
      if (p.goals.dailyAddedSugarMaxG === undefined) p.goals.dailyAddedSugarMaxG = 36;
      p.hpMax    = 115;
      p.hp       = 115;
      p.hpDebt   = 0;
      p.maxEnergy = 35;
      p.energy    = 35;
      p.lastStatDecayTickAt = now;
      p.lastHpTickAt        = now;
      p.lastMonsterAttackAt = now;
      p.statCurveMigrated = true;
      // Stale fields from the old DIS system — harmless to keep, but
      // remove so the player object stays clean.
      delete p.disCredits;
    }

    // Late-arrival defaults for fields the migration above sets — if a
    // user upgrades multiple times, these guards keep everything safe.
    if (p.hpDebt === undefined)              p.hpDebt = 0;
    if (p.lastStatDecayTickAt === undefined) p.lastStatDecayTickAt = now;
    if (p.goals && p.goals.dailyAddedSugarMaxG === undefined) {
      p.goals.dailyAddedSugarMaxG = 36;
    }
    if (p.goals) {
      if (p.goals.dailyFiberG  === undefined) p.goals.dailyFiberG  = 30;
      if (p.goals.dailyWaterOz === undefined) p.goals.dailyWaterOz = 64;
      if (p.goals.weightTargetLbs === undefined) p.goals.weightTargetLbs = null;
    }
    return p;
  }

  return {
    isFirstRun() { return get('player') === null; },

    getPlayer,
    setPlayer(p)  { set('player', p); },
    makePlayer,

    getLog() { return get('log') || []; },
    appendLog(entry) {
      const log = get('log') || [];
      log.unshift(entry);
      if (log.length > 200) log.splice(200);
      set('log', log);
    },

    getQuests()    { return get('quests') || { active: [], completed: [], lastRefreshed: null }; },
    setQuests(q)   { set('quests', q); },

    getMonsters()  { return get('monsters') || { active: null, defeated: [], killCount: 0 }; },
    setMonsters(m) { set('monsters', m); },

    getAchievements()  { return get('achievements') || { unlocked: [], seen: [] }; },
    setAchievements(a) { set('achievements', a); },

    getAttacks() { return get('attacks') || []; },
    appendAttack(a) {
      const attacks = get('attacks') || [];
      attacks.unshift(a);
      if (attacks.length > 50) attacks.splice(50);
      set('attacks', attacks);
    },

    getCycleHistory()  { return get('cycleHistory') || []; },
    appendCycleHistory(record) {
      const hist = get('cycleHistory') || [];
      hist.unshift(record);
      if (hist.length > 100) hist.splice(100);
      set('cycleHistory', hist);
    },

    getSchedule() {
      return get('schedule') || { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null };
    },
    setSchedule(s) { set('schedule', s); },

    getBonus()      { return get('bonus') || null; },
    setBonus(b)     { set('bonus', b); },
    clearBonus()    { localStorage.removeItem(PREFIX + 'bonus'); },

    getStatHistory() { return get('statHistory') || []; },
    recordStatSnapshot(player, today) {
      const hist = get('statHistory') || [];
      const STR = player.stats.STR || 0;
      const AGI = player.stats.AGI || 0;
      const VIT = player.stats.VIT || 0;
      const sum = STR + AGI + VIT;
      const snap = { date: today, STR, AGI, VIT, sum, level: player.level };
      const idx = hist.findIndex(h => h.date === today);
      if (idx >= 0) hist[idx] = snap;
      else hist.unshift(snap);
      if (hist.length > 180) hist.splice(180);
      set('statHistory', hist);
    },

    getSettings() {
      return get('settings') || { weightUnit: 'lbs' };
    },
    setSettings(s) { set('settings', s); },

    getMealLibrary() { return get('mealLibrary') || []; },
    setMealLibrary(arr) { set('mealLibrary', arr); },

    // ── Weight log: one row per day, lbs + loggedAt timestamp ──
    getWeightLog() { return get('weightLog') || []; },
    getWeightToday() {
      const today = todayISO();
      return (get('weightLog') || []).find(r => r.date === today) || null;
    },
    setWeightToday(lbs) {
      const today = todayISO();
      const log = get('weightLog') || [];
      const idx = log.findIndex(r => r.date === today);
      const row = { date: today, lbs: Number(lbs), loggedAt: Date.now() };
      if (idx >= 0) log[idx] = row;
      else log.unshift(row);
      if (log.length > 365) log.splice(365);
      set('weightLog', log);
      return row;
    },

    // ── Sleep log: one row per day, hours + 1-5 star quality ──
    getSleepLog() { return get('sleepLog') || []; },
    getSleepToday() {
      const today = todayISO();
      return (get('sleepLog') || []).find(r => r.date === today) || null;
    },
    setSleepToday(hours, quality) {
      const today = todayISO();
      const log = get('sleepLog') || [];
      const idx = log.findIndex(r => r.date === today);
      const row = {
        date: today,
        hours: Number(hours),
        quality: Math.max(1, Math.min(5, Number(quality))),
        loggedAt: Date.now(),
      };
      if (idx >= 0) log[idx] = row;
      else log.unshift(row);
      if (log.length > 180) log.splice(180);
      set('sleepLog', log);
      return row;
    },

    // ── Water log: one row per day, ounces (mutate-in-place) ──
    getWaterLog() { return get('waterLog') || []; },
    getWaterToday() {
      const today = todayISO();
      const row = (get('waterLog') || []).find(r => r.date === today);
      return row ? row.oz : 0;
    },
    setWaterToday(oz) {
      const today = todayISO();
      const log = get('waterLog') || [];
      const idx = log.findIndex(r => r.date === today);
      const row = { date: today, oz: Math.max(0, Number(oz) || 0) };
      if (idx >= 0) log[idx] = row;
      else log.unshift(row);
      if (log.length > 180) log.splice(180);
      set('waterLog', log);
      return row.oz;
    },
    addWaterOz(n) {
      const current = this.getWaterToday();
      return this.setWaterToday(current + (Number(n) || 0));
    },

    clearAll() {
      ['player','log','quests','monsters','achievements','settings',
       'attacks','cycleHistory','schedule','statHistory','bonus',
       'mealLibrary','weightLog','sleepLog','waterLog'].forEach(k => {
        localStorage.removeItem(PREFIX + k);
      });
    },

    today: todayISO,

    weekStart() {
      const d = new Date();
      const day = d.getDay(); // 0=Sun, 1=Mon...
      const diff = (day === 0) ? -6 : 1 - day; // Monday as week start
      d.setDate(d.getDate() + diff);
      return formatLocalDate(d);
    },

    // Returns the lowercase weekday key for a given date (or today)
    weekdayKey(dateStr) {
      const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
      return ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()];
    },
  };
})();
