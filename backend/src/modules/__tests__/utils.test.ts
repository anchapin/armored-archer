import { calculateLevel } from '../rpg_system';
import { calculateRank, generateMatchId } from '../matchmaker';
import { calculateRewards } from '../season_system';
import { PlayerStats } from '../types/game';

describe('Utility Functions', () => {
  describe('calculateLevel', () => {
    it('should return level 1 for 0 XP', () => {
      expect(calculateLevel(0)).toBe(1);
    });

    it('should return level 1 for less than 100 XP', () => {
      expect(calculateLevel(50)).toBe(1);
      expect(calculateLevel(99)).toBe(1);
    });

    it('should level up at XP threshold', () => {
      expect(calculateLevel(100)).toBe(2);
    });

    it('should handle multiple level ups', () => {
      expect(calculateLevel(250)).toBe(2);
      expect(calculateLevel(500)).toBe(3);
    });

    it('should scale XP requirements correctly', () => {
      expect(calculateLevel(100)).toBe(2);
      expect(calculateLevel(250)).toBe(2);
      expect(calculateLevel(475)).toBe(3);
    });

    it('should handle high XP values', () => {
      expect(calculateLevel(10000)).toBe(14);
    });
  });

  describe('calculateRank', () => {
    const createStats = (overrides: Partial<PlayerStats['stats']> = {}): PlayerStats => ({
      level: 5,
      xp: 0,
      stats: {
        attack: 10,
        defense: 10,
        dodge: 10,
        crit_rate: 5,
        ...overrides,
      },
    });

    it('should calculate rank from level and base stats', () => {
      const rank = calculateRank(createStats());
      expect(rank).toBe(58);
    });

    it('should increase rank with level', () => {
      const lowLevel = { ...createStats(), level: 1 };
      const highLevel = { ...createStats(), level: 10 };

      expect(calculateRank(highLevel)).toBeGreaterThan(calculateRank(lowLevel));
    });

    it('should increase rank with stats', () => {
      const lowStats = createStats({ attack: 10, defense: 10, dodge: 10, crit_rate: 5 });
      const highStats = createStats({ attack: 30, defense: 30, dodge: 30, crit_rate: 15 });

      expect(calculateRank(highStats)).toBeGreaterThan(calculateRank(lowStats));
    });
  });

  describe('generateMatchId', () => {
    it('should generate unique match IDs', () => {
      const id1 = generateMatchId();
      const id2 = generateMatchId();

      expect(id1).not.toBe(id2);
    });

    it('should start with "match_" prefix', () => {
      const id = generateMatchId();
      expect(id.startsWith('match_')).toBe(true);
    });

    it('should contain timestamp', () => {
      const id = generateMatchId();
      const parts = id.split('_');
      expect(parts.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('calculateRewards', () => {
    it('should return legendary rewards for rank 1', () => {
      const rewards = calculateRewards(1, 1);
      expect(rewards.rank_tier).toBe('legendary');
      expect(rewards.coins).toBe(8500);
      expect(rewards.gems).toBe(600);
    });

    it('should return legendary rewards for rank 10', () => {
      const rewards = calculateRewards(10, 1);
      expect(rewards.rank_tier).toBe('legendary');
    });

    it('should return epic rewards for rank 50', () => {
      const rewards = calculateRewards(50, 1);
      expect(rewards.rank_tier).toBe('epic');
    });

    it('should return rare rewards for rank 100', () => {
      const rewards = calculateRewards(100, 1);
      expect(rewards.rank_tier).toBe('rare');
    });

    it('should return uncommon rewards for rank 500', () => {
      const rewards = calculateRewards(500, 1);
      expect(rewards.rank_tier).toBe('uncommon');
    });

    it('should return common rewards for rank 1000', () => {
      const rewards = calculateRewards(1000, 1);
      expect(rewards.rank_tier).toBe('common');
    });

    it('should include season number in title', () => {
      const rewards = calculateRewards(1, 5);
      expect(rewards.cosmetics?.title).toContain('5');
    });
  });
});
