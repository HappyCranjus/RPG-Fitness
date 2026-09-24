/* ─────────────────────────────────────────────
   Monster system — roster, spawning, defeat
   ───────────────────────────────────────────── */

const Monsters = (() => {

  const ROSTER = [
    // ── Tier 1 (levels 1–4) ─────────────────
    {
      id: 'm_couch_wyrm',
      name: 'Slumbering Drake',
      tier: 1,
      hpBase: 150,
      art: '🐉',
      weaknesses: ['cardio', 'bodyweight'],
      resistances: [],
      flavorText: 'An ancient drake whose hoard swells whenever a warrior lays down their arms.',
      defeatMessage: 'The drake roars one final time and crumbles into a cairn of cold stone!',
      reward: { xp: 120, gold: 25, statBoosts: { VIT: 1 } },
      moves: [
        { id: 'mv_drake_slam',    type: 'attack',  weight: 5, name: 'Tail Slam',       baseDamage: 12 },
        { id: 'mv_drake_bite',    type: 'attack',  weight: 3, name: 'Drowsy Bite',      baseDamage: 8 },
        { id: 'mv_drake_slumber', type: 'exhaust', weight: 2, name: 'Slumbering Aura',  baseDamage: 0,
          applyPlayerStatus: { type: 'exhaust', ticksRemaining: 1, energyCostMult: 1.5 } },
      ],
    },
    {
      id: 'm_takeout_troll',
      name: 'Bog Troll',
      tier: 1,
      hpBase: 180,
      art: '👹',
      weaknesses: ['diet', 'bodyweight'],
      resistances: [],
      flavorText: 'A bloated brute that feasts on midnight spoils dragged back to its mire.',
      defeatMessage: 'The Bog Troll wails and sinks back into its fetid marsh!',
      reward: { xp: 140, gold: 30, statBoosts: { VIT: 1 } },
      moves: [
        { id: 'mv_troll_club',   type: 'attack',  weight: 5, name: 'Club Smash',    baseDamage: 12 },
        { id: 'mv_troll_gore',   type: 'attack',  weight: 3, name: 'Mire Gore',     baseDamage: 10 },
        { id: 'mv_troll_feast',  type: 'heal',    weight: 2, name: 'Midnight Feast', baseDamage: 0, healMonster: 20 },
        { id: 'mv_troll_spew',   type: 'poison',  weight: 2, name: 'Rancid Spew',   baseDamage: 4,
          applyPlayerStatus: { type: 'poison', ticksRemaining: 2, damagePerTick: 4 } },
      ],
    },
    {
      id: 'm_iron_goblin',
      name: 'Goblin Marauder',
      tier: 1,
      hpBase: 200,
      art: '👺',
      weaknesses: ['bodyweight', 'weighted'],
      resistances: [],
      flavorText: 'A vicious raider whose plundered iron buckles under disciplined assault.',
      defeatMessage: 'The Marauder collapses, scattering shards of stolen mail!',
      reward: { xp: 150, gold: 28, statBoosts: { STR: 1 } },
      moves: [
        { id: 'mv_goblin_slash',  type: 'attack', weight: 5, name: 'Iron Slash',     baseDamage: 10 },
        { id: 'mv_goblin_flurry', type: 'attack', weight: 3, name: 'Plunder Flurry', baseDamage: 7 },
        { id: 'mv_goblin_frenzy', type: 'dmg_up', weight: 2, name: 'Battle Frenzy',  baseDamage: 0,
          applyMonsterStatus: { type: 'dmg_up', ticksRemaining: 2, mult: 1.5 } },
        { id: 'mv_goblin_shield', type: 'def_up', weight: 1, name: 'Stolen Shield',  baseDamage: 0,
          applyMonsterStatus: { type: 'def_up', ticksRemaining: 1, mult: 0.5 } },
      ],
    },
    // ── Tier 2 (levels 5–14) ─────────────────
    {
      id: 'm_skip_day_shade',
      name: 'Wraith of Idleness',
      tier: 2,
      hpBase: 350,
      art: '👻',
      weaknesses: ['cardio', 'bodyweight', 'diet', 'sports', 'weighted'],
      resistances: [],
      flavorText: 'A spectre born from broken oaths and abandoned vows.',
      defeatMessage: 'The wraith dissolves with a hollow, mournful scream!',
      reward: { xp: 250, gold: 55, statBoosts: { STR: 1, VIT: 1 } },
      moves: [
        { id: 'mv_wraith_drain',   type: 'attack',   weight: 4, name: 'Soul Drain',         baseDamage: 14 },
        { id: 'mv_wraith_wail',    type: 'attack',   weight: 3, name: 'Mournful Wail',       baseDamage: 18 },
        { id: 'mv_wraith_exhaust', type: 'exhaust',  weight: 3, name: 'Lethargy Wave',       baseDamage: 5,
          applyPlayerStatus: { type: 'exhaust', ticksRemaining: 2, energyCostMult: 1.5 } },
        { id: 'mv_wraith_weaken',  type: 'dmg_down', weight: 2, name: "Oath-Breaker's Curse", baseDamage: 0,
          applyPlayerStatus: { type: 'dmg_down', ticksRemaining: 2, mult: 0.7 } },
        { id: 'mv_wraith_reform',  type: 'heal',     weight: 1, name: 'Coalesce',            baseDamage: 0, healMonster: 30 },
      ],
    },
    {
      id: 'm_sugar_fiend',
      name: 'Honeyed Lich',
      tier: 2,
      hpBase: 400,
      art: '🧪',
      weaknesses: ['diet', 'sports'],
      resistances: [],
      flavorText: 'A spell-rotted sorcerer hoarding glistening elixirs that drain the will.',
      defeatMessage: 'The lich shatters and its cursed brews evaporate in a sickly mist!',
      reward: { xp: 280, gold: 60, statBoosts: { VIT: 1, AGI: 1 } },
      moves: [
        { id: 'mv_lich_bolt',    type: 'attack',   weight: 4, name: 'Sugar Bolt',       baseDamage: 14 },
        { id: 'mv_lich_poison',  type: 'poison',   weight: 3, name: 'Toxic Elixir',     baseDamage: 5,
          applyPlayerStatus: { type: 'poison', ticksRemaining: 3, damagePerTick: 5 } },
        { id: 'mv_lich_drain',   type: 'attack',   weight: 2, name: 'Vitality Drain',   baseDamage: 10 },
        { id: 'mv_lich_def_down',type: 'def_down', weight: 2, name: 'Corrode Armor',    baseDamage: 0,
          applyPlayerStatus: { type: 'def_down', ticksRemaining: 2, mult: 1.3 } },
        { id: 'mv_lich_barrier', type: 'def_up',   weight: 2, name: 'Crystalline Ward', baseDamage: 0,
          applyMonsterStatus: { type: 'def_up', ticksRemaining: 2, mult: 0.5 } },
      ],
    },
    {
      id: 'm_shadow_stalker',
      name: 'Shadowfang Stalker',
      tier: 2,
      hpBase: 450,
      art: '🦇',
      weaknesses: ['cardio', 'sports'],
      resistances: [],
      flavorText: 'A nightblood hunter that prowls the gulfs between heroic deeds.',
      defeatMessage: 'The stalker shrieks and dissolves into a swarm of fleeing shadows!',
      reward: { xp: 300, gold: 65, statBoosts: { AGI: 2 } },
      moves: [
        { id: 'mv_shadow_fang',   type: 'attack', weight: 5, name: 'Shadow Fang',       baseDamage: 16 },
        { id: 'mv_shadow_pounce', type: 'attack', weight: 3, name: 'Nightblood Pounce', baseDamage: 12 },
        { id: 'mv_shadow_blur',   type: 'def_up', weight: 2, name: 'Shadow Blur',       baseDamage: 0,
          applyMonsterStatus: { type: 'def_up', ticksRemaining: 1, mult: 0.4 } },
        { id: 'mv_shadow_dmg_up', type: 'dmg_up', weight: 2, name: 'Bloodlust',         baseDamage: 0,
          applyMonsterStatus: { type: 'dmg_up', ticksRemaining: 1, mult: 1.5 } },
        { id: 'mv_shadow_stun',   type: 'stun',   weight: 1, name: 'Paralytic Bite',    baseDamage: 8,
          applyPlayerStatus: { type: 'stun', durationMs: 15 * 60 * 1000 } },
      ],
    },
    // ── Tier 3 (levels 15–24) ────────────────
    {
      id: 'm_stone_colossus',
      name: 'Ancient Colossus',
      tier: 3,
      hpBase: 900,
      art: '🗿',
      weaknesses: ['sports', 'cardio'],
      resistances: [],
      flavorText: 'A titan of weathered stone, awakened only by relentless steel.',
      defeatMessage: 'The colossus crumbles into dust as your war-song echoes through the ruins!',
      reward: { xp: 600, gold: 120, statBoosts: { STR: 2, VIT: 1 } },
      moves: [
        { id: 'mv_colossus_smash',   type: 'attack',   weight: 5, name: 'Seismic Smash',  baseDamage: 24 },
        { id: 'mv_colossus_tremor',  type: 'attack',   weight: 3, name: 'Stone Tremor',    baseDamage: 18 },
        { id: 'mv_colossus_quake',   type: 'attack',   weight: 2, name: 'Ground Quake',    baseDamage: 20 },
        { id: 'mv_colossus_harden',  type: 'def_up',   weight: 3, name: 'Stone Harden',    baseDamage: 0,
          applyMonsterStatus: { type: 'def_up', ticksRemaining: 2, mult: 0.4 } },
        { id: 'mv_colossus_shatter', type: 'def_down', weight: 2, name: 'Armour Shatter',  baseDamage: 10,
          applyPlayerStatus: { type: 'def_down', ticksRemaining: 2, mult: 1.3 } },
        { id: 'mv_colossus_reform',  type: 'heal',     weight: 1, name: 'Stone Reform',    baseDamage: 0, healMonster: 50 },
      ],
    },
    {
      id: 'm_void_serpent',
      name: 'Void Serpent',
      tier: 3,
      hpBase: 1000,
      art: '🐍',
      weaknesses: ['cardio', 'diet', 'bodyweight'],
      resistances: [],
      flavorText: 'An ancient wyrm that feeds on broken vows and abandoned valor.',
      defeatMessage: 'The Void Serpent coils into nothingness as your discipline burns it away!',
      reward: { xp: 700, gold: 130, statBoosts: { VIT: 2, STR: 1 } },
      moves: [
        { id: 'mv_serpent_bite',    type: 'attack',  weight: 4, name: 'Void Bite',       baseDamage: 20 },
        { id: 'mv_serpent_lunge',   type: 'attack',  weight: 3, name: 'Void Lunge',      baseDamage: 28 },
        { id: 'mv_serpent_venom',   type: 'poison',  weight: 3, name: 'Void Venom',      baseDamage: 6,
          applyPlayerStatus: { type: 'poison', ticksRemaining: 4, damagePerTick: 6 } },
        { id: 'mv_serpent_coil',    type: 'stun',    weight: 2, name: 'Crushing Coil',   baseDamage: 10,
          applyPlayerStatus: { type: 'stun', durationMs: 15 * 60 * 1000 } },
        { id: 'mv_serpent_shed',    type: 'def_up',  weight: 2, name: 'Scale Shed',      baseDamage: 0,
          applyMonsterStatus: { type: 'def_up', ticksRemaining: 2, mult: 0.5 } },
        { id: 'mv_serpent_exhaust', type: 'exhaust', weight: 2, name: 'Enervating Hiss', baseDamage: 0,
          applyPlayerStatus: { type: 'exhaust', ticksRemaining: 2, energyCostMult: 1.5 } },
      ],
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
      flavorText: 'An eternal foe that bows only to warriors who master both blade and table.',
      defeatMessage: 'The Undying falls at last. You have mastered every front of the long war!',
      reward: { xp: 1200, gold: 250, statBoosts: { STR: 3, AGI: 3, VIT: 3 } },
      moves: [
        { id: 'mv_undying_strike',  type: 'attack',  weight: 4, name: 'Eternal Strike',          baseDamage: 28 },
        { id: 'mv_undying_siege',   type: 'attack',  weight: 3, name: 'Death Siege',              baseDamage: 35 },
        { id: 'mv_undying_poison',  type: 'poison',  weight: 2, name: 'Cursed Ichor',             baseDamage: 8,
          applyPlayerStatus: { type: 'poison', ticksRemaining: 4, damagePerTick: 8 } },
        { id: 'mv_undying_stun',    type: 'stun',    weight: 2, name: 'Overwhelming Presence',    baseDamage: 12,
          applyPlayerStatus: { type: 'stun', durationMs: 15 * 60 * 1000 } },
        { id: 'mv_undying_exhaust', type: 'exhaust', weight: 2, name: 'Soul Sap',                 baseDamage: 0,
          applyPlayerStatus: { type: 'exhaust', ticksRemaining: 3, energyCostMult: 1.5 } },
        { id: 'mv_undying_def',     type: 'def_up',  weight: 2, name: 'Undying Armor',            baseDamage: 0,
          applyMonsterStatus: { type: 'def_up', ticksRemaining: 2, mult: 0.4 } },
        { id: 'mv_undying_surge',   type: 'dmg_up',  weight: 2, name: 'Deathless Rage',           baseDamage: 0,
          applyMonsterStatus: { type: 'dmg_up', ticksRemaining: 1, mult: 2.0 } },
        { id: 'mv_undying_regen',   type: 'heal',    weight: 1, name: 'Undying Reformation',      baseDamage: 0, healMonster: 80 },
      ],
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
      statusEffects: [],
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
