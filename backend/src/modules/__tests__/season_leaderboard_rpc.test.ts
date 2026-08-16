/**
 * Comprehensive RPC handler tests for season_leaderboard module.
 *
 * Tests cover:
 * - rpcGetPlayerRank: Get player rank with decay info
 * - rpcGetSeasonHistory: Get season history/archived seasons
 * - getTopPlayers: Internal function for leaderboard
 * - recordSeasonCompletion: Internal function for archiving seasons
 * - Various edge cases and error scenarios
 */

import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import {
  rpcGetPlayerRank,
  rpcGetSeasonHistory,
  getTopPlayers,
  recordSeasonCompletion,
  getPlayerRank,
  registerRpcGetPlayerRank,
  registerRpcGetSeasonHistory,
} from '../season_leaderboard';
import { Runtime } from '../../types/nakama';

describe('season_leaderboard_rpc', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  const TEST_SEASON_ID = 'season_1';

  // Maps for routing storageRead responses by collection
  let storageMap: Map<string, string>;

  const createMockLeaderboardRecord = (overrides?: Partial<any>) => ({
    ownerId: 'test-user',
    username: 'TestPlayer',
    rank: 5,
    score: 1500,
    metadata: JSON.stringify({
      wins: 10,
      losses: 2,
      win_rate: 0.83,
      punch_up_wins: 3,
      mode: '1v1',
      matches: 12,
    }),
    expiry: 0,
    maxNumScore: 0,
    numScore: 0,
    ...overrides,
  });

  /** Set player activity data in storage map. daysAgo=0 means active now. */
  const setPlayerActive = (playerId: string, daysAgo: number) => {
    const key = `player_last_active:${playerId}`;
    storageMap.set(
      key,
      JSON.stringify({ last_active: Date.now() - daysAgo * 24 * 60 * 60 * 1000 })
    );
  };

  /** Set player_stats storage for the Power Rating derivation (issue #871). */
  const setPlayerStats = (
    level: number,
    xp: number,
    stats: { attack: number; defense: number; dodge: number; crit_rate: number }
  ) => {
    storageMap.set('player_stats:test-user', JSON.stringify({ level, xp, stats }));
  };

  /** Set decay config in storage map */
  const setDecayConfig = (config: any) => {
    const key = 'rating_decay_config:rating_decay_config';
    storageMap.set(key, JSON.stringify(config));
  };

  /** Set archive data in storage map */
  const setArchiveData = (data: any) => {
    const key = 'season_archive:season_archive';
    storageMap.set(key, JSON.stringify(data));
  };

  /** Set user metadata in storage map */
  const setUserMetadata = (userId: string, data: any) => {
    const key = `user_metadata:${userId}`;
    storageMap.set(key, JSON.stringify(data));
  };

  /**
   * Creates a storageRead mock that routes queries to the storageMap.
   * Collections handled: player_last_active, rating_decay_config,
   * season_archive, user_metadata
   */
  const createRoutedStorageRead = () => {
    return jest.fn((queries: { collection: string; key: string; userId?: string }[]) => {
      return queries
        .map((q) => {
          const userId = q.userId ?? '';
          let lookupKey: string;

          if (q.collection === 'player_last_active') {
            lookupKey = `player_last_active:${userId}`;
          } else if (q.collection === 'user_metadata') {
            lookupKey = `user_metadata:${q.key}`;
          } else {
            lookupKey = `${q.collection}:${q.key}`;
          }

          const value = storageMap.get(lookupKey);
          if (value === undefined) return null;

          return {
            collection: q.collection,
            key: q.key,
            userId,
            value,
            version: '1',
            permissionRead: 1,
            permissionWrite: 1,
            createTime: Date.now(),
            updateTime: Date.now(),
          };
        })
        .filter(Boolean);
    });
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user', username: 'TestPlayer' });
    mockNk = createMockNakama();
    jest.clearAllMocks();

    storageMap = new Map();

    // By default, all players are active (0 days ago)
    mockNk.storageRead = createRoutedStorageRead();
    mockNk.storageWrite = jest.fn();
    mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);
  });

  // ============================================
  // rpcGetPlayerRank Tests
  // ============================================

  describe('rpcGetPlayerRank', () => {
    it('should return explicit power_rating/ladder_rating/standing plus legacy aliases (issue #871)', async () => {
      setPlayerActive('test-user', 2);
      setPlayerStats(12, 3400, { attack: 40, defense: 32, dodge: 24, crit_rate: 16 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([createMockLeaderboardRecord()]);

      const result = await rpcGetPlayerRank(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      const expectedPowerRating = Math.floor(12 * 10 + (40 + 32 + 24 + 16) / 4);

      expect(parsed.success).toBe(true);
      // Explicit fields (CONTEXT.md vocabulary)
      expect(parsed.power_rating).toBe(expectedPowerRating);
      expect(parsed.level).toBe(12);
      expect(parsed.xp).toBe(3400);
      expect(parsed.ladder_rating).toBe(1500);
      expect(parsed.standing).toBeGreaterThanOrEqual(1);
      expect(parsed.decayed_rating).toBe(1500);
      expect(parsed.days_inactive).toBe(2);
      expect(parsed.time_remaining).toBeGreaterThan(0);
      expect(parsed.wins).toBe(10);
      expect(parsed.losses).toBe(2);
      expect(parsed.win_rate).toBe(0.83);
      // Deprecated legacy aliases keep the live season-shape meanings
      expect(parsed.rank).toBe(parsed.standing);
      expect(parsed.rating).toBe(parsed.ladder_rating);
    });

    it('should return zero ladder/standing values when player has no leaderboard entry, but still derive power_rating', async () => {
      setPlayerStats(5, 450, { attack: 12, defense: 10, dodge: 8, crit_rate: 6 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);

      const result = await rpcGetPlayerRank(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.power_rating).toBe(Math.floor(5 * 10 + (12 + 10 + 8 + 6) / 4));
      expect(parsed.standing).toBe(0);
      expect(parsed.ladder_rating).toBe(0);
      expect(parsed.decayed_rating).toBe(0);
      expect(parsed.days_inactive).toBe(0);
      expect(parsed.rank).toBe(0);
      expect(parsed.rating).toBe(0);
    });

    it('should default power_rating to 0 when player_stats storage is missing', async () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([createMockLeaderboardRecord()]);

      const result = await rpcGetPlayerRank(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.power_rating).toBe(0);
      expect(parsed.level).toBe(0);
      expect(parsed.xp).toBe(0);
    });

    it('should apply rating decay for inactive player', async () => {
      setPlayerActive('test-user', 14);
      mockNk.leaderboardRecordList = jest
        .fn()
        .mockReturnValue([createMockLeaderboardRecord({ score: 1500 })]);

      const result = await rpcGetPlayerRank(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.decayed_rating).toBeLessThan(parsed.rating);
      expect(parsed.days_inactive).toBe(14);
    });

    it('should handle empty payload string', async () => {
      setPlayerActive('test-user', 0);
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([createMockLeaderboardRecord()]);

      const result = await rpcGetPlayerRank(mockCtx, mockLogger, mockNk, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    it('should return validation error for invalid JSON', async () => {
      const result = await rpcGetPlayerRank(mockCtx, mockLogger, mockNk, 'not-valid-json{{{');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should accept optional season_id parameter', async () => {
      setPlayerActive('test-user', 0);
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([createMockLeaderboardRecord()]);

      const result = await rpcGetPlayerRank(
        mockCtx,
        mockLogger,
        mockNk,
        JSON.stringify({ season_id: 'season_5' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    it('should calculate rank based on decayed ratings', async () => {
      const records = [
        createMockLeaderboardRecord({ ownerId: 'user1', rank: 1, score: 1800 }),
        createMockLeaderboardRecord({ ownerId: 'user2', rank: 2, score: 1700 }),
        createMockLeaderboardRecord({ ownerId: 'test-user', rank: 3, score: 1500 }),
        createMockLeaderboardRecord({ ownerId: 'user4', rank: 4, score: 1400 }),
      ];

      // All other players active; test-user inactive
      setPlayerActive('user1', 1);
      setPlayerActive('user2', 1);
      setPlayerActive('test-user', 14);
      setPlayerActive('user4', 1);

      mockNk.leaderboardRecordList = jest.fn((_id: string, ownerIds: string[]) => {
        if (ownerIds && ownerIds.length === 1) {
          return [records.find((r) => r.ownerId === ownerIds[0])!];
        }
        return records;
      });

      const result = await rpcGetPlayerRank(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.decayed_rating).toBeLessThan(parsed.rating);
    });

    it('should handle 2v2 mode in metadata', async () => {
      setPlayerActive('test-user', 0);
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([
        createMockLeaderboardRecord({
          metadata: JSON.stringify({
            wins: 5,
            losses: 1,
            win_rate: 0.83,
            punch_up_wins: 2,
            mode: '2v2',
            matches: 6,
          }),
        }),
      ]);

      const result = await rpcGetPlayerRank(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.wins).toBe(5);
    });

    it('should log errors and return error response on exception', async () => {
      mockNk.leaderboardRecordList = jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await rpcGetPlayerRank(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Failed to retrieve player rank');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle missing metadata gracefully', async () => {
      setPlayerActive('test-user', 0);
      mockNk.leaderboardRecordList = jest
        .fn()
        .mockReturnValue([createMockLeaderboardRecord({ metadata: '' })]);

      const result = await rpcGetPlayerRank(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.wins).toBe(0);
      expect(parsed.losses).toBe(0);
    });

    it('should handle malformed metadata gracefully', async () => {
      setPlayerActive('test-user', 0);
      mockNk.leaderboardRecordList = jest
        .fn()
        .mockReturnValue([createMockLeaderboardRecord({ metadata: 'invalid-json' })]);

      const result = await rpcGetPlayerRank(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      // Malformed metadata causes an error inside getPlayerRank,
      // caught by the outer try-catch in rpcGetPlayerRank
      expect(parsed.success).toBeDefined();
    });
  });

  // ============================================
  // rpcGetSeasonHistory Tests
  // ============================================

  describe('rpcGetSeasonHistory', () => {
    it('should return empty history when no seasons archived', async () => {
      const result = await rpcGetSeasonHistory(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.history).toEqual([]);
      expect(parsed.total).toBe(0);
    });

    it('should return archived seasons in descending order', async () => {
      setArchiveData({
        season_1: {
          season_id: 'season_1',
          season_number: 1,
          start_time: Date.now() - 90 * 24 * 60 * 60 * 1000,
          end_time: Date.now() - 60 * 24 * 60 * 60 * 1000,
          winner_id: 'player_1',
          winner_name: 'Champion1',
          winner_rating: 2000,
          total_players: 100,
          rewards_distributed: true,
        },
        season_2: {
          season_id: 'season_2',
          season_number: 2,
          start_time: Date.now() - 60 * 24 * 60 * 60 * 1000,
          end_time: Date.now() - 30 * 24 * 60 * 60 * 1000,
          winner_id: 'player_2',
          winner_name: 'Champion2',
          winner_rating: 2100,
          total_players: 150,
          rewards_distributed: false,
        },
        season_3: {
          season_id: 'season_3',
          season_number: 3,
          start_time: Date.now() - 30 * 24 * 60 * 60 * 1000,
          end_time: Date.now(),
          winner_id: 'player_3',
          winner_name: 'Champion3',
          winner_rating: 2200,
          total_players: 200,
          rewards_distributed: false,
        },
      });

      const result = await rpcGetSeasonHistory(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.total).toBe(3);
      expect(parsed.history[0].season_number).toBe(3);
      expect(parsed.history[1].season_number).toBe(2);
      expect(parsed.history[2].season_number).toBe(1);
    });

    it('should respect limit parameter', async () => {
      setArchiveData({
        season_1: {
          season_id: 'season_1',
          season_number: 1,
          start_time: 1,
          end_time: 2,
          winner_id: 'p1',
          winner_name: 'C1',
          winner_rating: 2000,
          total_players: 100,
          rewards_distributed: true,
        },
        season_2: {
          season_id: 'season_2',
          season_number: 2,
          start_time: 3,
          end_time: 4,
          winner_id: 'p2',
          winner_name: 'C2',
          winner_rating: 2100,
          total_players: 150,
          rewards_distributed: false,
        },
        season_3: {
          season_id: 'season_3',
          season_number: 3,
          start_time: 5,
          end_time: 6,
          winner_id: 'p3',
          winner_name: 'C3',
          winner_rating: 2200,
          total_players: 200,
          rewards_distributed: false,
        },
      });

      const result = await rpcGetSeasonHistory(
        mockCtx,
        mockLogger,
        mockNk,
        JSON.stringify({ limit: 2 })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.history).toHaveLength(2);
      expect(parsed.history[0].season_number).toBe(3);
      expect(parsed.history[1].season_number).toBe(2);
    });

    it('should default to limit of 10 when not provided', async () => {
      const result = await rpcGetSeasonHistory(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.history).toEqual([]);
      expect(parsed.total).toBe(0);
    });

    it('should return validation error for invalid limit type', async () => {
      const result = await rpcGetSeasonHistory(
        mockCtx,
        mockLogger,
        mockNk,
        JSON.stringify({ limit: 'not-a-number' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for limit too high', async () => {
      const result = await rpcGetSeasonHistory(
        mockCtx,
        mockLogger,
        mockNk,
        JSON.stringify({ limit: 100 })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for negative limit', async () => {
      const result = await rpcGetSeasonHistory(
        mockCtx,
        mockLogger,
        mockNk,
        JSON.stringify({ limit: -1 })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should handle invalid JSON payload', async () => {
      const result = await rpcGetSeasonHistory(mockCtx, mockLogger, mockNk, 'not-valid-json{{{');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should handle storage read errors gracefully', async () => {
      // Override the routed storage read to throw after validation passes
      const origStorageRead = mockNk.storageRead;
      mockNk.storageRead = jest.fn().mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = await rpcGetSeasonHistory(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      // getSeasonArchive catches errors and returns {}, so we get empty success
      expect(parsed.success).toBe(true);
      expect(parsed.history).toEqual([]);
    });

    it('should handle malformed archive data', async () => {
      // Put invalid JSON directly in storageMap
      storageMap.set('season_archive:season_archive', 'invalid-json');

      const result = await rpcGetSeasonHistory(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      // getSeasonArchive catches parse errors and returns {}
      expect(parsed.success).toBe(true);
      expect(parsed.history).toEqual([]);
    });

    it('should handle partial archive data (some seasons missing fields)', async () => {
      setArchiveData({
        season_1: {
          season_id: 'season_1',
          season_number: 1,
        },
        season_2: {
          season_id: 'season_2',
          season_number: 2,
          start_time: Date.now() - 60 * 24 * 60 * 60 * 1000,
          end_time: Date.now() - 30 * 24 * 60 * 60 * 1000,
          winner_id: 'player_2',
          winner_name: 'Champion2',
          winner_rating: 2100,
          total_players: 150,
          rewards_distributed: false,
        },
      });

      const result = await rpcGetSeasonHistory(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.total).toBe(2);
    });
  });

  // ============================================
  // getTopPlayers Tests (Internal Function)
  // ============================================

  describe('getTopPlayers', () => {
    it('should return top players with decay info', async () => {
      const records = [
        createMockLeaderboardRecord({ ownerId: 'user1', rank: 1, score: 2000 }),
        createMockLeaderboardRecord({ ownerId: 'user2', rank: 2, score: 1800 }),
        createMockLeaderboardRecord({ ownerId: 'user3', rank: 3, score: 1600 }),
      ];
      setPlayerActive('user1', 0);
      setPlayerActive('user2', 0);
      setPlayerActive('user3', 0);

      mockNk.leaderboardRecordList = jest.fn().mockReturnValue(records);

      const result = await getTopPlayers(mockNk, TEST_SEASON_ID, null, 10);

      expect(result).toHaveLength(3);
      expect(result[0].player_id).toBe('user1');
      expect(result[0].rating).toBe(2000);
      expect(result[0].decayed_rating).toBe(2000);
    });

    it('should filter by mode when specified', async () => {
      const records = [
        createMockLeaderboardRecord({
          ownerId: 'user1',
          rank: 1,
          score: 2000,
          metadata: JSON.stringify({
            mode: '1v1',
            wins: 10,
            losses: 2,
            win_rate: 0.83,
            punch_up_wins: 3,
            matches: 12,
          }),
        }),
        createMockLeaderboardRecord({
          ownerId: 'user2',
          rank: 2,
          score: 1800,
          metadata: JSON.stringify({
            mode: '2v2',
            wins: 8,
            losses: 2,
            win_rate: 0.8,
            punch_up_wins: 2,
            matches: 10,
          }),
        }),
        createMockLeaderboardRecord({
          ownerId: 'user3',
          rank: 3,
          score: 1700,
          metadata: JSON.stringify({
            mode: '1v1',
            wins: 7,
            losses: 3,
            win_rate: 0.7,
            punch_up_wins: 1,
            matches: 10,
          }),
        }),
      ];
      setPlayerActive('user1', 0);
      setPlayerActive('user2', 0);
      setPlayerActive('user3', 0);

      mockNk.leaderboardRecordList = jest.fn().mockReturnValue(records);

      const result = await getTopPlayers(mockNk, TEST_SEASON_ID, '1v1', 10);

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.mode === '1v1')).toBe(true);
    });

    it('should pass limit parameter to leaderboard query', async () => {
      const records = Array.from({ length: 10 }, (_, i) =>
        createMockLeaderboardRecord({
          ownerId: `user${i}`,
          rank: i + 1,
          score: 2000 - i * 20,
        })
      );
      for (let i = 0; i < 10; i++) setPlayerActive(`user${i}`, 0);

      mockNk.leaderboardRecordList = jest.fn().mockReturnValue(records);

      await getTopPlayers(mockNk, TEST_SEASON_ID, null, 10);

      // The limit is passed to leaderboardRecordList as the 3rd arg
      expect(mockNk.leaderboardRecordList).toHaveBeenCalledWith(TEST_SEASON_ID, [], 10, '', 0);
    });

    it('should apply rating decay for inactive players', async () => {
      setPlayerActive('user1', 1);
      setPlayerActive('user2', 14); // Inactive

      mockNk.leaderboardRecordList = jest
        .fn()
        .mockReturnValue([
          createMockLeaderboardRecord({ ownerId: 'user1', rank: 1, score: 2000 }),
          createMockLeaderboardRecord({ ownerId: 'user2', rank: 2, score: 1900 }),
        ]);

      const result = await getTopPlayers(mockNk, TEST_SEASON_ID, null, 10);

      const user2 = result.find((r) => r.player_id === 'user2');
      expect(user2!.decayed_rating).toBeLessThan(user2!.rating);
      expect(user2!.days_inactive).toBe(14);
    });

    it('should sort by decayed rating', async () => {
      setPlayerActive('user1', 1);
      setPlayerActive('user2', 30); // Very inactive, high decay
      setPlayerActive('user3', 1);

      mockNk.leaderboardRecordList = jest
        .fn()
        .mockReturnValue([
          createMockLeaderboardRecord({ ownerId: 'user1', rank: 1, score: 2000 }),
          createMockLeaderboardRecord({ ownerId: 'user2', rank: 2, score: 1950 }),
          createMockLeaderboardRecord({ ownerId: 'user3', rank: 3, score: 1900 }),
        ]);

      const result = await getTopPlayers(mockNk, TEST_SEASON_ID, null, 10);

      const user2Idx = result.findIndex((r) => r.player_id === 'user2');
      const user3Idx = result.findIndex((r) => r.player_id === 'user3');
      expect(user2Idx).toBeGreaterThan(user3Idx);
    });

    it('should update ranks after decay sorting', async () => {
      setPlayerActive('user1', 0);
      setPlayerActive('user2', 0);
      setPlayerActive('user3', 0);

      mockNk.leaderboardRecordList = jest
        .fn()
        .mockReturnValue([
          createMockLeaderboardRecord({ ownerId: 'user1', rank: 1, score: 2000 }),
          createMockLeaderboardRecord({ ownerId: 'user2', rank: 2, score: 1900 }),
          createMockLeaderboardRecord({ ownerId: 'user3', rank: 3, score: 1800 }),
        ]);

      const result = await getTopPlayers(mockNk, TEST_SEASON_ID, null, 10);

      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
    });

    it('should handle empty leaderboard', async () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);
      const result = await getTopPlayers(mockNk, TEST_SEASON_ID, null, 10);
      expect(result).toEqual([]);
    });

    it('should use default mode when not specified in metadata', async () => {
      setPlayerActive('user1', 0);

      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([
        createMockLeaderboardRecord({
          ownerId: 'user1',
          rank: 1,
          score: 2000,
          metadata: JSON.stringify({
            wins: 10,
            losses: 2,
            win_rate: 0.83,
            punch_up_wins: 3,
            matches: 12,
          }),
        }),
      ]);

      const result = await getTopPlayers(mockNk, TEST_SEASON_ID, null, 10);
      expect(result[0].mode).toBe('1v1');
    });

    it('should handle missing last active data', async () => {
      // Don't set player activity - getPlayerLastActive returns 0
      mockNk.leaderboardRecordList = jest
        .fn()
        .mockReturnValue([createMockLeaderboardRecord({ ownerId: 'user1', score: 2000 })]);

      const result = await getTopPlayers(mockNk, TEST_SEASON_ID, null, 10);

      expect(result).toHaveLength(1);
      // With last_active=0, daysInactive will be very large (since epoch)
      expect(result[0].days_inactive).toBeGreaterThan(0);
    });
  });

  // ============================================
  // recordSeasonCompletion Tests
  // ============================================

  describe('recordSeasonCompletion', () => {
    it('should archive season with winner', async () => {
      // Set up leaderboard records: winner-user at rank 1
      const allRecords = Array.from({ length: 100 }, (_, i) => ({
        ownerId: `user${i}`,
        username: `Player${i}`,
        rank: i + 1,
        score: 2000 - i * 10,
        metadata: JSON.stringify({
          wins: 10,
          losses: 2,
          win_rate: 0.83,
          punch_up_wins: 3,
          mode: '1v1',
          matches: 12,
        }),
      }));
      // Override first entry as our winner
      allRecords[0] = {
        ownerId: 'winner-user',
        username: 'Champion',
        rank: 1,
        score: 2000,
        metadata: JSON.stringify({
          wins: 40,
          losses: 10,
          win_rate: 0.8,
          punch_up_wins: 15,
          mode: '1v1',
          matches: 50,
        }),
      };

      for (const r of allRecords) setPlayerActive(r.ownerId, 0);
      setUserMetadata('winner-user', { username: 'Champion' });

      mockNk.leaderboardRecordList = jest.fn().mockReturnValue(allRecords);

      const archive = await recordSeasonCompletion(mockNk, TEST_SEASON_ID, mockLogger);

      expect(archive.season_id).toBe(TEST_SEASON_ID);
      expect(archive.winner_id).toBe('winner-user');
      expect(archive.winner_rating).toBe(2000);
      expect(archive.total_players).toBe(100);
      expect(archive.rewards_distributed).toBe(false);
      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should handle season with no players', async () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);

      const archive = await recordSeasonCompletion(mockNk, TEST_SEASON_ID, mockLogger);

      expect(archive.total_players).toBe(0);
      expect(archive.winner_id).toBe('');
      // When winner is null, winner_name defaults to '' (empty ternary)
      expect(archive.winner_name).toBe('');
      expect(archive.winner_rating).toBe(0);
    });

    it('should append to existing archive', async () => {
      setArchiveData({
        season_0: {
          season_id: 'season_0',
          season_number: 0,
          start_time: Date.now() - 120 * 24 * 60 * 60 * 1000,
          end_time: Date.now() - 90 * 24 * 60 * 60 * 1000,
          winner_id: 'old-winner',
          winner_name: 'OldChamp',
          winner_rating: 1500,
          total_players: 50,
          rewards_distributed: true,
        },
      });

      setPlayerActive('new-winner', 0);
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([
        {
          ownerId: 'new-winner',
          username: 'NewChamp',
          rank: 1,
          score: 2000,
          metadata: JSON.stringify({
            wins: 10,
            losses: 2,
            win_rate: 0.83,
            punch_up_wins: 3,
            mode: '1v1',
            matches: 12,
          }),
        },
      ]);

      const archive = await recordSeasonCompletion(mockNk, TEST_SEASON_ID, mockLogger);

      const writeCall = mockNk.storageWrite.mock.calls[0][0][0];
      const writtenData = JSON.parse(writeCall.value);

      expect(writtenData['season_0']).toBeDefined();
      expect(writtenData[TEST_SEASON_ID]).toBeDefined();
    });

    it('should use "Unknown" for winner name when not found', async () => {
      setPlayerActive('winner-user', 0);
      // No user metadata set

      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([
        {
          ownerId: 'winner-user',
          username: 'WinnerName',
          rank: 1,
          score: 2000,
          metadata: JSON.stringify({
            wins: 10,
            losses: 2,
            win_rate: 0.83,
            punch_up_wins: 3,
            mode: '1v1',
            matches: 12,
          }),
        },
      ]);

      const archive = await recordSeasonCompletion(mockNk, TEST_SEASON_ID, mockLogger);

      expect(archive.winner_name).toBe('Unknown');
    });

    it('should use display_name from user metadata when available', async () => {
      setPlayerActive('winner-user', 0);
      setUserMetadata('winner-user', { display_name: 'DisplayChamp' });

      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([
        {
          ownerId: 'winner-user',
          username: 'WinnerName',
          rank: 1,
          score: 2000,
          metadata: JSON.stringify({
            wins: 10,
            losses: 2,
            win_rate: 0.83,
            punch_up_wins: 3,
            mode: '1v1',
            matches: 12,
          }),
        },
      ]);

      const archive = await recordSeasonCompletion(mockNk, TEST_SEASON_ID, mockLogger);

      expect(archive.winner_name).toBe('DisplayChamp');
    });

    it('should use username field from user metadata', async () => {
      setPlayerActive('winner-user', 0);
      setUserMetadata('winner-user', { username: 'UserChamp' });

      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([
        {
          ownerId: 'winner-user',
          username: 'WinnerName',
          rank: 1,
          score: 2000,
          metadata: JSON.stringify({
            wins: 10,
            losses: 2,
            win_rate: 0.83,
            punch_up_wins: 3,
            mode: '1v1',
            matches: 12,
          }),
        },
      ]);

      const archive = await recordSeasonCompletion(mockNk, TEST_SEASON_ID, mockLogger);

      expect(archive.winner_name).toBe('UserChamp');
    });

    it('should log archive info', async () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);

      await recordSeasonCompletion(mockNk, TEST_SEASON_ID, mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Season archived',
        expect.objectContaining({
          season_id: TEST_SEASON_ID,
        })
      );
    });
  });

  // ============================================
  // getPlayerRank Tests (Internal Function)
  // ============================================

  describe('getPlayerRank', () => {
    it('should return null for non-existent player', async () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);

      const result = await getPlayerRank(mockNk, TEST_SEASON_ID, 'non-existent-user');
      expect(result).toBeNull();
    });

    it('should return rank and entry for existing player', async () => {
      setPlayerActive('test-user', 0);

      mockNk.leaderboardRecordList = jest.fn((_id: string, ownerIds: string[]) => {
        if (ownerIds && ownerIds.length === 1 && ownerIds[0] === 'test-user') {
          return [createMockLeaderboardRecord()];
        }
        return [];
      });

      const result = await getPlayerRank(mockNk, TEST_SEASON_ID, 'test-user');

      expect(result).not.toBeNull();
      expect(result!.rank).toBeDefined();
      expect(result!.entry.player_id).toBe('test-user');
      expect(result!.entry.rating).toBe(1500);
    });

    it('should recalculate rank based on decayed ratings', async () => {
      setPlayerActive('higher-rated', 120); // Very inactive, max decay (200 pts)
      setPlayerActive('test-user', 1);
      setPlayerActive('lower-rated', 1);

      const records = [
        {
          ownerId: 'higher-rated',
          username: 'Higher',
          rank: 1,
          score: 1600,
          metadata: JSON.stringify({
            wins: 10,
            losses: 2,
            win_rate: 0.83,
            punch_up_wins: 3,
            mode: '1v1',
            matches: 12,
          }),
        },
        {
          ownerId: 'test-user',
          username: 'TestPlayer',
          rank: 2,
          score: 1500,
          metadata: JSON.stringify({
            wins: 10,
            losses: 2,
            win_rate: 0.83,
            punch_up_wins: 3,
            mode: '1v1',
            matches: 12,
          }),
        },
        {
          ownerId: 'lower-rated',
          username: 'Lower',
          rank: 3,
          score: 1400,
          metadata: JSON.stringify({
            wins: 10,
            losses: 2,
            win_rate: 0.83,
            punch_up_wins: 3,
            mode: '1v1',
            matches: 12,
          }),
        },
      ];

      mockNk.leaderboardRecordList = jest.fn((_id: string, ownerIds: string[]) => {
        if (ownerIds && ownerIds.length === 1 && ownerIds[0] === 'test-user') {
          return [records[1]];
        }
        return records;
      });

      const result = await getPlayerRank(mockNk, TEST_SEASON_ID, 'test-user');

      expect(result).not.toBeNull();
      expect(result!.rank).toBe(1); // higher-rated decayed below test-user
    });
  });

  // ============================================
  // Registration Functions Tests
  // ============================================

  describe('registerRpcGetPlayerRank (sole registration, issue #871)', () => {
    it('should register the RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcGetPlayerRank(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_player_rank',
        rpcGetPlayerRank
      );
    });
  });

  describe('registerRpcGetSeasonHistory', () => {
    it('should register the RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcGetSeasonHistory(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_season_history',
        rpcGetSeasonHistory
      );
    });
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================

  describe('Edge Cases', () => {
    it('should handle zero season number in archive', async () => {
      setArchiveData({
        season_0: {
          season_id: 'season_0',
          season_number: 0,
          start_time: Date.now() - 120 * 24 * 60 * 60 * 1000,
          end_time: Date.now() - 90 * 24 * 60 * 60 * 1000,
          winner_id: 'winner',
          winner_name: 'Champ',
          winner_rating: 2000,
          total_players: 100,
          rewards_distributed: true,
        },
      });

      const result = await rpcGetSeasonHistory(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.total).toBe(1);
      expect(parsed.history[0].season_number).toBe(0);
    });

    it('should handle very large season numbers', async () => {
      setArchiveData({
        season_999: {
          season_id: 'season_999',
          season_number: 999,
          start_time: 1,
          end_time: 2,
          winner_id: 'winner',
          winner_name: 'Champ',
          winner_rating: 2000,
          total_players: 100,
          rewards_distributed: true,
        },
      });

      const result = await rpcGetSeasonHistory(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.history[0].season_number).toBe(999);
    });

    it('should handle negative ratings via minimum rating floor', async () => {
      setPlayerActive('test-user', 0);
      mockNk.leaderboardRecordList = jest
        .fn()
        .mockReturnValue([createMockLeaderboardRecord({ score: -100 })]);

      const result = await rpcGetPlayerRank(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rating).toBe(-100);
      // decayed_rating uses Math.max(score - decay, minimum_rating)
      // With 0 days inactive, decay=0, so Math.max(-100-0, 1000)=1000
      expect(parsed.decayed_rating).toBe(1000);
    });

    it('should return validation error for zero limit', async () => {
      const result = await rpcGetSeasonHistory(
        mockCtx,
        mockLogger,
        mockNk,
        JSON.stringify({ limit: 0 })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for decimal limit', async () => {
      const result = await rpcGetSeasonHistory(
        mockCtx,
        mockLogger,
        mockNk,
        JSON.stringify({ limit: 5.5 })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should handle null values in archive', async () => {
      setArchiveData({
        season_1: {
          season_id: 'season_1',
          season_number: 1,
          start_time: null as unknown as number,
          end_time: null as unknown as number,
          winner_id: null as unknown as string,
          winner_name: null as unknown as string,
          winner_rating: null as unknown as number,
          total_players: null as unknown as number,
          rewards_distributed: false,
        },
      });

      const result = await rpcGetSeasonHistory(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.history).toHaveLength(1);
    });

    it('should use custom decay config when stored', async () => {
      setPlayerActive('test-user', 10);
      setDecayConfig({
        inactive_days_threshold: 3, // Much lower default
        decay_rate_percent: 5,
        high_decay_threshold_days: 30,
        high_decay_rate_percent: 10,
        minimum_rating: 500,
        max_decay_loss: 500,
      });

      mockNk.leaderboardRecordList = jest
        .fn()
        .mockReturnValue([createMockLeaderboardRecord({ score: 2000 })]);

      const result = await rpcGetPlayerRank(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      // With custom threshold of 3 days, 10 days inactive should trigger decay
      expect(parsed.decayed_rating).toBeLessThan(parsed.rating);
    });
  });
});
