/* ─────────────────────────────────────────────
   Ranks — Solo Leveling-style E → S → National
   Derived from stat sum so rank reflects current
   fitness (and drops if you let stats decay).
   ───────────────────────────────────────────── */

const Ranks = (() => {

  // [minStatSum, tier, label, color] — must be sorted ascending by minStatSum
  const TIERS = [
    { min: 0,   tier: 'E', label: 'E RANK',     color: '#888aaa', glow: 'rgba(136,138,170,0.25)' },
    { min: 21,  tier: 'D', label: 'D RANK',     color: '#9aa75c', glow: 'rgba(154,167,92,0.30)'  },
    { min: 51,  tier: 'C', label: 'C RANK',     color: '#4cc9f0', glow: 'rgba(76,201,240,0.30)'  },
    { min: 101, tier: 'B', label: 'B RANK',     color: '#2dc653', glow: 'rgba(45,198,83,0.30)'   },
    { min: 181, tier: 'A', label: 'A RANK',     color: '#ffd700', glow: 'rgba(255,215,0,0.35)'   },
    { min: 301, tier: 'S', label: 'S RANK',     color: '#e63946', glow: 'rgba(230,57,70,0.40)'   },
    { min: 501, tier: 'N', label: 'NATIONAL',   color: '#c084fc', glow: 'rgba(192,132,252,0.45)' },
  ];

  function statSum(player) {
    const s = player.stats;
    return (s.STR || 0) + (s.AGI || 0) + (s.VIT || 0) + (s.DIS || 0);
  }

  function getRank(player) {
    const sum = statSum(player);
    let current = TIERS[0];
    let next    = null;
    for (let i = 0; i < TIERS.length; i++) {
      if (sum >= TIERS[i].min) {
        current = TIERS[i];
        next    = TIERS[i + 1] || null;
      }
    }
    const progress = next
      ? Math.min(100, Math.round(((sum - current.min) / (next.min - current.min)) * 100))
      : 100;
    return {
      tier:     current.tier,
      label:    current.label,
      color:    current.color,
      glow:     current.glow,
      statSum:  sum,
      nextTier: next ? next.tier : null,
      nextMin:  next ? next.min  : null,
      progress,
    };
  }

  function allTiers() { return TIERS.slice(); }

  return { getRank, allTiers };
})();
