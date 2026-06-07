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

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function makePlayer(name, dailyCalories, dailyProteinG, dailyCarbsG, dailyFatsG) {
    const today = todayISO();
    return {
      name,
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      gold: 0,
      stats: { STR: 1, AGI: 1, VIT: 1, DIS: 1 },
      statPoints: { STR_acc: 0, AGI_acc: 0, VIT_acc: 0, DIS_acc: 0 },
      statDecay: {
        STR_lastGain: today, AGI_lastGain: today,
        VIT_lastGain: today, DIS_lastGain: today,
        lastDecayCheck: today,
      },
      goals: {
        dailyCalories: Number(dailyCalories),
        dailyProteinG: Number(dailyProteinG),
        dailyCarbsG:   Number(dailyCarbsG || 0),
        dailyFatsG:    Number(dailyFatsG || 0),
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
      macroGoalHits:   0,
      streakDays: 0,
      lastLogDate: null,
      disCredits: { showUp: null, protein: null, calories: null, macros: null },
      streakMilestonesHit: [],
      hp:              115,
      hpMax:           115,
      hpBonusMax:      0,
      knockedOut:      false,
      hpDmgDealt:      null,
      hpRegenCredited: null,
      // Survival-loop anchors — lazy-tick like lastEnergyUpdate.
      lastHpTickAt:        Date.now(),
      lastMonsterAttackAt: Date.now(),
      dailyHealsAwarded:   { date: today, cal800: false, cal1600: false, protein: false },
      energy:          35,
      maxEnergy:       35,
      lastEnergyUpdate: null,
      createdAt: new Date().toISOString(),
    };
  }

  function getPlayer() {
    const p = get('player');
    if (!p) return null;
    const today = todayISO();

    if (p.hp === undefined) {
      p.hpMax          = 100 + (p.stats.VIT * 15);
      p.hp             = p.hpMax;
      p.hpBonusMax     = 0;
      p.knockedOut     = false;
      p.hpDmgDealt     = null;
      p.hpRegenCredited = null;
    }
    if (p.energy === undefined) {
      p.maxEnergy       = 30 + (p.stats.AGI * 5);
      p.energy          = p.maxEnergy;
      p.lastEnergyUpdate = null;
    }

    // Migrate older players to cycle + decay + macro fields
    if (!p.cycleStart) {
      p.cycleStart       = today;
      p.cyclePeakLevel   = p.level || 1;
      p.cycleXpEarned    = 0;
      p.cycleDaysActive  = 0;
      p.cycleDecayHits   = 0;
      p.cycleLastActiveDate = p.lastLogDate || null;
    }
    if (!p.statDecay) {
      p.statDecay = {
        STR_lastGain: p.lastLogDate || today,
        AGI_lastGain: p.lastLogDate || today,
        VIT_lastGain: p.lastLogDate || today,
        DIS_lastGain: p.lastLogDate || today,
        lastDecayCheck: today,
      };
    }
    if (p.goals && p.goals.dailyCarbsG === undefined) {
      p.goals.dailyCarbsG = 0;
      p.goals.dailyFatsG  = 0;
    }
    if (p.disCredits && p.disCredits.macros === undefined) {
      p.disCredits.macros = null;
    }
    if (p.macroGoalHits === undefined) {
      p.macroGoalHits = 0;
    }
    // Survival-loop migration: initialize anchors to now so existing
    // saves don't take retroactive damage on first load after the update.
    const now = Date.now();
    if (p.lastHpTickAt === undefined) {
      p.lastHpTickAt = now;
    }
    if (p.lastMonsterAttackAt === undefined) {
      p.lastMonsterAttackAt = now;
    }
    if (!p.dailyHealsAwarded || p.dailyHealsAwarded.date === undefined) {
      p.dailyHealsAwarded = { date: today, cal800: false, cal1600: false, protein: false };
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
      // Only one snapshot per day; replace if exists
      const sum = player.stats.STR + player.stats.AGI + player.stats.VIT + player.stats.DIS;
      const snap = { date: today, STR: player.stats.STR, AGI: player.stats.AGI,
                     VIT: player.stats.VIT, DIS: player.stats.DIS, sum, level: player.level };
      const idx = hist.findIndex(h => h.date === today);
      if (idx >= 0) hist[idx] = snap;
      else hist.unshift(snap);
      if (hist.length > 180) hist.splice(180);
      set('statHistory', hist);
    },

    getSettings() {
      return get('settings') || { weightUnit: 'kg' };
    },
    setSettings(s) { set('settings', s); },

    clearAll() {
      ['player','log','quests','monsters','achievements','settings',
       'attacks','cycleHistory','schedule','statHistory','bonus'].forEach(k => {
        localStorage.removeItem(PREFIX + k);
      });
    },

    today: todayISO,

    weekStart() {
      const d = new Date();
      const day = d.getDay(); // 0=Sun, 1=Mon...
      const diff = (day === 0) ? -6 : 1 - day; // Monday as week start
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    },

    // Returns the lowercase weekday key for a given date (or today)
    weekdayKey(dateStr) {
      const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
      return ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()];
    },
  };
})();
