import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import {
  calculateSoftResetElo,
  evaluatePrestigeTiers,
  PRESTIGE_TIERS,
} from '../season_system';
import { Runtime } from '../../types/nakama';

describe('Season transition', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'admin-user' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  describe('calculateSoftResetElo', () => {
    it('should return 1300 for rank 10 and below (Legendary tier)', () => {
      expect(calculateSoftResetElo(1)).toBe(1300);
      expect(calculateSoftResetElo(10)).toBe(1300);
    });

    it('should return 1200 for rank 11-50 (Epic tier)', () => {
      expect(calculateSoftResetElo(11)).toBe(1200);
      expect(calculateSoftResetElo(50)).toBe(1200);
    });

    it('should return 1150 for rank 51-100 (Rare tier)', () => {
      expect(calculateSoftResetElo(51)).toBe(1150);
      expect(calculateSoftResetElo(100)).toBe(1150);
    });

    it('should return 1100 for rank 101-500 (Uncommon tier)', () => {
      expect(calculateSoftResetElo(101)).toBe(1100);
      expect(calculateSoftResetElo(500)).toBe(1100);
    });

    it('should return 1000 for rank 501+ (Common tier)', () => {
      expect(calculateSoftResetElo(501)).toBe(1000);
      expect(calculateSoftResetElo(9999)).toBe(1000);
    });
  });

  describe('evaluatePrestigeTiers', () => {
    it('should earn bronze after 2 seasons finishing rank <= 100', () => {
      const finishes = [
        { season_id: 's1', rank: 50 },
        { season_id: 's2', rank: 80 },
      ];
      const earned = evaluatePrestigeTiers(finishes);
      expect(earned).toContain('bronze');
    });

    it('should not earn silver with only 2 qualifying seasons (needs 3)', () => {
      const finishes = [
        { season_id: 's1', rank: 25 },
        { season_id: 's2', rank: 30 },
      ];
      const earned = evaluatePrestigeTiers(finishes);
      expect(earned).toContain('bronze');
      expect(earned).not.toContain('silver');
    });

    it('should earn silver after 3 seasons finishing rank <= 50', () => {
      const finishes = [
        { season_id: 's1', rank: 25 },
        { season_id: 's2', rank: 30 },
        { season_id: 's3', rank: 40 },
      ];
      const earned = evaluatePrestigeTiers(finishes);
      expect(earned).toContain('bronze');
      expect(earned).toContain('silver');
    });

    it('should not earn any prestige with no qualifying finishes', () => {
      const finishes = [
        { season_id: 's1', rank: 200 },
        { season_id: 's2', rank: 300 },
      ];
      const earned = evaluatePrestigeTiers(finishes);
      expect(earned).toEqual([]);
    });

    it('should not count duplicate season finishes toward required count', () => {
      const finishes = [
        { season_id: 's1', rank: 50 },
        { season_id: 's1', rank: 40 }, // Duplicate season_id
      ];
      const earned = evaluatePrestigeTiers(finishes);
      expect(earned).not.toContain('bronze'); // Only 1 unique qualifying season
    });
  });

  describe('soft reset across all tiers', () => {
    it('should produce monotonically decreasing Elo for increasing ranks', () => {
      const rankBreakpoints = [1, 11, 51, 101, 501];
      const eloValues = rankBreakpoints.map(r => calculateSoftResetElo(r));

      for (let i = 1; i < eloValues.length; i++) {
        expect(eloValues[i]).toBeLessThan(eloValues[i - 1]);
      }
    });
  });
});
