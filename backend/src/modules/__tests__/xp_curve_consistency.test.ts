/**
 * XP Curve Consistency Integration Tests
 * @fileoverview Verifies all XP-curve-consuming code paths agree on level calculations.
 */

import { calculateLevel } from '../rpg_system';
import { getXpForLevel, getLevelForXp } from '../xp_manager';

describe('XP Curve Consistency', () => {
  describe('rpg_system.calculateLevel matches xp_manager.getLevelForXp', () => {
    it('should agree for XP values 0 through 20000 in steps of 100', () => {
      for (let xp = 0; xp <= 20000; xp += 100) {
        expect(calculateLevel(xp)).toBe(getLevelForXp(xp));
      }
    });

    it('should agree at exact level boundaries', () => {
      for (let level = 1; level <= 50; level++) {
        const xp = getXpForLevel(level);
        expect(calculateLevel(xp)).toBe(level);
      }
    });

    it('should agree just below each level boundary', () => {
      for (let level = 2; level <= 50; level++) {
        const xp = getXpForLevel(level) - 1;
        expect(calculateLevel(xp)).toBe(level - 1);
      }
    });
  });

  describe('xp_manager lookup table integrity', () => {
    it('should be monotonically increasing', () => {
      for (let level = 2; level <= 50; level++) {
        expect(getXpForLevel(level)).toBeGreaterThan(getXpForLevel(level - 1));
      }
    });

    it('should round-trip: getXpForLevel(N) -> getLevelForXp -> N', () => {
      for (let level = 1; level <= 50; level++) {
        const xp = getXpForLevel(level);
        expect(getLevelForXp(xp)).toBe(level);
      }
    });

    it('should return level 1 for zero and negative XP', () => {
      expect(getLevelForXp(0)).toBe(1);
      expect(getLevelForXp(-1)).toBe(1);
      expect(getLevelForXp(-1000)).toBe(1);
    });

    it('should cap at level 50 for XP beyond the table', () => {
      expect(getLevelForXp(999999)).toBe(50);
      expect(getLevelForXp(122500)).toBe(50);
    });
  });

  describe('level gap analysis', () => {
    it('should have increasing XP gaps between levels (steeper curve)', () => {
      const gaps: number[] = [];
      for (let level = 2; level <= 50; level++) {
        gaps.push(getXpForLevel(level) - getXpForLevel(level - 1));
      }
      // Early gaps should be smaller than late gaps
      const avgEarly = gaps.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
      const avgLate = gaps.slice(-10).reduce((a, b) => a + b, 0) / 10;
      expect(avgLate).toBeGreaterThan(avgEarly);
    });
  });
});
