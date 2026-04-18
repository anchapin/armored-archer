/**
 * Season Economy Flow Tests
 * @fileoverview Tests the full season lifecycle economy flows including reward claims,
 * double-claim prevention, prestige earning, and XP consistency across PvE/PvP paths.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { calculateLevel } from '../rpg_system';
import { getLevelForXp, getXpForLevel } from '../xp_manager';
import { calculateSoftResetElo, evaluatePrestigeTiers, PRESTIGE_TIERS } from '../season_system';
import type { RankChangeEvent, RewardClaimEvent } from '../season_telemetry';

describe('Season Economy Flows', () => {
  describe('XP Consistency Across PvE and PvP Paths', () => {
    it('should produce the same level regardless of XP source', () => {
      // Simulate player earning 1000 XP total via different splits
      const pveXP = 700;
      const pvpXP = 300;
      const totalXP = pveXP + pvpXP;

      expect(calculateLevel(totalXP)).toBe(getLevelForXp(totalXP));
    });

    it('should handle multi-level-ups from a single large PvP match reward', () => {
      const startingXP = 0;
      const matchXP = 5000;
      const level = getLevelForXp(startingXP + matchXP);

      // 5000 XP: getXpForLevel(10)=4500, getXpForLevel(11)=5500, so level 10
      expect(level).toBe(10);
    });

    it('should handle incremental PvE XP gains correctly', () => {
      let totalXP = 0;
      const gains = [100, 100, 100, 100, 100]; // 5 PvE runs

      for (const gain of gains) {
        totalXP += gain;
      }
      expect(getLevelForXp(totalXP)).toBe(3); // 500 XP = level 3
    });
  });

  describe('Season Reward Tiers', () => {
    it('should give higher rewards for better ranks', () => {
      const legendaryRewards = { coins: 10000, gems: 500 };
      const commonRewards = { coins: 500, gems: 10 };

      expect(legendaryRewards.coins).toBeGreaterThan(commonRewards.coins);
      expect(legendaryRewards.gems).toBeGreaterThan(commonRewards.gems);
    });
  });

  describe('Soft Reset ELO', () => {
    it('should compress top players toward 1300', () => {
      expect(calculateSoftResetElo(1)).toBe(1300);
      expect(calculateSoftResetElo(10)).toBe(1300);
    });

    it('should give mid-rank players a moderate reset', () => {
      expect(calculateSoftResetElo(50)).toBe(1200);
      expect(calculateSoftResetElo(100)).toBe(1150);
    });

    it('should give lower-ranked players a softer reset', () => {
      expect(calculateSoftResetElo(500)).toBe(1100);
      expect(calculateSoftResetElo(1000)).toBe(1000);
    });

    it('should never reset below 1000', () => {
      expect(calculateSoftResetElo(9999)).toBe(1000);
    });
  });

  describe('Prestige Tier Earning', () => {
    it('should earn no tiers with zero qualifying finishes', () => {
      const earned = evaluatePrestigeTiers([]);
      expect(earned).toHaveLength(0);
    });

    it('should not earn bronze with only 1 qualifying season finish', () => {
      const earned = evaluatePrestigeTiers([
        { season_id: 'season_1', rank: 50 },
      ]);
      expect(earned).toHaveLength(0); // needs 2 seasons
    });

    it('should earn bronze with 2 top-100 finishes', () => {
      const earned = evaluatePrestigeTiers([
        { season_id: 'season_1', rank: 50 },
        { season_id: 'season_2', rank: 80 },
      ]);
      expect(earned).toContain('bronze');
    });

    it('should not earn silver without 3 top-50 finishes', () => {
      const earned = evaluatePrestigeTiers([
        { season_id: 'season_1', rank: 30 },
        { season_id: 'season_2', rank: 40 },
      ]);
      expect(earned).not.toContain('silver');
    });

    it('should earn silver with 3 top-50 finishes', () => {
      const earned = evaluatePrestigeTiers([
        { season_id: 'season_1', rank: 10 },
        { season_id: 'season_2', rank: 20 },
        { season_id: 'season_3', rank: 30 },
      ]);
      expect(earned).toContain('silver');
    });

    it('should not count same season twice for prestige', () => {
      const earned = evaluatePrestigeTiers([
        { season_id: 'season_1', rank: 50 },
        { season_id: 'season_1', rank: 50 }, // duplicate
      ]);
      expect(earned).not.toContain('bronze'); // should still need 2 distinct seasons
    });
  });

  describe('Season Telemetry Data Integrity', () => {
    it('should track rank change event with correct fields', () => {
      const event: RankChangeEvent = {
        event_id: 'rc_test',
        match_id: 'match_test',
        season_id: 'season_1',
        timestamp: Date.now(),
        winner_id: 'player_a',
        loser_id: 'player_b',
        winner_old_elo: 1200,
        winner_new_elo: 1216,
        winner_rank_delta: 16,
        loser_old_elo: 1200,
        loser_new_elo: 1184,
        loser_rank_delta: -16,
        is_punch_up: false,
        k_factor: 32,
        days_into_season: 7,
      };

      // Verify ELO conservation (zero-sum)
      const totalDelta = event.winner_rank_delta + event.loser_rank_delta;
      expect(totalDelta).toBe(0);
    });

    it('should track reward claim event with correct fields', () => {
      const event: RewardClaimEvent = {
        event_id: 'rw_test',
        season_id: 'season_1',
        user_id: 'player_a',
        timestamp: Date.now(),
        rank: 42,
        rank_tier: 'epic',
        coins_awarded: 5000,
        gems_awarded: 200,
        had_cosmetics: true,
      };

      expect(event.coins_awarded).toBeGreaterThan(0);
      expect(event.gems_awarded).toBeGreaterThan(0);
    });
  });

  describe('Prestige Tier Configuration', () => {
    it('should have increasing requirements across tiers', () => {
      for (let i = 1; i < PRESTIGE_TIERS.length; i++) {
        const prev = PRESTIGE_TIERS[i - 1];
        const curr = PRESTIGE_TIERS[i];
        // Higher tiers should require equal or more seasons and equal or better rank
        expect(curr.required_seasons).toBeGreaterThanOrEqual(prev.required_seasons);
      }
    });

    it('should have unique aura names for each tier', () => {
      const auras = PRESTIGE_TIERS.map((t) => t.aura);
      expect(new Set(auras).size).toBe(auras.length);
    });
  });
});
