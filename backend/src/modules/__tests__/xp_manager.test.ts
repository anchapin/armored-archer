/**
 * XP Manager module tests.
 * Tests for XP curve calculations, level progression, and validation.
 */

import {
  getXpForLevel,
  calculateXpGain,
  getProgressPercentage,
  getLevelCurveType,
  validateXpGainSimple,
} from '../xp_manager';
import { Runtime } from '../../types/nakama';

describe('XPManager', () => {
  let mockCtx: Partial<Runtime>;

  beforeEach(() => {
    mockCtx = {
      storageWrite: jest.fn().mockResolvedValue(undefined),
      storageRead: jest.fn().mockResolvedValue(undefined),
      storageList: jest.fn().mockResolvedValue([]),
      env: {},
    };
  });

  describe('getXpForLevel', () => {
    it('should return 0 XP for level 1', () => {
      const xp = getXpForLevel(1);
      expect(xp).toBe(0);
    });

    it('should return 100 XP for level 2', () => {
      const xp = getXpForLevel(2);
      expect(xp).toBe(100);
    });

    it('should return 300 XP for level 3', () => {
      const xp = getXpForLevel(3);
      expect(xp).toBe(300);
    });

    it('should return 1000 XP for level 5', () => {
      const xp = getXpForLevel(5);
      expect(xp).toBe(1000);
    });

    it('should return 4500 XP for level 10', () => {
      const xp = getXpForLevel(10);
      expect(xp).toBe(4500);
    });

    it('should return 5500 XP for level 11', () => {
      const xp = getXpForLevel(11);
      expect(xp).toBe(5500);
    });

    it('should return 10500 XP for level 15', () => {
      const xp = getXpForLevel(15);
      expect(xp).toBe(10500);
    });

    it('should increase XP requirements monotonically', () => {
      let previousXp = -1;
      for (let level = 1; level <= 50; level++) {
        const xp = getXpForLevel(level);
        expect(xp).toBeGreaterThan(previousXp);
        previousXp = xp;
      }
    });

    it('should cap at level 50', () => {
      const xp50 = getXpForLevel(50);
      const xp51 = getXpForLevel(51);
      expect(xp50).toBe(xp51);
    });
  });

  describe('getLevelCurveType', () => {
    it('should return "early" for levels 1-10', () => {
      expect(getLevelCurveType(1)).toBe('early');
      expect(getLevelCurveType(5)).toBe('early');
      expect(getLevelCurveType(10)).toBe('early');
    });

    it('should return "mid" for levels 11-30', () => {
      expect(getLevelCurveType(11)).toBe('mid');
      expect(getLevelCurveType(15)).toBe('mid');
      expect(getLevelCurveType(30)).toBe('mid');
    });

    it('should return "late" for levels 31-50', () => {
      expect(getLevelCurveType(31)).toBe('late');
      expect(getLevelCurveType(40)).toBe('late');
      expect(getLevelCurveType(50)).toBe('late');
    });
  });

  describe('calculateXpGain', () => {
    it('should apply base XP without modifiers', () => {
      const gain = calculateXpGain(100, 5);
      expect(gain).toBe(100);
    });

    it('should apply level-based multiplier for high levels', () => {
      const lowLevelGain = calculateXpGain(100, 10);
      const highLevelGain = calculateXpGain(100, 40);

      expect(highLevelGain).toBeGreaterThan(lowLevelGain);
    });

    it('should not return negative XP', () => {
      const gain = calculateXpGain(100, 1);
      expect(gain).toBeGreaterThan(0);
    });

    it('should handle zero XP gain', () => {
      const gain = calculateXpGain(0, 10);
      expect(gain).toBe(0);
    });
  });

  describe('getProgressPercentage', () => {
    it('should return 0% when starting level', () => {
      const progress = getProgressPercentage(100, 100, 300);
      expect(progress).toBe(0);
    });

    it('should return 50% when halfway', () => {
      const progress = getProgressPercentage(200, 100, 300);
      expect(progress).toBe(50);
    });

    it('should return 100% at level threshold', () => {
      const progress = getProgressPercentage(300, 100, 300);
      expect(progress).toBe(100);
    });

    it('should clamp progress to 0-100 range', () => {
      const below = getProgressPercentage(50, 100, 300);
      const above = getProgressPercentage(400, 100, 300);

      expect(below).toBe(0);
      expect(above).toBe(100);
    });
  });

  describe('validateXpGainSimple', () => {
    it('should accept positive XP gains', () => {
      const result = validateXpGainSimple(100, 10);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject negative XP gains', () => {
      const result = validateXpGainSimple(-100, 10);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('negative');
    });

    it('should reject zero XP gains', () => {
      const result = validateXpGainSimple(0, 10);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('zero');
    });

    it('should reject invalid level', () => {
      const result = validateXpGainSimple(100, 0);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('level');
    });
  });

  describe('XP curve edge cases', () => {
    it('should handle minimum level', () => {
      const xp = getXpForLevel(1);
      expect(xp).toBe(0);
    });

    it('should handle maximum level', () => {
      const xp = getXpForLevel(50);
      expect(xp).toBeGreaterThan(0);
    });

    it('should handle level beyond cap', () => {
      const xp50 = getXpForLevel(50);
      const xp100 = getXpForLevel(100);
      expect(xp50).toBe(xp100);
    });
  });

  describe('XP progression pacing', () => {
    it('should have slower progression in early levels (1-10)', () => {
      const level1To2 = getXpForLevel(2) - getXpForLevel(1);
      const level9To10 = getXpForLevel(10) - getXpForLevel(9);

      expect(level1To2).toBe(100);
      expect(level9To10).toBeGreaterThan(800);
    });

    it('should have moderate progression in mid levels (11-30)', () => {
      const level10To11 = getXpForLevel(11) - getXpForLevel(10);
      const level29To30 = getXpForLevel(30) - getXpForLevel(29);

      expect(level10To11).toBe(1000);
      expect(level29To30).toBeGreaterThan(1000);
    });

    it('should have slower progression in late levels (31-50)', () => {
      const level30To31 = getXpForLevel(31) - getXpForLevel(30);
      const level49To50 = getXpForLevel(50) - getXpForLevel(49);

      expect(level30To31).toBeGreaterThan(0);
      expect(level49To50).toBeGreaterThan(0);
    });
  });
});
