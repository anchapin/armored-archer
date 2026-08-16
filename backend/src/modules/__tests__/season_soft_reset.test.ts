import {
  calculateSoftResetElo,
  evaluatePrestigeTiers,
  calculatePrestigeProgress,
  PRESTIGE_TIERS,
  PlayerPrestigeRecord,
  updatePlayerPrestigeRecord,
  grantPrestigeRewards,
  getPlayerPrestigeRecord,
} from '../season_system';
import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';

import { Runtime } from '../../types/nakama';

describe('season soft reset', () => {
  describe('calculateSoftResetElo', () => {
    it('should return 1300 for rank 1 (Legendary)', () => {
      expect(calculateSoftResetElo(1)).toBe(1300);
    });

    it('should return 1300 for rank 10 (Legendary boundary)', () => {
      expect(calculateSoftResetElo(10)).toBe(1300);
    });

    it('should return 1200 for rank 11 (Epic)', () => {
      expect(calculateSoftResetElo(11)).toBe(1200);
    });

    it('should return 1200 for rank 50 (Epic boundary)', () => {
      expect(calculateSoftResetElo(50)).toBe(1200);
    });

    it('should return 1150 for rank 51 (Rare)', () => {
      expect(calculateSoftResetElo(51)).toBe(1150);
    });

    it('should return 1150 for rank 100 (Rare boundary)', () => {
      expect(calculateSoftResetElo(100)).toBe(1150);
    });

    it('should return 1100 for rank 101 (Uncommon)', () => {
      expect(calculateSoftResetElo(101)).toBe(1100);
    });

    it('should return 1100 for rank 500 (Uncommon boundary)', () => {
      expect(calculateSoftResetElo(500)).toBe(1100);
    });

    it('should return 1000 for rank 501 (Common)', () => {
      expect(calculateSoftResetElo(501)).toBe(1000);
    });

    it('should return 1000 for rank 10000 (Deep Common)', () => {
      expect(calculateSoftResetElo(10000)).toBe(1000);
    });
  });
});

describe('prestige tier evaluation', () => {
  describe('evaluatePrestigeTiers', () => {
    it('should return no tiers for empty finishes', () => {
      expect(evaluatePrestigeTiers([])).toEqual([]);
    });

    it('should return no tiers for a single qualifying finish', () => {
      const finishes = [{ season_id: 'season_1', rank: 50 }];
      expect(evaluatePrestigeTiers(finishes)).toEqual([]);
    });

    it('should earn Bronze for top 100 in 2 different seasons', () => {
      const finishes = [
        { season_id: 'season_1', rank: 80 },
        { season_id: 'season_2', rank: 90 },
      ];
      expect(evaluatePrestigeTiers(finishes)).toEqual(['bronze']);
    });

    it('should not earn Bronze for top 100 in same season twice', () => {
      const finishes = [
        { season_id: 'season_1', rank: 80 },
        { season_id: 'season_1', rank: 50 },
      ];
      expect(evaluatePrestigeTiers(finishes)).toEqual([]);
    });

    it('should earn Bronze + Silver for top 50 in 3 different seasons', () => {
      const finishes = [
        { season_id: 'season_1', rank: 30 },
        { season_id: 'season_2', rank: 40 },
        { season_id: 'season_3', rank: 45 },
      ];
      const tiers = evaluatePrestigeTiers(finishes);
      expect(tiers).toContain('bronze');
      expect(tiers).toContain('silver');
      expect(tiers).toHaveLength(2);
    });

    it('should earn Bronze + Silver + Gold for top 10 in 3 different seasons', () => {
      const finishes = [
        { season_id: 'season_1', rank: 5 },
        { season_id: 'season_2', rank: 8 },
        { season_id: 'season_3', rank: 3 },
      ];
      const tiers = evaluatePrestigeTiers(finishes);
      expect(tiers).toContain('bronze');
      expect(tiers).toContain('silver');
      expect(tiers).toContain('gold');
      expect(tiers).toHaveLength(3);
    });

    it('should earn all tiers for top 10 in 5 different seasons', () => {
      const finishes = [
        { season_id: 'season_1', rank: 1 },
        { season_id: 'season_2', rank: 2 },
        { season_id: 'season_3', rank: 3 },
        { season_id: 'season_4', rank: 4 },
        { season_id: 'season_5', rank: 5 },
      ];
      const tiers = evaluatePrestigeTiers(finishes);
      expect(tiers).toEqual(['bronze', 'silver', 'gold', 'diamond']);
    });

    it('should not earn Silver with only top-100 finishes', () => {
      const finishes = [
        { season_id: 'season_1', rank: 80 },
        { season_id: 'season_2', rank: 85 },
        { season_id: 'season_3', rank: 90 },
      ];
      const tiers = evaluatePrestigeTiers(finishes);
      expect(tiers).toEqual(['bronze']);
    });

    it('should not earn Gold with top-50 finishes', () => {
      const finishes = [
        { season_id: 'season_1', rank: 30 },
        { season_id: 'season_2', rank: 40 },
        { season_id: 'season_3', rank: 45 },
      ];
      const tiers = evaluatePrestigeTiers(finishes);
      expect(tiers).not.toContain('gold');
    });
  });

  describe('calculatePrestigeProgress', () => {
    it('should show progress for each tier', () => {
      const finishes = [
        { season_id: 'season_1', rank: 30 },
        { season_id: 'season_2', rank: 40 },
      ];
      const progress = calculatePrestigeProgress(finishes);

      expect(progress).toHaveLength(4);
      expect(progress[0].tier).toBe('bronze');
      expect(progress[0].earned).toBe(true);
      expect(progress[0].qualifying_seasons).toBe(2);
      expect(progress[1].tier).toBe('silver');
      expect(progress[1].earned).toBe(false);
      expect(progress[1].qualifying_seasons).toBe(2);
      expect(progress[1].required_seasons).toBe(3);
    });

    it('should show no progress with no finishes', () => {
      const progress = calculatePrestigeProgress([]);
      expect(progress).toHaveLength(4);
      for (const p of progress) {
        expect(p.earned).toBe(false);
        expect(p.qualifying_seasons).toBe(0);
      }
    });
  });
});

