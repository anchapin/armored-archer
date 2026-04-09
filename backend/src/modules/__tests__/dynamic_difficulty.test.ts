/**
 * Dynamic Difficulty module tests.
 * Tests for win/lose streak tracking, difficulty modifiers, and performance ratings.
 */

import {
  trackMatchOutcome,
  getDifficultyModifier,
  getDifficultyLevelString,
  getPerformanceRating,
  getWinRate,
  calculateTargetDifficulty,
  getEncounterRewardModifier,
  resetDifficulty,
} from '../dynamic_difficulty';
import { Runtime } from '../../types/nakama';
import { DifficultyLevel } from '../dynamic_difficulty';

describe('DynamicDifficulty', () => {
  let mockCtx: Partial<Runtime>;
  let testUserId = 'test-user-123';

  beforeEach(() => {
    mockCtx = {
      storageWrite: jest.fn().mockResolvedValue(undefined),
      storageRead: jest.fn().mockResolvedValue(undefined),
      storageList: jest.fn().mockResolvedValue([]),
      env: {},
    };
    // Reset difficulty state before each test
    resetDifficulty(mockCtx, testUserId);
  });

  describe('trackMatchOutcome', () => {
    it('should increment win streak on win', () => {
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      const state = getDifficultyState(mockCtx, testUserId);

      expect(state.win_streak).toBe(1);
      expect(state.lose_streak).toBe(0);
    });

    it('should increment lose streak on loss', () => {
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      const state = getDifficultyState(mockCtx, testUserId);

      expect(state.win_streak).toBe(0);
      expect(state.lose_streak).toBe(1);
    });

    it('should reset win streak on loss', () => {
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.win_streak).toBe(0);
      expect(state.lose_streak).toBe(1);
    });

    it('should reset lose streak on win', () => {
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.win_streak).toBe(1);
      expect(state.lose_streak).toBe(0);
    });

    it('should track match history', () => {
      for (let i = 0; i < 5; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: i % 2 === 0, match_type: 'pve' });
      }

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.match_history.length).toBe(5);
    });

    it('should limit history to 50 matches', () => {
      for (let i = 0; i < 60; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.match_history.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Difficulty adjustment on streaks', () => {
    it('should increase difficulty after 3+ win streak', () => {
      const initialModifier = getDifficultyModifier(mockCtx, testUserId);

      // Track 3 wins
      for (let i = 0; i < 3; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }

      const newModifier = getDifficultyModifier(mockCtx, testUserId);
      expect(newModifier).toBeGreaterThan(initialModifier);
    });

    it('should decrease difficulty after 3+ lose streak', () => {
      // Set to higher difficulty first
      setDifficultyModifier(mockCtx, testUserId, 0.15);

      const initialModifier = getDifficultyModifier(mockCtx, testUserId);

      // Track 3 losses
      for (let i = 0; i < 3; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const newModifier = getDifficultyModifier(mockCtx, testUserId);
      expect(newModifier).toBeLessThan(initialModifier);
    });

    it('should not increase difficulty below threshold', () => {
      // Track only 2 wins (below threshold)
      for (let i = 0; i < 2; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }

      const modifier = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier).toBe(0.0);  // Should remain at normal
    });

    it('should not decrease difficulty below threshold', () => {
      // Set to higher difficulty first
      setDifficultyModifier(mockCtx, testUserId, 0.10);

      // Track only 2 losses (below threshold)
      for (let i = 0; i < 2; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const modifier = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier).toBe(0.10);  // Should remain unchanged
    });
  });

  describe('Difficulty modifier limits', () => {
    it('should not exceed +20% (0.20)', () => {
      // Track many consecutive wins
      for (let i = 0; i < 10; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }

      const modifier = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier).toBeLessThanOrEqual(0.20);
    });

    it('should not go below -20% (-0.20)', () => {
      // Set to high difficulty first
      setDifficultyModifier(mockCtx, testUserId, 0.15);

      // Track many consecutive losses
      for (let i = 0; i < 10; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const modifier = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier).toBeGreaterThanOrEqual(-0.20);
    });

    it('should clamp to valid range', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.30);  // Try to set above max
      const modifier = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier).toBe(0.20);

      setDifficultyModifier(mockCtx, testUserId, -0.30);  // Try to set below min
      const modifier2 = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier2).toBe(-0.20);
    });
  });

  describe('getDifficultyLevelString', () => {
    it('should return "Easy" for -20% modifier', () => {
      setDifficultyModifier(mockCtx, testUserId, -0.20);
      const level = getDifficultyLevelString(mockCtx, testUserId);
      expect(level).toBe('Easy');
    });

    it('should return "Normal" for 0% modifier', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.0);
      const level = getDifficultyLevelString(mockCtx, testUserId);
      expect(level).toBe('Normal');
    });

    it('should return "Hard" for +10% modifier', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.10);
      const level = getDifficultyLevelString(mockCtx, testUserId);
      expect(level).toBe('Hard');
    });

    it('should return "Extreme" for +20% modifier', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.20);
      const level = getDifficultyLevelString(mockCtx, testUserId);
      expect(level).toBe('Extreme');
    });
  });

  describe('getPerformanceRating', () => {
    it('should return "Excellent" for 80%+ win rate', () => {
      // Track 8 wins, 2 losses
      for (let i = 0; i < 8; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }
      for (let i = 0; i < 2; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const rating = getPerformanceRating(mockCtx, testUserId);
      expect(rating).toBe('Excellent');
    });

    it('should return "Good" for 60-79% win rate', () => {
      resetDifficulty(mockCtx, testUserId);

      // Track 6 wins, 4 losses
      for (let i = 0; i < 6; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }
      for (let i = 0; i < 4; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const rating = getPerformanceRating(mockCtx, testUserId);
      expect(rating).toBe('Good');
    });

    it('should return "Average" for 40-59% win rate', () => {
      resetDifficulty(mockCtx, testUserId);

      // Track 5 wins, 5 losses
      for (let i = 0; i < 5; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }
      for (let i = 0; i < 5; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const rating = getPerformanceRating(mockCtx, testUserId);
      expect(rating).toBe('Average');
    });

    it('should return "Poor" for <40% win rate', () => {
      resetDifficulty(mockCtx, testUserId);

      // Track 3 wins, 7 losses
      for (let i = 0; i < 3; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }
      for (let i = 0; i < 7; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const rating = getPerformanceRating(mockCtx, testUserId);
      expect(rating).toBe('Poor');
    });

    it('should return "Average" with no match history', () => {
      resetDifficulty(mockCtx, testUserId);
      const rating = getPerformanceRating(mockCtx, testUserId);
      expect(rating).toBe('Average');
    });
  });

  describe('getWinRate', () => {
    it('should calculate win rate from recent matches', () => {
      // Track 10 matches: 7 wins, 3 losses
      for (let i = 0; i < 7; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }
      for (let i = 0; i < 3; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const winRate = getWinRate(mockCtx, testUserId, 10);
      expect(winRate).toBeCloseTo(0.7, 0.01);
    });

    it('should support custom window size', () => {
      // Track 20 matches
      for (let i = 0; i < 14; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }
      for (let i = 0; i < 6; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const winRate5 = getWinRate(mockCtx, testUserId, 5);
      const winRate10 = getWinRate(mockCtx, testUserId, 10);
      const winRate20 = getWinRate(mockCtx, testUserId, 20);

      expect(winRate5).toBeGreaterThanOrEqual(0);
      expect(winRate10).toBeGreaterThanOrEqual(0);
      expect(winRate20).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 with no match history', () => {
      resetDifficulty(mockCtx, testUserId);
      const winRate = getWinRate(mockCtx, testUserId, 10);
      expect(winRate).toBe(0);
    });
  });

  describe('calculateTargetDifficulty', () => {
    it('should apply modifier to base difficulty', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.0);
      const target = calculateTargetDifficulty(mockCtx, testUserId, 0.5);
      expect(target).toBeCloseTo(0.5, 0.01);
    });

    it('should increase difficulty with positive modifier', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.20);
      const target = calculateTargetDifficulty(mockCtx, testUserId, 0.5);
      expect(target).toBeCloseTo(0.6, 0.01);
    });

    it('should decrease difficulty with negative modifier', () => {
      setDifficultyModifier(mockCtx, testUserId, -0.20);
      const target = calculateTargetDifficulty(mockCtx, testUserId, 0.5);
      expect(target).toBeCloseTo(0.4, 0.01);
    });

    it('should clamp to maximum of 1.5', () => {
      const target = calculateTargetDifficulty(mockCtx, testUserId, 1.0, 0.20);
      expect(target).toBeLessThanOrEqual(1.5);
    });

    it('should clamp to minimum of 0.0', () => {
      const target = calculateTargetDifficulty(mockCtx, testUserId, 0.5, -0.20);
      expect(target).toBeGreaterThanOrEqual(0.0);
    });
  });

  describe('getEncounterRewardModifier', () => {
    it('should return 0.8x for Easy difficulty', () => {
      setDifficultyModifier(mockCtx, testUserId, -0.20);
      const modifier = getEncounterRewardModifier(mockCtx, testUserId);
      expect(modifier).toBeCloseTo(0.8, 0.01);
    });

    it('should return 1.0x for Normal difficulty', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.0);
      const modifier = getEncounterRewardModifier(mockCtx, testUserId);
      expect(modifier).toBe(1.0);
    });

    it('should return 1.2x for Hard difficulty', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.10);
      const modifier = getEncounterRewardModifier(mockCtx, testUserId);
      expect(modifier).toBeCloseTo(1.2, 0.01);
    });

    it('should return 1.4x for Extreme difficulty', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.20);
      const modifier = getEncounterRewardModifier(mockCtx, testUserId);
      expect(modifier).toBeCloseTo(1.4, 0.01);
    });
  });

  describe('resetDifficulty', () => {
    it('should reset modifier to 0.0', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.15);
      resetDifficulty(mockCtx, testUserId);

      const modifier = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier).toBe(0.0);
    });

    it('should reset streaks to 0', () => {
      // Build streaks first
      for (let i = 0; i < 3; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }

      resetDifficulty(mockCtx, testUserId);
      const state = getDifficultyState(mockCtx, testUserId);

      expect(state.win_streak).toBe(0);
      expect(state.lose_streak).toBe(0);
    });

    it('should clear match history', () => {
      // Add some history first
      for (let i = 0; i < 5; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }

      resetDifficulty(mockCtx, testUserId);
      const state = getDifficultyState(mockCtx, testUserId);

      expect(state.match_history).toEqual([]);
    });
  });

  describe('Persistence', () => {
    it('should save difficulty state to storage', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.10);

      expect(mockCtx.storageWrite).toHaveBeenCalledWith(
        'difficulty_state',
        expect.objectContaining({
          player_id: testUserId,
          current_modifier: 0.10,
        })
      );
    });

    it('should load difficulty state from storage', () => {
      const savedState = {
        player_id: testUserId,
        current_modifier: 0.15,
        win_streak: 3,
        lose_streak: 0,
        match_history: [],
        updated_at: Date.now(),
      };

      mockCtx.storageRead.mockResolvedValueOnce(savedState);

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.current_modifier).toBe(0.15);
      expect(state.win_streak).toBe(3);
    });
  });
});
