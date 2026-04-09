/**
 * Tests for season_leaderboard module
 */

import {
  calculateDecayAmount,
  getDaysInactive,
  RatingDecayConfig,
  SeasonRanking,
  SeasonArchive,
} from '../season_leaderboard';

describe('season_leaderboard', () => {
  const DEFAULT_CONFIG: RatingDecayConfig = {
    inactive_days_threshold: 7,
    decay_rate_percent: 1,
    high_decay_threshold_days: 30,
    high_decay_rate_percent: 2,
    minimum_rating: 1000,
    max_decay_loss: 200,
  };

  describe('calculateDecayAmount', () => {
    it('should return 0 for ratings below minimum', () => {
      const result = calculateDecayAmount(900, 10, DEFAULT_CONFIG);
      expect(result).toBe(0);
    });

    it('should return 0 for active players (< 7 days)', () => {
      const result = calculateDecayAmount(1500, 5, DEFAULT_CONFIG);
      expect(result).toBe(0);
    });

    it('should calculate 1% decay for 7-30 days inactive', () => {
      const result = calculateDecayAmount(1500, 14, DEFAULT_CONFIG);
      expect(result).toBe(15); // 1500 * 0.01 * 1 period
    });

    it('should calculate 2% decay for > 30 days inactive', () => {
      const result = calculateDecayAmount(1500, 45, DEFAULT_CONFIG);
      // 45 days: 38 days inactive (45-7), 5 periods at 2% each
      // Decay: 1500 * 0.02 * 5 = 150, capped at 200
      expect(result).toBe(150);
    });

    it('should cap decay at max_decay_loss', () => {
      const result = calculateDecayAmount(3000, 60, DEFAULT_CONFIG);
      expect(result).toBe(200); // Capped at max
    });

    it('should handle zero decay correctly', () => {
      const result = calculateDecayAmount(1000, 100, DEFAULT_CONFIG);
      expect(result).toBe(0); // At minimum, no decay
    });
  });

  describe('getDaysInactive', () => {
    it('should calculate days inactive correctly', () => {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const result = getDaysInactive(oneDayAgo);
      expect(result).toBe(1);
    });

    it('should return 0 for current timestamp', () => {
      const now = Date.now();
      const result = getDaysInactive(now);
      expect(result).toBe(0);
    });

    it('should handle future timestamps', () => {
      const now = Date.now();
      const future = now + 24 * 60 * 60 * 1000;
      const result = getDaysInactive(future);
      expect(result).toBe(-1); // Function returns -1 for future timestamps
    });
  });

  describe('Decay calculation edge cases', () => {
    it('should handle 7 days exactly (threshold)', () => {
      const result = calculateDecayAmount(1200, 7, DEFAULT_CONFIG);
      expect(result).toBe(0); // At threshold, no decay yet
    });

    it('should handle 8 days (first decay)', () => {
      const result = calculateDecayAmount(1200, 8, DEFAULT_CONFIG);
      // 8 days: 1 day inactive (8-7), less than 1 full 7-day period
      // Decay: 1200 * 0.01 * 0 = 0 (no full periods yet)
      expect(result).toBe(0);
    });

    it('should handle 30 days (second threshold)', () => {
      const result = calculateDecayAmount(1500, 30, DEFAULT_CONFIG);
      const periods = Math.floor((30 - 7) / 7); // 3 periods
      // At exactly 30 days, we use the high decay rate (2%)
      const expected = Math.floor(1500 * 0.02 * periods); // Using 2% rate = 90
      expect(result).toBe(expected);
    });

    it('should handle 31 days (high decay)', () => {
      const result = calculateDecayAmount(1500, 31, DEFAULT_CONFIG);
      const periods = Math.floor((31 - 7) / 7); // 3 periods
      const expected = Math.floor(1500 * 0.02 * 3); // Now using 2% rate
      expect(result).toBe(expected);
    });
  });

  describe('Season ranking data structure', () => {
    it('should have required fields', () => {
      const ranking: SeasonRanking = {
        season_id: 'season_1',
        player_id: 'player_123',
        rating: 1500,
        mode: '1v1',
        matches: 25,
        wins: 15,
        losses: 10,
        win_rate: 0.6,
        punch_up_wins: 5,
        last_active: Date.now(),
        decayed_rating: 1500,
        days_inactive: 0,
        rank: 1,
      };

      expect(ranking.season_id).toBe('season_1');
      expect(ranking.player_id).toBe('player_123');
      expect(ranking.mode).toBe('1v1');
      expect(ranking.decayed_rating).toBe(ranking.rating); // No decay initially
    });

    it('should calculate decay correctly in ranking', () => {
      const lastActive = Date.now() - 14 * 24 * 60 * 60 * 1000; // 14 days ago
      const decayAmount = calculateDecayAmount(1500, 14, DEFAULT_CONFIG);

      const ranking: SeasonRanking = {
        season_id: 'season_1',
        player_id: 'player_123',
        rating: 1500,
        mode: '1v1',
        matches: 25,
        wins: 15,
        losses: 10,
        win_rate: 0.6,
        punch_up_wins: 5,
        last_active: lastActive,
        decayed_rating: 1500 - decayAmount,
        days_inactive: 14,
        rank: 1,
      };

      expect(ranking.decayed_rating).toBeLessThan(ranking.rating);
      expect(ranking.days_inactive).toBe(14);
    });
  });

  describe('Season archive data structure', () => {
    it('should have required fields', () => {
      const archive: SeasonArchive = {
        season_id: 'season_1',
        season_number: 1,
        start_time: Date.now() - 30 * 24 * 60 * 60 * 1000,
        end_time: Date.now(),
        winner_id: 'player_456',
        winner_name: 'TestPlayer',
        winner_rating: 2000,
        total_players: 100,
        rewards_distributed: false,
      };

      expect(archive.season_id).toBe('season_1');
      expect(archive.season_number).toBe(1);
      expect(archive.winner_id).toBe('player_456');
      expect(archive.total_players).toBe(100);
    });

    it('should allow null winner_id before season ends', () => {
      const archive: SeasonArchive = {
        season_id: 'season_2',
        season_number: 2,
        start_time: Date.now(),
        end_time: Date.now() + 30 * 24 * 60 * 60 * 1000,
        winner_id: '',
        winner_name: '',
        winner_rating: 0,
        total_players: 0,
        rewards_distributed: false,
      };

      expect(archive.winner_id).toBe('');
      expect(archive.winner_name).toBe('');
    });
  });
});
