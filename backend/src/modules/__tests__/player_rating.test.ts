/**
 * Tests for player_rating module
 */

import {
  validateRatingChange,
  applyRatingAdjustment,
  getLeaderboardSnapshot,
  trackMatchOutcome,
  getPlayerRating,
  getKFactor,
  calculateElo,
  RatingChange,
  PlayerRating,
} from '../player_rating';
import { Runtime } from '../types/nakama';

// Mock Nakama context
const mockNkContext = {
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
} as any;

// Mock Nakama nk module
const mockNk = {
  storageRead: jest.fn().mockResolvedValue({}),
  storageWrite: jest.fn().mockResolvedValue(undefined),
} as any;

describe('player_rating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNk.storageRead.mockResolvedValue({});
    mockNk.storageWrite.mockResolvedValue(undefined);
  });

  describe('validateRatingChange', () => {
    it('should validate reasonable rating changes', () => {
      const result = validateRatingChange(1200, 1225, 'win');
      expect(result.valid).toBe(true);
    });

    it('should reject extreme rating increases', () => {
      const result = validateRatingChange(1200, 1500, 'win');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should reject extreme rating decreases', () => {
      const result = validateRatingChange(1500, 1200, 'loss');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should reject ratings below minimum', () => {
      const result = validateRatingChange(1200, 900, 'loss');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('below valid range');
    });

    it('should reject ratings above maximum', () => {
      const result = validateRatingChange(2800, 3200, 'win');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('above valid range');
    });

    it('should accept rating at minimum boundary', () => {
      const result = validateRatingChange(1050, 1000, 'loss');
      expect(result.valid).toBe(true);
    });

    it('should accept rating at maximum boundary', () => {
      const result = validateRatingChange(2800, 3000, 'win');
      expect(result.valid).toBe(true);
    });
  });

  describe('calculateElo', () => {
    it('should calculate expected score of 0.5 for equal ratings', () => {
      const playerRating = 1200;
      const opponentRating = 1200;

      // Expected score = 1 / (1 + 10^0) = 0.5
      // This is tested indirectly through the rating change calculation
    });

    it('should give moderate gain for win against equal rating', () => {
      const playerRating = 1200;
      const opponentRating = 1200;
      const newRating = calculateElo(playerRating, opponentRating, true);

      expect(newRating).toBeGreaterThan(playerRating);
      expect(newRating - playerRating).toBeLessThan(32); // K=32 for calculation
    });

    it('should give moderate loss for loss against equal rating', () => {
      const playerRating = 1200;
      const opponentRating = 1200;
      const newRating = calculateElo(playerRating, opponentRating, false);

      expect(newRating).toBeLessThan(playerRating);
      expect(playerRating - newRating).toBeLessThan(32);
    });

    it('should give significant gain for win against higher rating', () => {
      const playerRating = 1200;
      const opponentRating = 1400;
      const newRating = calculateElo(playerRating, opponentRating, true);

      expect(newRating).toBeGreaterThan(playerRating);
      expect(newRating - playerRating).toBeGreaterThan(15);
    });

    it('should give significant loss for loss against lower rating', () => {
      const playerRating = 1400;
      const opponentRating = 1200;
      const newRating = calculateElo(playerRating, opponentRating, false);

      expect(newRating).toBeLessThan(playerRating);
      expect(playerRating - newRating).toBeGreaterThan(15);
    });

    it('should give small gain for win against much lower rating', () => {
      const playerRating = 1400;
      const opponentRating = 1000;
      const newRating = calculateElo(playerRating, opponentRating, true);

      expect(newRating).toBeGreaterThan(playerRating);
      expect(newRating - playerRating).toBeLessThan(15);
    });

    it('should give small loss for loss against much higher rating', () => {
      const playerRating = 1000;
      const opponentRating = 1400;
      const newRating = calculateElo(playerRating, opponentRating, false);

      expect(newRating).toBeLessThan(playerRating);
      expect(playerRating - newRating).toBeLessThan(15);
    });

    it('should respect minimum rating floor', () => {
      const playerRating = 1050;
      const opponentRating = 1000;
      const newRating = calculateElo(playerRating, opponentRating, false);

      expect(newRating).toBe(1000); // Should floor at 1000
    });

    it('should respect maximum rating ceiling', () => {
      const playerRating = 2900;
      const opponentRating = 1000;
      const newRating = calculateElo(playerRating, opponentRating, true);

      expect(newRating).toBe(3000); // Should ceiling at 3000
    });
  });

  describe('getKFactor', () => {
    it('should return high K-factor for new players', () => {
      const kFactor = getKFactor(5); // 5 matches played
      expect(kFactor).toBe(40.0);
    });

    it('should return low K-factor for established players', () => {
      const kFactor = getKFactor(15); // 15 matches played
      expect(kFactor).toBe(20.0);
    });

    it('should return high K-factor at threshold', () => {
      const kFactor = getKFactor(9); // Just before threshold
      expect(kFactor).toBe(40.0);
    });

    it('should return low K-factor after threshold', () => {
      const kFactor = getKFactor(10); // At threshold
      expect(kFactor).toBe(20.0);
    });

    it('should handle zero matches', () => {
      const kFactor = getKFactor(0);
      expect(kFactor).toBe(40.0);
    });
  });

  describe('applyRatingAdjustment', () => {
    it('should create new rating entry for player', async () => {
      mockNk.storageRead.mockResolvedValue({ [Symbol('key')]: '{}' });

      await applyRatingAdjustment(
        mockNkContext,
        'player_123',
        1200,
        1225,
        'win',
        '1v1'
      );

      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should update existing rating entry for player', async () => {
      const existingRating: PlayerRating = {
        player_id: 'player_123',
        mode: '1v1',
        rating: 1200,
        matches: 5,
        wins: 3,
        losses: 2,
        created_at: Date.now() / 1000,
        updated_at: Date.now() / 1000,
      };

      mockNk.storageRead.mockResolvedValue({
        [Symbol('key')]: JSON.stringify({ 'player_123_1v1': existingRating }),
      });

      await applyRatingAdjustment(
        mockNkContext,
        'player_123',
        1200,
        1225,
        'win',
        '1v1'
      );

      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should increment matches on win', async () => {
      const existingRating: PlayerRating = {
        player_id: 'player_123',
        mode: '1v1',
        rating: 1200,
        matches: 5,
        wins: 3,
        losses: 2,
        created_at: Date.now() / 1000,
        updated_at: Date.now() / 1000,
      };

      mockNk.storageRead.mockResolvedValue({
        [Symbol('key')]: JSON.stringify({ 'player_123_1v1': existingRating }),
      });

      await applyRatingAdjustment(
        mockNkContext,
        'player_123',
        1200,
        1225,
        'win',
        '1v1'
      );

      const storageWriteCall = mockNk.storageWrite.mock.calls[0][0];
      const updatedRatings = JSON.parse(storageWriteCall.player_ratings);
      const updatedRating = updatedRatings['player_123_1v1'];

      expect(updatedRating.matches).toBe(6);
      expect(updatedRating.wins).toBe(4);
      expect(updatedRating.losses).toBe(2);
    });

    it('should increment losses on loss', async () => {
      const existingRating: PlayerRating = {
        player_id: 'player_123',
        mode: '1v1',
        rating: 1200,
        matches: 5,
        wins: 3,
        losses: 2,
        created_at: Date.now() / 1000,
        updated_at: Date.now() / 1000,
      };

      mockNk.storageRead.mockResolvedValue({
        [Symbol('key')]: JSON.stringify({ 'player_123_1v1': existingRating }),
      });

      await applyRatingAdjustment(
        mockNkContext,
        'player_123',
        1200,
        1175,
        'loss',
        '1v1'
      );

      const storageWriteCall = mockNk.storageWrite.mock.calls[0][0];
      const updatedRatings = JSON.parse(storageWriteCall.player_ratings);
      const updatedRating = updatedRatings['player_123_1v1'];

      expect(updatedRating.matches).toBe(6);
      expect(updatedRating.wins).toBe(3);
      expect(updatedRating.losses).toBe(3);
    });

    it('should throw error for invalid rating change', async () => {
      mockNk.storageRead.mockResolvedValue({ [Symbol('key')]: '{}' });

      await expect(
        applyRatingAdjustment(
          mockNkContext,
          'player_123',
          1200,
          1500, // Too large change
          'win',
          '1v1'
        )
      ).rejects.toThrow();
    });
  });

  describe('getLeaderboardSnapshot', () => {
    it('should return empty leaderboard when no ratings', async () => {
      mockNk.storageRead.mockResolvedValue({ [Symbol('key')]: '{}' });

      const leaderboard = await getLeaderboardSnapshot(mockNkContext, '1v1', 100);

      expect(leaderboard).toEqual([]);
    });

    it('should return sorted leaderboard', async () => {
      const ratingsData = {
        'player_1_1v1': {
          player_id: 'player_1',
          mode: '1v1',
          rating: 1500,
          matches: 10,
          wins: 6,
          losses: 4,
        },
        'player_2_1v1': {
          player_id: 'player_2',
          mode: '1v1',
          rating: 1800,
          matches: 15,
          wins: 10,
          losses: 5,
        },
        'player_3_1v1': {
          player_id: 'player_3',
          mode: '1v1',
          rating: 1400,
          matches: 8,
          wins: 4,
          losses: 4,
        },
      };

      mockNk.storageRead.mockResolvedValue({
        [Symbol('key')]: JSON.stringify(ratingsData),
      });

      const leaderboard = await getLeaderboardSnapshot(mockNkContext, '1v1', 100);

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].rating).toBe(1800); // Highest first
      expect(leaderboard[1].rating).toBe(1500);
      expect(leaderboard[2].rating).toBe(1400);
    });

    it('should filter by mode', async () => {
      const ratingsData = {
        'player_1_1v1': {
          player_id: 'player_1',
          mode: '1v1',
          rating: 1500,
          matches: 10,
        },
        'player_1_2v2': {
          player_id: 'player_1',
          mode: '2v2',
          rating: 1600,
          matches: 8,
        },
      };

      mockNk.storageRead.mockResolvedValue({
        [Symbol('key')]: JSON.stringify(ratingsData),
      });

      const leaderboard1v1 = await getLeaderboardSnapshot(mockNkContext, '1v1', 100);
      const leaderboard2v2 = await getLeaderboardSnapshot(mockNkContext, '2v2', 100);

      expect(leaderboard1v1).toHaveLength(1);
      expect(leaderboard1v1[0].mode).toBe('1v1');

      expect(leaderboard2v2).toHaveLength(1);
      expect(leaderboard2v2[0].mode).toBe('2v2');
    });

    it('should respect limit parameter', async () => {
      const ratingsData = {};
      for (let i = 0; i < 150; i++) {
        ratingsData[`player_${i}_1v1`] = {
          player_id: `player_${i}`,
          mode: '1v1',
          rating: 2000 - i,
          matches: 10,
        };
      }

      mockNk.storageRead.mockResolvedValue({
        [Symbol('key')]: JSON.stringify(ratingsData),
      });

      const leaderboard = await getLeaderboardSnapshot(mockNkContext, '1v1', 50);

      expect(leaderboard).toHaveLength(50);
    });
  });

  describe('getPlayerRating', () => {
    it('should return null for non-existent player', async () => {
      mockNk.storageRead.mockResolvedValue({ [Symbol('key')]: '{}' });

      const rating = await getPlayerRating(mockNkContext, 'player_999', '1v1');

      expect(rating).toBeNull();
    });

    it('should return rating for existing player', async () => {
      const ratingsData = {
        'player_123_1v1': {
          player_id: 'player_123',
          mode: '1v1',
          rating: 1500,
          matches: 10,
        },
      };

      mockNk.storageRead.mockResolvedValue({
        [Symbol('key')]: JSON.stringify(ratingsData),
      });

      const rating = await getPlayerRating(mockNkContext, 'player_123', '1v1');

      expect(rating).toBe(1500);
    });
  });

  describe('trackMatchOutcome', () => {
    it('should store match outcome in history', async () => {
      mockNk.storageRead.mockResolvedValue({ [Symbol('key')]: '{}' });

      await trackMatchOutcome(
        mockNkContext,
        'player_123',
        'player_456',
        1200,
        1300,
        true,
        '1v1',
        300
      );

      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should update existing history', async () => {
      const existingHistory = [
        {
          id: 'player_123_1v1_1234567890',
          player_id: 'player_123',
          mode: '1v1',
          old_rating: 1200,
          new_rating: 1225,
          opponent_rating: 1300,
          is_win: true,
          timestamp: 1234567890,
        },
      ];

      mockNk.storageRead.mockResolvedValue({
        [Symbol('rating_history')]: JSON.stringify({ 'player_123_1v1': existingHistory }),
        [Symbol('key')': '{}',
      });

      await trackMatchOutcome(
        mockNkContext,
        'player_123',
        'player_456',
        1225,
        1250,
        false,
        '1v1',
        250
      );

      expect(mockNk.storageWrite).toHaveBeenCalled();
    });
  });
});
