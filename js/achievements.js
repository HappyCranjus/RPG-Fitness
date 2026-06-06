/* ─────────────────────────────────────────────
   Achievements — definitions and unlock checks
   ───────────────────────────────────────────── */

const Achievements = (() => {

  const DEFINITIONS = [
    { id: 'ach_first_log',      icon: '⚔️',  title: 'First Blood',       desc: 'Log anything for the first time.',            check: (p, m, log) => log.length >= 1 },
    { id: 'ach_first_monster',  icon: '🐉',  title: 'Monster Slayer',    desc: 'Defeat your first monster.',                  check: (p, m) => m.killCount >= 1 },
    { id: 'ach_streak_3',       icon: '🔥',  title: 'Three-Day Warrior', desc: 'Log 3 days in a row.',                        check: (p) => p.streakDays >= 3 },
    { id: 'ach_streak_7',       icon: '🔥',  title: 'Week of Iron',      desc: 'Log 7 days in a row.',                        check: (p) => p.streakDays >= 7 },
    { id: 'ach_streak_30',      icon: '👑',  title: 'Monthly Crusader',  desc: 'Log 30 days in a row.',                       check: (p) => p.streakDays >= 30 },
    { id: 'ach_level_5',        icon: '⭐',  title: 'Adventurer',        desc: 'Reach Level 5.',                              check: (p) => p.level >= 5 },
    { id: 'ach_level_10',       icon: '⭐',  title: 'Veteran',           desc: 'Reach Level 10.',                             check: (p) => p.level >= 10 },
    { id: 'ach_level_25',       icon: '🏆',  title: 'Champion',          desc: 'Reach Level 25.',                             check: (p) => p.level >= 25 },
    { id: 'ach_kills_1',        icon: '🗡️',  title: 'First Kill',        desc: 'Defeat 1 monster.',                           check: (p, m) => m.killCount >= 1 },
    { id: 'ach_kills_5',        icon: '🗡️',  title: 'Beast Hunter',      desc: 'Defeat 5 monsters.',                          check: (p, m) => m.killCount >= 5 },
    { id: 'ach_kills_20',       icon: '💀',  title: 'Monster Legend',    desc: 'Defeat 20 monsters.',                         check: (p, m) => m.killCount >= 20 },
    { id: 'ach_workouts_10',    icon: '💪',  title: 'Getting Serious',   desc: 'Log 10 total workouts.',                      check: (p) => (p.totalActivitiesLogged + p.totalExercisesLogged) >= 10 },
    { id: 'ach_workouts_100',   icon: '💪',  title: 'Century Club',      desc: 'Log 100 total workouts.',                     check: (p) => (p.totalActivitiesLogged + p.totalExercisesLogged) >= 100 },
    { id: 'ach_protein_30',     icon: '🥩',  title: 'Protein Sage',      desc: 'Hit your protein goal 30 times.',             check: (p) => (p.proteinGoalHits || 0) >= 30 },
    { id: 'ach_dis_20',         icon: '🛡️',  title: 'Iron Will',         desc: 'Reach DIS stat 20.',                          check: (p) => p.stats.DIS >= 20 },
    { id: 'ach_all_stats_10',   icon: '✨',  title: 'Well-Rounded',      desc: 'Reach 10 in every stat.',                     check: (p) => Object.values(p.stats).every(v => v >= 10) },
    { id: 'ach_dog_walks_20',   icon: '🐕',  title: 'Good Owner',        desc: 'Log 20 dog walk sessions.',                   check: (p, m, log) => log.filter(e => e.activities.some(a => a.activityId === 'act_walkdog')).length >= 20 },
    { id: 'ach_meals_100',      icon: '🍽️',  title: 'Disciplined Eater', desc: 'Log 100 total meals.',                        check: (p) => (p.totalMealsLogged || 0) >= 100 },
    { id: 'ach_str_15',         icon: '⚔️',  title: 'Strength Titan',    desc: 'Reach STR stat 15.',                          check: (p) => p.stats.STR >= 15 },
    { id: 'ach_agi_15',         icon: '🏃',  title: 'Swift Hunter',      desc: 'Reach AGI stat 15.',                          check: (p) => p.stats.AGI >= 15 },
    { id: 'ach_rank_c',         icon: '🥉',  title: 'C-Rank Awakened',   desc: 'Reach C Rank (51 total stat points).',        check: (p) => (typeof Ranks !== 'undefined') && ['C','B','A','S','N'].includes(Ranks.getRank(p).tier) },
    { id: 'ach_rank_s',         icon: '🥇',  title: 'S-Rank Hunter',     desc: 'Reach S Rank (301 total stat points).',       check: (p) => (typeof Ranks !== 'undefined') && ['S','N'].includes(Ranks.getRank(p).tier) },
    { id: 'ach_cycle_clean',    icon: '🛡️',  title: 'Unbroken',          desc: 'Complete a 2-week cycle without any stat decay.', check: (p) => {
      const hist = Store.getCycleHistory ? Store.getCycleHistory() : [];
      return hist.some(c => (c.decayHits || 0) === 0 && (c.daysActive || 0) >= 10);
    }},
  ];

  function check(player, monstersState) {
    const state    = Store.getAchievements();
    const log      = Store.getLog();
    const unlockedIds = new Set(state.unlocked.map(u => u.id));
    const newUnlocks  = [];

    for (const def of DEFINITIONS) {
      if (unlockedIds.has(def.id)) continue;
      try {
        if (def.check(player, monstersState, log)) {
          state.unlocked.push({ id: def.id, unlockedAt: new Date().toISOString() });
          newUnlocks.push(def);
        }
      } catch { /* ignore check errors */ }
    }

    if (newUnlocks.length > 0) Store.setAchievements(state);
    return newUnlocks;
  }

  function isUnlocked(id) {
    const state = Store.getAchievements();
    return state.unlocked.some(u => u.id === id);
  }

  function getAll() {
    const state = Store.getAchievements();
    const unlockedIds = new Set(state.unlocked.map(u => u.id));
    return DEFINITIONS.map(def => ({
      ...def,
      unlocked:    unlockedIds.has(def.id),
      unlockedAt:  state.unlocked.find(u => u.id === def.id)?.unlockedAt || null,
    }));
  }

  return { DEFINITIONS, check, isUnlocked, getAll };
})();
