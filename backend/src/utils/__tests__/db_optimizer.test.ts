import {
  batchGetPlayerStats,
  getPlayerStatsWithCache,
  invalidatePlayerStatsCache,
} from '../db_optimizer';
import { getCacheManager } from '../cache';
import { safeParse } from '../safeParse';

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../cache', () => ({
  getCacheManager: jest.fn(() => mockCache),
}));

jest.mock('../safeParse', () => ({
  safeParse: jest.fn(),
}));

describe('db_optimizer', () => {
  const mockNk = { storageRead: jest.fn() as any };
  const mockLogger = { debug: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockClear();
    mockCache.set.mockClear();
    mockCache.delete.mockClear();
    (safeParse as jest.Mock).mockClear();
  });

  describe('batchGetPlayerStats', () => {
    it('returns stats from cache when available', () => {
      mockCache.get.mockReturnValue({ level: 5, stats: { attack: 10 } } as any);
      const result = batchGetPlayerStats(mockNk, ['u1'], mockLogger);
      expect(result.get('u1')).toEqual({ level: 5, stats: { attack: 10 } });
      expect(mockNk.storageRead).not.toHaveBeenCalled();
    });

    it('fetches from storage for uncached users', () => {
      mockCache.get.mockReturnValue(undefined);
      const raw = [
        {
          collection: 'player_stats',
          key: 'u1',
          userId: 'u1',
          value: '{"level":5,"stats":{"attack":10}}',
        },
      ];
      mockNk.storageRead.mockReturnValue(raw);
      (safeParse as jest.Mock).mockReturnValue({
        success: true,
        data: { level: 5, stats: { attack: 10 } },
      });

      const result = batchGetPlayerStats(mockNk, ['u1'], mockLogger);
      expect(result.get('u1')).toEqual({ level: 5, stats: { attack: 10 } });
      expect(mockCache.set).toHaveBeenCalledWith('player_stats', 'u1', {
        level: 5,
        stats: { attack: 10 },
      });
    });

    it('uses default stats when storage value invalid', () => {
      mockCache.get.mockReturnValue(undefined);
      mockNk.storageRead.mockReturnValue([{ value: 'not json' }]);
      (safeParse as jest.Mock).mockReturnValue({ success: false });

      const result = batchGetPlayerStats(mockNk, ['u1'], mockLogger);
      const stats = result.get('u1');
      expect(stats.level).toBe(1);
      expect(stats.stats.attack).toBe(10);
    });

    it('handles empty userIds array', () => {
      const result = batchGetPlayerStats(mockNk, [], mockLogger);
      expect(result.size).toBe(0);
    });
  });

  describe('getPlayerStatsWithCache', () => {
    it('returns from cache if available', () => {
      mockCache.get.mockReturnValue({ level: 3 } as any);
      const stats = getPlayerStatsWithCache(mockNk, 'u1', mockLogger);
      expect(stats.level).toBe(3);
      expect(mockNk.storageRead).not.toHaveBeenCalled();
    });

    it('fetches and caches if not in cache', () => {
      mockCache.get.mockReturnValue(undefined);
      mockNk.storageRead.mockReturnValue([{ value: '{"level":4,"stats":{"attack":10}}' }]);
      (safeParse as jest.Mock).mockReturnValue({
        success: true,
        data: { level: 4, stats: { attack: 10 } },
      });

      const stats = getPlayerStatsWithCache(mockNk, 'u1', mockLogger);
      expect(stats.level).toBe(4);
      expect(mockCache.set).toHaveBeenCalledWith('player_stats', 'u1', {
        level: 4,
        stats: { attack: 10 },
      });
    });

    it('returns default stats when none exists', () => {
      mockCache.get.mockReturnValue(undefined);
      mockNk.storageRead.mockReturnValue([]);
      const stats = getPlayerStatsWithCache(mockNk, 'u1', mockLogger);
      expect(stats.level).toBe(1);
      expect(stats.stats.attack).toBe(10);
    });
  });

  describe('invalidatePlayerStatsCache', () => {
    it('calls cache delete', () => {
      invalidatePlayerStatsCache('u1', mockLogger);
      expect(mockCache.delete).toHaveBeenCalledWith('player_stats', 'u1');
    });
  });
});
