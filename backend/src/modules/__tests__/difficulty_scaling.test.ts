/**
 * Difficulty Scaling module tests.
 * Tests for enemy damage scaling, AI difficulty tiers, and boss progression.
 */

import {
  getEnemyDamageMult,
  getAiDifficultyTier,
  getBossPhaseProgression,
  getDifficultyLabel,
  calculateEncounterDifficulty,
  validateScalingFormula,
} from '../difficulty_scaling';
import { Runtime } from '../../types/nakama';

describe('DifficultyScaling', () => {
  let mockCtx: Partial<Runtime>;

  beforeEach(() => {
    mockCtx = {
      storageWrite: jest.fn().mockResolvedValue(undefined),
      storageRead: jest.fn().mockResolvedValue(undefined),
      storageList: jest.fn().mockResolvedValue([]),
      env: {},
    };
  });

  describe('getEnemyDamageMult', () => {
    it('should return 0.8-1.0x for levels 1-10', () => {
      const level1Mult = getEnemyDamageMult(1);
      const level5Mult = getEnemyDamageMult(5);
      const level10Mult = getEnemyDamageMult(10);

      expect(level1Mult).toBeGreaterThanOrEqual(0.8);
      expect(level1Mult).toBeLessThanOrEqual(1.0);
      expect(level10Mult).toBeGreaterThanOrEqual(0.8);
      expect(level10Mult).toBeLessThanOrEqual(1.0);
    });

    it('should return 1.0-1.2x for levels 11-20', () => {
      const level11Mult = getEnemyDamageMult(11);
      const level15Mult = getEnemyDamageMult(15);
      const level20Mult = getEnemyDamageMult(20);

      expect(level11Mult).toBeGreaterThanOrEqual(1.0);
      expect(level11Mult).toBeLessThanOrEqual(1.2);
      expect(level20Mult).toBeGreaterThanOrEqual(1.0);
      expect(level20Mult).toBeLessThanOrEqual(1.2);
    });

    it('should return 1.2-1.5x for levels 21-30', () => {
      const level21Mult = getEnemyDamageMult(21);
      const level25Mult = getEnemyDamageMult(25);
      const level30Mult = getEnemyDamageMult(30);

      expect(level21Mult).toBeGreaterThanOrEqual(1.2);
      expect(level21Mult).toBeLessThanOrEqual(1.5);
      expect(level30Mult).toBeGreaterThanOrEqual(1.2);
      expect(level30Mult).toBeLessThanOrEqual(1.5);
    });

    it('should return 1.5-2.0x for levels 31-50', () => {
      const level31Mult = getEnemyDamageMult(31);
      const level40Mult = getEnemyDamageMult(40);
      const level50Mult = getEnemyDamageMult(50);

      expect(level31Mult).toBeGreaterThanOrEqual(1.5);
      expect(level31Mult).toBeLessThanOrEqual(2.0);
      expect(level50Mult).toBeGreaterThanOrEqual(1.5);
      expect(level50Mult).toBeLessThanOrEqual(2.0);
    });

    it('should increase monotonically with level', () => {
      let previousMult = -1;
      for (let level = 1; level <= 50; level++) {
        const mult = getEnemyDamageMult(level);
        expect(mult).toBeGreaterThanOrEqual(previousMult);
        previousMult = mult;
      }
    });

    it('should not return negative values', () => {
      for (let level = 1; level <= 50; level++) {
        const mult = getEnemyDamageMult(level);
        expect(mult).toBeGreaterThan(0);
      }
    });
  });

  describe('getAiDifficultyTier', () => {
    it('should return simple AI for level 1-10', () => {
      const tier1 = getAiDifficultyTier(1);
      const tier5 = getAiDifficultyTier(5);
      const tier10 = getAiDifficultyTier(10);

      expect(tier1.name).toBe('Simple');
      expect(tier1.aggression).toBeLessThanOrEqual(0.5);
      expect(tier5.name).toBe('Simple');
      expect(tier10.name).toBe('Simple');
    });

    it('should return aggressive AI for level 11-20', () => {
      const tier11 = getAiDifficultyTier(11);
      const tier15 = getAiDifficultyTier(15);

      expect(tier11.name).toBe('Aggressive');
      expect(tier15.name).toBe('Aggressive');
      expect(tier15.aggression).toBeGreaterThan(0.5);
      expect(tier15.aggression).toBeLessThan(0.8);
    });

    it('should return sophisticated AI for level 21-30', () => {
      const tier21 = getAiDifficultyTier(21);
      const tier25 = getAiDifficultyTier(25);
      const tier30 = getAiDifficultyTier(30);

      expect(tier21.name).toBe('Sophisticated');
      expect(tier25.name).toBe('Sophisticated');
      expect(tier30.name).toBe('Sophisticated');
      expect(tier30.aggression).toBeGreaterThanOrEqual(0.7);
    });

    it('should increase complexity with level', () => {
      const tier1 = getAiDifficultyTier(1);
      const tier10 = getAiDifficultyTier(10);
      const tier20 = getAiDifficultyTier(20);
      const tier30 = getAiDifficultyTier(30);

      expect(tier30.pattern_complexity).toBeGreaterThan(tier20.pattern_complexity);
      expect(tier20.pattern_complexity).toBeGreaterThan(tier10.pattern_complexity);
      expect(tier20.pattern_complexity).toBeGreaterThan(tier1.pattern_complexity);
    });
  });

  describe('getBossPhaseProgression', () => {
    it('should return 1 phase for level 1-10', () => {
      const progression1 = getBossPhaseProgression(1);
      const progression5 = getBossPhaseProgression(5);
      const progression10 = getBossPhaseProgression(10);

      expect(progression1.phases).toBe(1);
      expect(progression5.phases).toBe(1);
      expect(progression10.phases).toBe(1);
    });

    it('should return 2 phases for level 11-20', () => {
      const progression11 = getBossPhaseProgression(11);
      const progression15 = getBossPhaseProgression(15);
      const progression20 = getBossPhaseProgression(20);

      expect(progression11.phases).toBe(2);
      expect(progression15.phases).toBe(2);
      expect(progression20.phases).toBe(2);
    });

    it('should return 3+ phases for level 21-50', () => {
      const progression21 = getBossPhaseProgression(21);
      const progression30 = getBossPhaseProgression(30);
      const progression50 = getBossPhaseProgression(50);

      expect(progression21.phases).toBeGreaterThanOrEqual(3);
      expect(progression30.phases).toBeGreaterThanOrEqual(3);
      expect(progression50.phases).toBeGreaterThanOrEqual(3);
    });

    it('should include boss abilities in progression', () => {
      const progression20 = getBossPhaseProgression(20);
      const progression40 = getBossPhaseProgression(40);

      expect(progression20.abilities).toBeDefined();
      expect(progression20.abilities.length).toBeGreaterThan(0);
      expect(progression40.abilities.length).toBeGreaterThan(progression20.abilities.length);
    });
  });

  describe('getDifficultyLabel', () => {
    it('should return "Easy" for 0.8x multiplier', () => {
      const label = getDifficultyLabel(0.8);
      expect(label).toBe('Easy');
    });

    it('should return "Normal" for 1.0x multiplier', () => {
      const label = getDifficultyLabel(1.0);
      expect(label).toBe('Normal');
    });

    it('should return "Hard" for 1.5x multiplier', () => {
      const label = getDifficultyLabel(1.5);
      expect(label).toBe('Hard');
    });

    it('should return "Extreme" for 2.0x multiplier', () => {
      const label = getDifficultyLabel(2.0);
      expect(label).toBe('Extreme');
    });
  });

  describe('calculateEncounterDifficulty', () => {
    it('should return 1.0x for same level', () => {
      const difficulty = calculateEncounterDifficulty(10, 10);
      expect(difficulty).toBeCloseTo(1.0, 0.1);
    });

    it('should return < 1.0x for higher player level', () => {
      const difficulty = calculateEncounterDifficulty(15, 10);
      expect(difficulty).toBeLessThan(1.0);
    });

    it('should return > 1.0x for lower player level', () => {
      const difficulty = calculateEncounterDifficulty(10, 15);
      expect(difficulty).toBeGreaterThan(1.0);
    });

    it('should clamp difficulty to valid range', () => {
      const maxDifficulty = calculateEncounterDifficulty(50, 1);
      expect(maxDifficulty).toBeLessThanOrEqual(1.5);

      const minDifficulty = calculateEncounterDifficulty(1, 50);
      expect(minDifficulty).toBeGreaterThanOrEqual(0.0);
    });
  });

  describe('validateScalingFormula', () => {
    it('should validate within level bounds', () => {
      const result1 = validateScalingFormula(1);
      const result50 = validateScalingFormula(50);

      expect(result1.valid).toBe(true);
      expect(result50.valid).toBe(true);
    });

    it('should reject out of bounds levels', () => {
      const result0 = validateScalingFormula(0);
      const result51 = validateScalingFormula(51);

      expect(result0.valid).toBe(false);
      expect(result51.valid).toBe(false);
    });

    it('should validate multiplier range', () => {
      const result = validateScalingFormula(25);

      expect(result.valid).toBe(true);
      expect(result.multiplier).toBeGreaterThanOrEqual(0.8);
      expect(result.multiplier).toBeLessThanOrEqual(2.0);
    });
  });

  describe('Scaling formula edge cases', () => {
    it('should handle minimum level', () => {
      const mult = getEnemyDamageMult(1);
      expect(mult).toBeGreaterThan(0.5);
      expect(mult).toBeLessThan(1.0);
    });

    it('should handle maximum level', () => {
      const mult = getEnemyDamageMult(50);
      expect(mult).toBeGreaterThanOrEqual(1.5);
      expect(mult).toBeLessThanOrEqual(2.0);
    });

    it('should not produce NaN or Infinity', () => {
      for (let level = 1; level <= 50; level++) {
        const mult = getEnemyDamageMult(level);
        expect(Number.isFinite(mult)).toBe(true);
        expect(Number.isNaN(mult)).toBe(false);
      }
    });
  });
});
