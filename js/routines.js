/* ─────────────────────────────────────────────
   Routines — hand-authored workout templates
   Tagged by rank (E → S) and focus.
   Used by #log (pre-fill) and #schedule (planner).
   ───────────────────────────────────────────── */

const Routines = (() => {

  // Each item: { kind: 'activity'|'exercise', id, target: { minutes? | reps? | sets? } }
  const TEMPLATES = [
    /* ─── E RANK — getting started ─── */
    {
      id: 'rt_e_walk',
      name: 'Easy Walk',
      rank: 'E',
      focus: 'cardio',
      flavor: 'Out the door and moving — that\'s today\'s win.',
      items: [
        { kind: 'activity', id: 'act_walkdog', target: { minutes: 20 } },
      ],
    },
    {
      id: 'rt_e_starter',
      name: 'Starter Set',
      rank: 'E',
      focus: 'full',
      flavor: 'A gentle introduction to the daily grind.',
      items: [
        { kind: 'exercise', id: 'ex_pushup', target: { sets: 2, reps: 8 } },
        { kind: 'exercise', id: 'ex_situp',  target: { sets: 2, reps: 10 } },
        { kind: 'exercise', id: 'ex_squat',  target: { sets: 2, reps: 10 } },
      ],
    },
    {
      id: 'rt_e_jog',
      name: 'First Jog',
      rank: 'E',
      focus: 'cardio',
      flavor: 'Slow and steady — build the engine.',
      items: [
        { kind: 'activity', id: 'act_jog', target: { minutes: 15 } },
      ],
    },
    {
      id: 'rt_e_yoga',
      name: 'Calm Start',
      rank: 'E',
      focus: 'mobility',
      flavor: 'Breathe. Stretch. The grind can wait.',
      items: [
        { kind: 'activity', id: 'act_yoga', target: { minutes: 20 } },
      ],
    },

    /* ─── D RANK ─── */
    {
      id: 'rt_d_push',
      name: 'Push Day',
      rank: 'D',
      focus: 'push',
      flavor: 'Chest, shoulders, triceps.',
      items: [
        { kind: 'exercise', id: 'ex_pushup',   target: { sets: 3, reps: 12 } },
        { kind: 'exercise', id: 'ex_dumbbell', target: { sets: 3, reps: 10 } },
      ],
    },
    {
      id: 'rt_d_core',
      name: 'Core Crusher',
      rank: 'D',
      focus: 'core',
      flavor: 'Forge the foundation.',
      items: [
        { kind: 'exercise', id: 'ex_situp', target: { sets: 3, reps: 15 } },
        { kind: 'exercise', id: 'ex_idl',   target: { sets: 3, reps: 12 } },
      ],
    },
    {
      id: 'rt_d_3k',
      name: '3K Steady',
      rank: 'D',
      focus: 'cardio',
      flavor: 'Conversational pace — finish strong.',
      items: [
        { kind: 'activity', id: 'act_jog', target: { minutes: 20 } },
      ],
    },
    {
      id: 'rt_d_lunge',
      name: 'Leg Drill',
      rank: 'D',
      focus: 'legs',
      flavor: 'Step. Burn. Repeat.',
      items: [
        { kind: 'exercise', id: 'ex_lunge', target: { sets: 3, reps: 12 } },
        { kind: 'exercise', id: 'ex_squat', target: { sets: 3, reps: 15 } },
        { kind: 'exercise', id: 'ex_plank', target: { sets: 2, reps: 30 } },
      ],
    },

    /* ─── C RANK ─── */
    {
      id: 'rt_c_full',
      name: 'Full Body Circuit',
      rank: 'C',
      focus: 'full',
      flavor: 'Hit everything once. No weak links.',
      items: [
        { kind: 'exercise', id: 'ex_pushup', target: { sets: 3, reps: 15 } },
        { kind: 'exercise', id: 'ex_squat',  target: { sets: 3, reps: 15 } },
        { kind: 'exercise', id: 'ex_situp',  target: { sets: 3, reps: 20 } },
        { kind: 'exercise', id: 'ex_pullup', target: { sets: 3, reps: 5 }  },
      ],
    },
    {
      id: 'rt_c_5k',
      name: '5K Run',
      rank: 'C',
      focus: 'cardio',
      flavor: 'A proper hunter\'s pace.',
      items: [
        { kind: 'activity', id: 'act_jog', target: { minutes: 30 } },
      ],
    },
    {
      id: 'rt_c_swim',
      name: 'Pool Session',
      rank: 'C',
      focus: 'cardio',
      flavor: 'Low-impact, full-body.',
      items: [
        { kind: 'activity', id: 'act_swim', target: { minutes: 30 } },
      ],
    },
    {
      id: 'rt_c_burpee',
      name: 'Burpee Burner',
      rank: 'C',
      focus: 'full',
      flavor: 'No equipment. No mercy.',
      items: [
        { kind: 'exercise', id: 'ex_burpee', target: { sets: 4, reps: 10 } },
        { kind: 'exercise', id: 'ex_pushup', target: { sets: 3, reps: 15 } },
        { kind: 'exercise', id: 'ex_situp',  target: { sets: 3, reps: 20 } },
      ],
    },

    /* ─── B RANK ─── */
    {
      id: 'rt_b_push_pull',
      name: 'Push + Pull',
      rank: 'B',
      focus: 'upper',
      flavor: 'Balance the body.',
      items: [
        { kind: 'exercise', id: 'ex_pushup', target: { sets: 4, reps: 20 } },
        { kind: 'exercise', id: 'ex_pullup', target: { sets: 4, reps: 8 }  },
        { kind: 'exercise', id: 'ex_dumbbell', target: { sets: 3, reps: 12 } },
      ],
    },
    {
      id: 'rt_b_legs',
      name: 'Leg Day',
      rank: 'B',
      focus: 'legs',
      flavor: 'Don\'t skip it.',
      items: [
        { kind: 'exercise', id: 'ex_squat', target: { sets: 5, reps: 20 } },
        { kind: 'exercise', id: 'ex_idl',   target: { sets: 4, reps: 15 } },
        { kind: 'activity', id: 'act_jog',  target: { minutes: 15 } },
      ],
    },
    {
      id: 'rt_b_sport',
      name: 'Pickup Game',
      rank: 'B',
      focus: 'sport',
      flavor: 'Real-world agility — chase the win.',
      items: [
        { kind: 'activity', id: 'act_bball', target: { minutes: 45 } },
      ],
    },
    {
      id: 'rt_b_gym',
      name: 'Gym Day',
      rank: 'B',
      focus: 'upper',
      flavor: 'Iron up. Move with intent.',
      items: [
        { kind: 'exercise', id: 'ex_bench',    target: { sets: 4, reps: 8 } },
        { kind: 'exercise', id: 'ex_row',      target: { sets: 4, reps: 8 } },
        { kind: 'exercise', id: 'ex_dumbbell', target: { sets: 3, reps: 12 } },
      ],
    },

    /* ─── A RANK ─── */
    {
      id: 'rt_a_circuit',
      name: 'Hunter\'s Circuit',
      rank: 'A',
      focus: 'full',
      flavor: 'High volume, full body — earn your rank.',
      items: [
        { kind: 'exercise', id: 'ex_pushup', target: { sets: 5, reps: 25 } },
        { kind: 'exercise', id: 'ex_pullup', target: { sets: 4, reps: 10 } },
        { kind: 'exercise', id: 'ex_squat',  target: { sets: 4, reps: 25 } },
        { kind: 'exercise', id: 'ex_situp',  target: { sets: 4, reps: 25 } },
        { kind: 'activity', id: 'act_jog',   target: { minutes: 20 } },
      ],
    },
    {
      id: 'rt_a_10k',
      name: '10K Run',
      rank: 'A',
      focus: 'cardio',
      flavor: 'Long-distance discipline.',
      items: [
        { kind: 'activity', id: 'act_jog', target: { minutes: 55 } },
      ],
    },

    /* ─── S RANK ─── */
    {
      id: 'rt_s_iron',
      name: 'Iron Trial',
      rank: 'S',
      focus: 'full',
      flavor: 'The body remembers what the mind survives.',
      items: [
        { kind: 'exercise', id: 'ex_pushup', target: { sets: 6, reps: 30 } },
        { kind: 'exercise', id: 'ex_pullup', target: { sets: 5, reps: 12 } },
        { kind: 'exercise', id: 'ex_squat',  target: { sets: 5, reps: 30 } },
        { kind: 'exercise', id: 'ex_idl',    target: { sets: 5, reps: 20 } },
        { kind: 'exercise', id: 'ex_situp',  target: { sets: 5, reps: 30 } },
        { kind: 'activity', id: 'act_jog',   target: { minutes: 30 } },
      ],
    },
  ];

  function getRoutine(id) {
    return TEMPLATES.find(r => r.id === id) || null;
  }

  function all() { return TEMPLATES.slice(); }

  function byRank(rank) {
    return TEMPLATES.filter(r => r.rank === rank);
  }

  // Group templates by rank for picker UIs
  function grouped() {
    const order = ['E', 'D', 'C', 'B', 'A', 'S'];
    const result = {};
    for (const r of order) result[r] = [];
    for (const t of TEMPLATES) {
      if (result[t.rank]) result[t.rank].push(t);
    }
    return result;
  }

  return { getRoutine, all, byRank, grouped };
})();
