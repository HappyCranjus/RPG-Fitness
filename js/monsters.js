/* ─────────────────────────────────────────────
   Monster system — roster, spawning, defeat
   ───────────────────────────────────────────── */

const Monsters = (() => {

  const ROSTER = [
    // ── Tier 1 (levels 1–4) ─────────────────
    {
      id: 'm_couch_wyrm',
      name: 'Couch Wyrm',
      tier: 1,
      hpBase: 150,
      art: '🪱',
      weaknesses: ['cardio', 'bodyweight'],
      resistances: ['diet'],
      flavorText: 'Grows stronger the longer you sit on the couch.',
      defeatMessage: 'The Couch Wyrm dissolves into a pile of blankets and broken promises!',
      reward: { xp: 120, gold: 25, statBoosts: { VIT: 1 } },
    },
    {
      id: 'm_takeout_troll',
      name: 'Takeout Troll',
      tier: 1,
      hpBase: 180,
      art: '👹',
      weaknesses: ['diet', 'bodyweight'],
      resistances: ['cardio'],
      flavorText: 'Emerges from a pile of delivery bags at 11pm.',
      defeatMessage: 'The Takeout Troll drops a crumpled menu and flees!',
      reward: { xp: 140, gold: 30, statBoosts: { VIT: 1 } },
    },
    {
      id: 'm_iron_goblin',
      name: 'Iron Goblin',
      tier: 1,
      hpBase: 200,
      art: '👺',
      weaknesses: ['bodyweight', 'weighted'],
      resistances: ['cardio'],
      flavorText: 'A mischievous beast that hides your motivation.',
      defeatMessage: 'The Iron Goblin squeals and drops a resistance band!',
      reward: { xp: 150, gold: 28, statBoosts: { STR: 1 } },
    },
    // ── Tier 2 (levels 5–14) ─────────────────
    {
      id: 'm_skip_day_shade',
      name: 'Skip Day Shade',
      tier: 2,
      hpBase: 350,
      art: '👻',
      weaknesses: ['cardio', 'bodyweight', 'diet', 'sports', 'weighted'],
      resistances: [],
      flavorText: 'Embodies every skipped workout. Strong against single efforts.',
      defeatMessage: 'The Skip Day Shade dissipates with a hollow scream!',
      reward: { xp: 250, gold: 55, statBoosts: { STR: 1, VIT: 1 } },
    },
    {
      id: 'm_sugar_fiend',
      name: 'Sugar Fiend',
      tier: 2,
      hpBase: 400,
      art: '🍬',
      weaknesses: ['diet', 'sports'],
      resistances: ['bodyweight'],
      flavorText: 'Grows stronger every time you skip tracking macros.',
      defeatMessage: 'The Sugar Fiend shatters into caramel shards!',
      reward: { xp: 280, gold: 60, statBoosts: { VIT: 1, AGI: 1 } },
    },
    {
      id: 'm_shadow_stalker',
      name: 'Shadow Stalker',
      tier: 2,
      hpBase: 450,
      art: '🦇',
      weaknesses: ['cardio', 'sports'],
      resistances: ['bodyweight', 'weighted'],
      flavorText: 'Lurks in the darkness between workouts.',
      defeatMessage: 'The Shadow Stalker shrieks and retreats into the void!',
      reward: { xp: 300, gold: 65, statBoosts: { AGI: 2 } },
    },
    // ── Tier 3 (levels 15–24) ────────────────
    {
      id: 'm_stone_colossus',
      name: 'Stone Colossus',
      tier: 3,
      hpBase: 900,
      art: '🗿',
      weaknesses: ['sports', 'cardio'],
      resistances: ['diet'],
      flavorText: 'A titan that only falls to sustained effort.',
      defeatMessage: 'The Stone Colossus crumbles into dust. You feel unstoppable.',
      reward: { xp: 600, gold: 120, statBoosts: { STR: 2, VIT: 1 } },
    },
    {
      id: 'm_void_serpent',
      name: 'Void Serpent',
      tier: 3,
      hpBase: 1000,
      art: '🐍',
      weaknesses: ['cardio', 'diet', 'bodyweight'],
      resistances: ['sports'],
      flavorText: 'Ancient and patient. Feeds on inconsistency.',
      defeatMessage: 'The Void Serpent coils into nothingness. Your endurance holds.',
      reward: { xp: 700, gold: 130, statBoosts: { VIT: 2, STR: 1 } },
    },
    // ── Tier 4 (level 25+) ───────────────────
    {
      id: 'm_the_undying',
      name: 'The Undying',
      tier: 4,
      hpBase: 1800,
      art: '💀',
      weaknesses: ['cardio', 'bodyweight', 'diet', 'sports', 'weighted'],
      resistances: [],
      flavorText: 'Only falls to warriors who move AND eat well in the same session.',
      defeatMessage: 'The Undying collapses. You have conquered the hardest foe of all: yourself.',
      reward: { xp: 1200, gold: 250, statBoosts: { STR: 3, AGI: 3, VIT: 3 } },
    },
  ];

  function maxTierForLevel(level) {
    if (level >= 25) return 4;
    if (level >= 15) return 3;
    if (level >= 5)  return 2;
    return 1;
  }

  function tierLabel(tier) {
    return ['', 'I', 'II', 'III', 'IV'][tier] || '?';
  }

  function spawnNext(player) {
    const state = Store.getMonsters();
    const maxTier = maxTierForLevel(player.level);
    const recentIds = state.defeated.slice(-2).map(d => d.id);

    const eligible = ROSTER.filter(m =>
      m.tier <= maxTier && !recentIds.includes(m.id)
    );

    const pool = eligible.length > 0 ? eligible : ROSTER.filter(m => m.tier <= maxTier);
    const template = pool[Math.floor(Math.random() * pool.length)];

    const hpMax = template.hpBase * template.tier;

    state.active = {
      ...template,
      hpMax,
      hpCurrent: hpMax,
      spawnedAt: new Date().toISOString(),
    };

    Store.setMonsters(state);
    return state.active;
  }

  function handleDefeat(_, monster) {
    const state  = Store.getMonsters();
    const player = Store.getPlayer(); // get fresh copy to include quest rewards

    // Apply rewards to player
    player.xp   += monster.reward.xp;
    player.gold  += monster.reward.gold;
    player.totalXpEarned += monster.reward.xp;

    if (monster.reward.statBoosts) {
      for (const [stat, amount] of Object.entries(monster.reward.statBoosts)) {
        if (!(stat in player.stats)) continue;  // skip retired stats (DIS)
        // Advance _acc by costFor(currentStat) × amount so the curve stays consistent.
        for (let i = 0; i < amount; i++) {
          const cost = Engine.statCurve.costFor(player.stats[stat]);
          player.statPoints[stat + '_acc'] = (player.statPoints[stat + '_acc'] || 0) + cost;
          player.stats[stat] = Engine.statCurve.statFromAcc(player.statPoints[stat + '_acc']).stat;
        }
      }
    }

    // Re-check level up (cosmetic — no stat gains; just XP gold)
    const newLevels = [];
    while (player.xp >= player.xpToNextLevel) {
      player.xp -= player.xpToNextLevel;
      player.level += 1;
      player.xpToNextLevel = Engine.xpToNextLevel(player.level);
      player.gold += 50;
      newLevels.push(player.level);
    }

    // Hall of fame
    state.defeated.push({
      id:         monster.id,
      name:       monster.name,
      tier:       monster.tier,
      art:        monster.art,
      defeatedAt: new Date().toISOString(),
      reward:     monster.reward,
    });
    state.killCount = (state.killCount || 0) + 1;
    state.active    = null;

    Store.setPlayer(player);
    Store.setMonsters(state);

    // Spawn next after a brief delay (caller shows modal first)
    setTimeout(() => {
      spawnNext(Store.getPlayer());
      Bus.emit('monster-spawned');
    }, 500);

    return { monster, reward: monster.reward, newLevels };
  }

  function getActive() {
    return Store.getMonsters().active;
  }

  return { ROSTER, spawnNext, handleDefeat, getActive, tierLabel };
})();
