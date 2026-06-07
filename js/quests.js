/* ─────────────────────────────────────────────
   Quest system — templates, rotation, progress
   ───────────────────────────────────────────── */

const Quests = (() => {

  const DAILY_TEMPLATES = [
    {
      id: 'dq_any_workout',
      type: 'daily',
      title: 'Show Up',
      description: 'Log any workout or activity today.',
      target: { metric: 'any_workout_sessions_today', value: 1 },
      reward: { xp: 30, gold: 5 },
    },
    {
      id: 'dq_cardio_20',
      type: 'daily',
      title: 'Cardio Day',
      description: 'Log 20+ minutes of cardio activities.',
      target: { metric: 'cardio_minutes_today', value: 20 },
      reward: { xp: 50, gold: 10 },
    },
    {
      id: 'dq_protein_goal',
      type: 'daily',
      title: 'Protein Push',
      description: 'Hit your daily protein target.',
      target: { metric: 'protein_goal_hit', value: 1 },
      reward: { xp: 60, gold: 12 },
    },
    {
      id: 'dq_3_meals',
      type: 'daily',
      title: 'Disciplined Eater',
      description: 'Log all 3 main meals (breakfast, lunch, dinner).',
      target: { metric: 'main_meals_today', value: 3 },
      reward: { xp: 40, gold: 10 },
    },
    {
      id: 'dq_walk_dog',
      type: 'daily',
      title: 'Good Owner',
      description: 'Log 20+ minutes walking the dog.',
      target: { metric: 'walk_minutes_today', value: 20 },
      reward: { xp: 30, gold: 5 },
    },
    {
      id: 'dq_bodyweight',
      type: 'daily',
      title: 'Bodyweight Brawl',
      description: 'Log any bodyweight exercise session.',
      target: { metric: 'bodyweight_sessions_today', value: 1 },
      reward: { xp: 45, gold: 8 },
    },
    {
      id: 'dq_swim_or_sports',
      type: 'daily',
      title: 'Active Life',
      description: 'Log swimming or a sports activity.',
      target: { metric: 'sports_or_swim_today', value: 1 },
      reward: { xp: 50, gold: 10 },
    },
    {
      id: 'dq_cardio_30',
      type: 'daily',
      title: 'Endurance Push',
      description: 'Log 30+ minutes of cardio today.',
      target: { metric: 'cardio_minutes_today', value: 30 },
      reward: { xp: 70, gold: 15 },
    },
    {
      id: 'dq_log_meal',
      type: 'daily',
      title: 'Track It',
      description: 'Log at least one meal today.',
      target: { metric: 'meals_today', value: 1 },
      reward: { xp: 20, gold: 4 },
    },
  ];

  const WEEKLY_TEMPLATES = [
    {
      id: 'wq_5_workouts',
      type: 'weekly',
      title: 'The Dedicated',
      description: 'Log 5 workouts or activities this week.',
      target: { metric: 'workout_sessions_this_week', value: 5 },
      reward: { xp: 200, gold: 50 },
    },
    {
      id: 'wq_nutrition_master',
      type: 'weekly',
      title: 'Nutrition Master',
      description: 'Log all 3 main meals on 5 different days this week.',
      target: { metric: 'full_meal_days_this_week', value: 5 },
      reward: { xp: 220, gold: 55 },
    },
    {
      id: 'wq_sports_week',
      type: 'weekly',
      title: 'Sports Week',
      description: 'Log 2+ sports or swimming sessions.',
      target: { metric: 'sports_or_swim_sessions_this_week', value: 2 },
      reward: { xp: 180, gold: 45 },
    },
    {
      id: 'wq_iron_week',
      type: 'weekly',
      title: 'Iron Week',
      description: 'Log 3+ bodyweight exercise sessions.',
      target: { metric: 'bodyweight_sessions_this_week', value: 3 },
      reward: { xp: 180, gold: 45 },
    },
    {
      id: 'wq_cardio_100',
      type: 'weekly',
      title: 'Century Run',
      description: 'Log 100+ minutes of cardio this week.',
      target: { metric: 'cardio_minutes_this_week', value: 100 },
      reward: { xp: 250, gold: 60 },
    },
    {
      id: 'wq_protein_5',
      type: 'weekly',
      title: 'Protein Week',
      description: 'Hit your protein goal on 5 different days.',
      target: { metric: 'protein_goal_days_this_week', value: 5 },
      reward: { xp: 230, gold: 55 },
    },
  ];

  const MILESTONE_TEMPLATES = [
    {
      id: 'mq_first_step',
      type: 'milestone',
      title: 'First Step',
      description: 'Log your very first workout.',
      target: { metric: 'total_sessions', value: 1 },
      reward: { xp: 100, gold: 20 },
    },
    {
      id: 'mq_getting_serious',
      type: 'milestone',
      title: 'Getting Serious',
      description: 'Log 10 total workouts.',
      target: { metric: 'total_sessions', value: 10 },
      reward: { xp: 250, gold: 50 },
    },
    {
      id: 'mq_century',
      type: 'milestone',
      title: 'Century Club',
      description: 'Log 100 total workouts.',
      target: { metric: 'total_sessions', value: 100 },
      reward: { xp: 1000, gold: 200 },
    },
    {
      id: 'mq_week_warrior',
      type: 'milestone',
      title: 'Week Warrior',
      description: 'Maintain a 7-day logging streak.',
      target: { metric: 'streak_days', value: 7 },
      reward: { xp: 350, gold: 75 },
    },
    {
      id: 'mq_month_warrior',
      type: 'milestone',
      title: 'Month Warrior',
      description: 'Maintain a 30-day logging streak.',
      target: { metric: 'streak_days', value: 30 },
      reward: { xp: 1000, gold: 200 },
    },
    {
      id: 'mq_level_5',
      type: 'milestone',
      title: 'Seasoned Adventurer',
      description: 'Reach Level 5.',
      target: { metric: 'player_level', value: 5 },
      reward: { xp: 0, gold: 100 },
    },
    {
      id: 'mq_level_10',
      type: 'milestone',
      title: 'Veteran',
      description: 'Reach Level 10.',
      target: { metric: 'player_level', value: 10 },
      reward: { xp: 0, gold: 200 },
    },
    {
      id: 'mq_protein_30',
      type: 'milestone',
      title: 'Protein Sage',
      description: 'Hit your protein goal 30 times.',
      target: { metric: 'protein_goal_hits', value: 30 },
      reward: { xp: 300, gold: 60 },
    },
    {
      id: 'mq_dog_walks_20',
      type: 'milestone',
      title: 'Good Owner',
      description: 'Log 20 dog walks.',
      target: { metric: 'dog_walk_sessions', value: 20 },
      reward: { xp: 200, gold: 40 },
    },
  ];

  /* ── Metric computation ──────────────────── */

  function getMetric(metric, log, player, today, weekStart) {
    const todayEntries  = log.filter(e => e.date === today);
    const weekEntries   = log.filter(e => e.date >= weekStart && e.date <= today);

    switch (metric) {
      case 'any_workout_sessions_today':
        return todayEntries.filter(e => e.activities.length > 0 || e.exercises.length > 0).length;

      case 'cardio_minutes_today':
        return todayEntries.reduce((sum, e) =>
          sum + e.activities.filter(a => a.type === 'cardio')
            .reduce((s, a) => s + (a.durationMinutes || 0), 0), 0);

      case 'protein_goal_hit': {
        const protein = todayEntries.reduce((sum, e) =>
          sum + e.meals.reduce((s, m) => s + (m.proteinG || 0), 0), 0);
        return protein >= player.goals.dailyProteinG ? 1 : 0;
      }

      case 'main_meals_today': {
        const types = new Set(todayEntries.flatMap(e =>
          e.meals.map(m => m.mealType).filter(t => ['breakfast','lunch','dinner'].includes(t))));
        return types.size;
      }

      case 'walk_minutes_today':
        return todayEntries.reduce((sum, e) =>
          sum + e.activities.filter(a => a.activityId === 'act_walkdog')
            .reduce((s, a) => s + (a.durationMinutes || 0), 0), 0);

      case 'bodyweight_sessions_today':
        return todayEntries.filter(e => e.exercises.some(ex => ex.type === 'bodyweight')).length;

      case 'sports_or_swim_today':
        return todayEntries.some(e =>
          e.activities.some(a => a.type === 'sports' || a.activityId === 'act_swim')) ? 1 : 0;

      case 'meals_today':
        return todayEntries.reduce((sum, e) => sum + e.meals.length, 0);

      // Weekly metrics
      case 'workout_sessions_this_week':
        return weekEntries.filter(e => e.activities.length > 0 || e.exercises.length > 0).length;

      case 'full_meal_days_this_week': {
        const days = new Set();
        for (const e of weekEntries) {
          const types = new Set(e.meals.map(m => m.mealType));
          if (types.has('breakfast') && types.has('lunch') && types.has('dinner')) {
            days.add(e.date);
          }
        }
        return days.size;
      }

      case 'sports_or_swim_sessions_this_week':
        return weekEntries.filter(e =>
          e.activities.some(a => a.type === 'sports' || a.activityId === 'act_swim')).length;

      case 'bodyweight_sessions_this_week':
        return weekEntries.filter(e => e.exercises.some(ex => ex.type === 'bodyweight')).length;

      case 'cardio_minutes_this_week':
        return weekEntries.reduce((sum, e) =>
          sum + e.activities.filter(a => a.type === 'cardio')
            .reduce((s, a) => s + (a.durationMinutes || 0), 0), 0);

      case 'protein_goal_days_this_week': {
        const dayTotals = {};
        for (const e of weekEntries) {
          dayTotals[e.date] = (dayTotals[e.date] || 0) +
            e.meals.reduce((s, m) => s + (m.proteinG || 0), 0);
        }
        return Object.values(dayTotals).filter(v => v >= player.goals.dailyProteinG).length;
      }

      // Milestone metrics (read from player)
      case 'total_sessions':
        return (player.totalActivitiesLogged || 0) + (player.totalExercisesLogged || 0);

      case 'streak_days':
        return player.streakDays || 0;

      case 'player_level':
        return player.level;

      case 'protein_goal_hits':
        return player.proteinGoalHits || 0;

      case 'dog_walk_sessions': {
        return log.filter(e => e.activities.some(a => a.activityId === 'act_walkdog')).length;
      }

      default:
        return 0;
    }
  }

  /* ── Refresh (rotate daily/weekly on new day) */

  function refresh(today, weekStart) {
    const state  = Store.getQuests();
    const player = Store.getPlayer();
    let changed  = false;

    // Rotate daily quests
    if (state.lastRefreshed !== today) {
      const completedDailyIds = state.completed
        .filter(c => c.date === today && c.type === 'daily')
        .map(c => c.templateId);

      // Remove old daily quests
      state.active = state.active.filter(q => q.type !== 'daily');

      // Pick 3 new daily quests (avoid recently completed)
      const pool = DAILY_TEMPLATES.filter(t => !completedDailyIds.includes(t.id));
      const shuffled = pool.sort(() => Math.random() - 0.5);
      for (const tpl of shuffled.slice(0, 3)) {
        state.active.push(instantiateQuest(tpl, today, weekStart));
      }

      // Rotate weekly quests on Monday or if never set
      const isMonday = new Date(today + 'T00:00:00').getDay() === 1;
      const currentWeeklyRefresh = state.lastWeeklyRefresh;
      const needsWeeklyRotation = !currentWeeklyRefresh || (isMonday && currentWeeklyRefresh !== weekStart);
      if (needsWeeklyRotation) {
        state.active = state.active.filter(q => q.type !== 'weekly');
        const weeklyPool = [...WEEKLY_TEMPLATES].sort(() => Math.random() - 0.5);
        for (const tpl of weeklyPool.slice(0, 2)) {
          state.active.push(instantiateQuest(tpl, today, weekStart));
        }
        state.lastWeeklyRefresh = weekStart;
      }

      // Ensure milestone quests are present (add if missing)
      for (const tpl of MILESTONE_TEMPLATES) {
        const alreadyComplete = state.completed.some(c => c.templateId === tpl.id);
        const alreadyActive   = state.active.some(q => q.templateId === tpl.id);
        if (!alreadyComplete && !alreadyActive) {
          state.active.push(instantiateQuest(tpl, today, weekStart));
        }
      }

      state.lastRefreshed = today;
      changed = true;
    } else {
      // Ensure milestone quests are always present
      for (const tpl of MILESTONE_TEMPLATES) {
        const alreadyComplete = state.completed.some(c => c.templateId === tpl.id);
        const alreadyActive   = state.active.some(q => q.templateId === tpl.id);
        if (!alreadyComplete && !alreadyActive) {
          state.active.push(instantiateQuest(tpl, today, weekStart));
          changed = true;
        }
      }
    }

    if (changed) Store.setQuests(state);
    return state;
  }

  function instantiateQuest(tpl, today, weekStart) {
    return {
      id:         tpl.id + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      templateId: tpl.id,
      type:       tpl.type,
      title:      tpl.title,
      description: tpl.description,
      target:     tpl.target,
      progress:   0,
      reward:     tpl.reward,
      expiresAt:  tpl.type === 'daily' ? today : (tpl.type === 'weekly' ? weekStart : null),
      completedAt: null,
    };
  }

  /* ── Update progress after a log save ──────── */

  function updateProgress(today, weekStart) {
    const state  = Store.getQuests();
    const player = Store.getPlayer();
    const log    = Store.getLog();
    const updates = [];

    for (const quest of state.active) {
      if (quest.completedAt) continue;
      const val = getMetric(quest.target.metric, log, player, today, weekStart);
      const prev = quest.progress;
      quest.progress = val;

      if (val >= quest.target.value) {
        quest.completedAt = new Date().toISOString();
        // Apply reward
        player.xp    += quest.reward.xp || 0;
        player.gold  += quest.reward.gold || 0;
        player.totalXpEarned += quest.reward.xp || 0;

        state.completed.unshift({
          templateId:  quest.templateId,
          type:        quest.type,
          title:       quest.title,
          date:        today,
          completedAt: quest.completedAt,
          reward:      quest.reward,
        });
        if (state.completed.length > 50) state.completed.splice(50);

        updates.push({ quest, wasCompleted: true, progress: val, prev });
      } else if (val !== prev) {
        updates.push({ quest, wasCompleted: false, progress: val, prev });
      }
    }

    Store.setQuests(state);
    if (updates.some(u => u.wasCompleted)) Store.setPlayer(player);
    return updates;
  }

  function resetDailyWeeklyProgress() {
    const state = Store.getQuests();
    for (const quest of state.active) {
      if (quest.type !== 'milestone' && !quest.completedAt) {
        quest.progress = 0;
      }
    }
    Store.setQuests(state);
  }

  return {
    refresh,
    updateProgress,
    getMetric,
    resetDailyWeeklyProgress,
    ALL_TEMPLATES: [...DAILY_TEMPLATES, ...WEEKLY_TEMPLATES, ...MILESTONE_TEMPLATES],
  };
})();