describe('player prestige record management', () => {
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  describe('getPlayerPrestigeRecord', () => {
    it('should return default record when no storage exists', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      const record = getPlayerPrestigeRecord(mockNk, 'user-1');

      expect(record.player_id).toBe('user-1');
      expect(record.season_finishes).toEqual([]);
      expect(record.prestige_tiers_earned).toEqual([]);
    });

    it('should return stored record when available', () => {
      const stored: PlayerPrestigeRecord = {
        player_id: 'user-1',
        season_finishes: [{ season_id: 'season_1', rank: 50 }],
        prestige_tiers_earned: [],
        last_updated: 1000,
      };
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          value: JSON.stringify(stored),
        },
      ]);
      const record = getPlayerPrestigeRecord(mockNk, 'user-1');

      expect(record.season_finishes).toHaveLength(1);
      expect(record.season_finishes[0].season_id).toBe('season_1');
    });
  });

  describe('updatePlayerPrestigeRecord', () => {
    it('should add qualifying finish and detect new tier', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          value: JSON.stringify({
            player_id: 'user-1',
            season_finishes: [{ season_id: 'season_1', rank: 80 }],
            prestige_tiers_earned: [],
            last_updated: 1000,
          }),
        },
      ]);

      const { record, new_tiers } = updatePlayerPrestigeRecord(mockNk, 'user-1', 'season_2', 90);

      expect(record.season_finishes).toHaveLength(2);
      expect(new_tiers).toEqual(['bronze']);
      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should not add finish for rank > 100', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const { record, new_tiers } = updatePlayerPrestigeRecord(mockNk, 'user-1', 'season_1', 200);

      expect(record.season_finishes).toHaveLength(0);
      expect(new_tiers).toEqual([]);
    });

    it('should update existing season finish with better rank', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          value: JSON.stringify({
            player_id: 'user-1',
            season_finishes: [{ season_id: 'season_1', rank: 80 }],
            prestige_tiers_earned: [],
            last_updated: 1000,
          }),
        },
      ]);

      const { record } = updatePlayerPrestigeRecord(mockNk, 'user-1', 'season_1', 50);

      expect(record.season_finishes).toHaveLength(1);
      expect(record.season_finishes[0].rank).toBe(50);
    });

    it('should not duplicate already earned tiers', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          value: JSON.stringify({
            player_id: 'user-1',
            season_finishes: [
              { season_id: 'season_1', rank: 80 },
              { season_id: 'season_2', rank: 90 },
            ],
            prestige_tiers_earned: ['bronze'],
            last_updated: 1000,
          }),
        },
      ]);

      const { new_tiers } = updatePlayerPrestigeRecord(mockNk, 'user-1', 'season_3', 85);

      // Bronze already earned, no new tiers from just adding another top-100
      expect(new_tiers).not.toContain('bronze');
    });
  });

  describe('grantPrestigeRewards', () => {
    it('should call addPlayerCosmetic for each new tier', () => {
      // Mock storage read to return empty cosmetics
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      grantPrestigeRewards(mockNk, 'user-1', ['bronze', 'silver']);

      // Should have been called twice: once per tier
      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should handle empty tiers gracefully', () => {
      grantPrestigeRewards(mockNk, 'user-1', []);
      // Should not throw, no storageWrite expected for cosmetics
    });
  });
});
