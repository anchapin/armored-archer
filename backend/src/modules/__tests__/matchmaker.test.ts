import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import {
  rpcCreateMatch,
  rpcAcceptMatch,
  rpcListMatches,
  rpcCompleteMatch,
  calculateRank,
  generateMatchId,
  PvPMatch,
  registerRpcListMatches,
  registerRpcCreateMatch,
  registerRpcAcceptMatch,
  registerRpcCompleteMatch,
  rpcGetMatchHistory,
  rpcGetMatchDetails,
  rpcAdminQueryMatches,
  registerRpcGetMatchHistory,
  registerRpcGetMatchDetails,
  registerRpcAdminQueryMatches,
  isPunchUpMatch,
  calculatePunchUpGemBonus,
  generatePunchUpDescription,
  type PunchUpInfo,
} from '../matchmaker';
import { resetRateLimiting, initializeRateLimiting } from '../rate_limit';
import { resetPunchUpWatchState } from '../punchup_watch';

// Mock anti_cheat module
jest.mock('../anti_cheat', () => ({
  isPlayerFlagged: jest.fn(),
  getFlagReason: jest.fn(),
  recordMatchResult: jest.fn(),
  getPlayerMatchHistory: jest.fn(),
}));

// Mock season_system module
jest.mock('../season_system', () => ({
  getCurrentSeason: jest.fn(),
  applyEloUpdates: jest.fn(),
  getEloKFactors: jest.fn((isPunchUp: boolean, loserIsUnderdog: boolean) => ({
    winnerK: isPunchUp ? 50 : 32,
    loserK: isPunchUp && loserIsUnderdog ? 100 : isPunchUp ? 50 : 32,
  })),
  getLeaderboardEntry: jest.fn(),
  recordPlayerActivity: jest.fn(),
  applyRankDecay: jest.fn(),
}));

// Mock audit module
jest.mock('../audit', () => ({
  logAudit: jest.fn(),
}));

import { isPlayerFlagged, getFlagReason, recordMatchResult } from '../anti_cheat';
import {
  getCurrentSeason,
  applyEloUpdates,
  getLeaderboardEntry,
  recordPlayerActivity,
  applyRankDecay,
} from '../season_system';
import { logAudit } from '../audit';

describe('matchmaker', () => {
  let mockLogger: any;
  let mockCtx: any;
  let mockNk: any;

  const createPlayerStats = (overrides = {}): any => ({
    level: 5,
    xp: 500,
    stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 8 },
    ...overrides,
  });

  const createMatch = (overrides = {}): PvPMatch => ({
    match_id: 'match_123',
    creator_id: 'creator-user',
    opponent_id: '',
    creator_rank: 15,
    opponent_rank: 0,
    match_type: 'ranked',
    is_punch_up: false,
    status: 'pending',
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    // Reset rate limiting state before each test to prevent interference
    resetRateLimiting();
    initializeRateLimiting();

    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user-123' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  describe('rpcCreateMatch', () => {
    it('should create a match with target opponent', () => {
      const playerStats = createPlayerStats();
      const targetPlayerStats = createPlayerStats({
        level: 5,
        stats: { attack: 18, defense: 14, dodge: 9, crit_rate: 7 },
      });

      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].key === 'test-user-123') {
          return [
            {
              collection: 'player_stats',
              key: 'test-user-123',
              userId: 'test-user-123',
              value: JSON.stringify(playerStats),
            },
          ];
        } else if (objects[0].key === 'target-user') {
          return [
            {
              collection: 'player_stats',
              key: 'target-user',
              userId: 'target-user',
              value: JSON.stringify(targetPlayerStats),
            },
          ];
        }
        return [];
      });

      const payload = JSON.stringify({ match_type: 'ranked', target_opponent_id: 'target-user' });
      const result = rpcCreateMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.match.opponent_id).toBe('target-user');
      expect(parsed.match.creator_id).toBe('test-user-123');
      expect(parsed.match.status).toBe('pending');
      expect(parsed.match.match_type).toBe('ranked');
      expect(parsed.match.is_punch_up).toBe(false);
    });

    it('should allow punch-up when flag set', () => {
      // Use ranks within valid punch-up range (5-15 difference)
      // Level 3 gives rank ~30, Level 6 gives rank ~60, difference of 30 (too high)
      // Let's use level 3 (~30) and level 5 (~50), difference of 20 (still too high)
      // We need ranks between 20+ with 5-15 difference
      // Level 3: rank = 3*10 + (20+15+10+8)/4 = 30 + 53/4 = 43
      // Level 5: rank = 5*10 + (20+15+10+8)/4 = 50 + 53/4 = 63, diff = 20 (too high)
      // Let's create stats with different values to get valid ranks
      const playerStats = createPlayerStats({
        level: 3,
        stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 8 }, // rank ~43
      });
      const targetPlayerStats = createPlayerStats({
        level: 5,
        stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 8 }, // rank ~63, diff = 20 (too high)
      });

      // Use lower ranks for valid punch-up
      // Level 2: rank = 20 + 53/4 = 33
      // Level 4: rank = 40 + 53/4 = 53, diff = 20 (still too high)
      // We need to adjust stats to get closer ranks
      const validPlayerStats = createPlayerStats({
        level: 4,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }, // rank = 40 + 35/4 = 49
      });
      const validTargetStats = createPlayerStats({
        level: 2,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }, // rank = 20 + 35/4 = 29, diff = 20 (still too high)
      });

      // Let me calculate more carefully
      // We need both ranks >= 20 and diff between 5-15
      // If player rank = 40 and target rank = 50, diff = 10 (valid)
      // Player: level 4 gives base 40, need 0 additional from stats
      // Target: level 5 gives base 50, need 0 additional from stats

      const punchUpPlayerStats = createPlayerStats({
        level: 4,
        stats: { attack: 0, defense: 0, dodge: 0, crit_rate: 0 }, // rank = 40
      });
      const punchUpTargetStats = createPlayerStats({
        level: 5,
        stats: { attack: 0, defense: 0, dodge: 0, crit_rate: 0 }, // rank = 50, diff = 10
      });

      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].key === 'test-user-123') {
          return [
            {
              collection: 'player_stats',
              key: 'test-user-123',
              userId: 'test-user-123',
              value: JSON.stringify(punchUpPlayerStats),
            },
          ];
        } else if (objects[0].key === 'target-user') {
          return [
            {
              collection: 'player_stats',
              key: 'target-user',
              userId: 'target-user',
              value: JSON.stringify(punchUpTargetStats),
            },
          ];
        }
        return [];
      });

      const payload = JSON.stringify({
        match_type: 'ranked',
        target_opponent_id: 'target-user',
        is_punch_up: true,
      });
      const result = rpcCreateMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.match.is_punch_up).toBe(true);
      expect(parsed.punch_up_info).toBeTruthy();
      expect(parsed.punch_up_info.rank_difference).toBe(10);
    });

    it('should return error when target player not found', () => {
      const playerStats = createPlayerStats();
      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].key === 'test-user-123') {
          return [
            {
              collection: 'player_stats',
              key: 'test-user-123',
              userId: 'test-user-123',
              value: JSON.stringify(playerStats),
            },
          ];
        }
        return [];
      });

      const payload = JSON.stringify({ match_type: 'ranked', target_opponent_id: 'non-existent' });
      const result = rpcCreateMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Target player not found');
    });

    it('should return error when rank difference too large without punch-up', () => {
      const playerStats = createPlayerStats({ level: 10 });
      const targetPlayerStats = createPlayerStats({ level: 1 });

      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].key === 'test-user-123') {
          return [
            {
              collection: 'player_stats',
              key: 'test-user-123',
              userId: 'test-user-123',
              value: JSON.stringify(playerStats),
            },
          ];
        } else if (objects[0].key === 'target-user') {
          return [
            {
              collection: 'player_stats',
              key: 'target-user',
              userId: 'target-user',
              value: JSON.stringify(targetPlayerStats),
            },
          ];
        }
        return [];
      });

      const payload = JSON.stringify({ match_type: 'ranked', target_opponent_id: 'target-user' });
      const result = rpcCreateMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain('Rank difference too large');
      expect(parsed.max_allowed).toBe(15);
    });

    it('should create open match when no target opponent', () => {
      const playerStats = createPlayerStats();
      mockNk.storageRead = jest.fn(() => [
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(playerStats),
        },
      ]);

      const payload = JSON.stringify({ match_type: 'casual' });
      const result = rpcCreateMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.match.opponent_id).toBe('');
      expect(parsed.match.opponent_rank).toBe(0);
      expect(parsed.match.is_punch_up).toBe(false);
      expect(parsed.match.status).toBe('pending');
    });

    // Issue #899: casual match creation must not advertise punch_up_info on
    // the wire. Punch-up shaping is ranked-only post-#872.
    it('should omit punch_up_info from casual open match response', () => {
      const playerStats = createPlayerStats();
      mockNk.storageRead = jest.fn(() => [
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(playerStats),
        },
      ]);

      const payload = JSON.stringify({ match_type: 'casual' });
      const result = rpcCreateMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.match.match_type).toBe('casual');
      expect(parsed.punch_up_info).toBeUndefined();
    });

    it('should omit punch_up_info from casual match with target opponent', () => {
      // Build ranks inside the punch-up band (both >=20, 5-15 gap) so the
      // server's auto-detector would flag is_punch_up=true if match_type
      // leaked through. The wire response must still hide punch_up_info for
      // casual — that's the issue #899 contract.
      const casualPlayerStats = createPlayerStats({
        level: 4,
        stats: { attack: 0, defense: 0, dodge: 0, crit_rate: 0 }, // rank = 40
      });
      const casualTargetStats = createPlayerStats({
        level: 5,
        stats: { attack: 0, defense: 0, dodge: 0, crit_rate: 0 }, // rank = 50
      });

      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].key === 'test-user-123') {
          return [
            {
              collection: 'player_stats',
              key: 'test-user-123',
              userId: 'test-user-123',
              value: JSON.stringify(casualPlayerStats),
            },
          ];
        }
        if (objects[0].key === 'target-user') {
          return [
            {
              collection: 'player_stats',
              key: 'target-user',
              userId: 'target-user',
              value: JSON.stringify(casualTargetStats),
            },
          ];
        }
        return [];
      });

      const payload = JSON.stringify({
        match_type: 'casual',
        target_opponent_id: 'target-user',
        is_punch_up: true,
      });
      const result = rpcCreateMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.match.match_type).toBe('casual');
      expect(parsed.punch_up_info).toBeUndefined();
    });

    it('should still include punch_up_info for ranked punch-up matches', () => {
      // Regression guard for the issue #899 fix: the ranked punch-up reward
      // path must keep working (do NOT change server constants; do NOT break
      // ranked rewards).
      const rankedPlayerStats = createPlayerStats({
        level: 4,
        stats: { attack: 0, defense: 0, dodge: 0, crit_rate: 0 }, // rank = 40
      });
      const rankedTargetStats = createPlayerStats({
        level: 5,
        stats: { attack: 0, defense: 0, dodge: 0, crit_rate: 0 }, // rank = 50, diff = 10
      });

      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].key === 'test-user-123') {
          return [
            {
              collection: 'player_stats',
              key: 'test-user-123',
              userId: 'test-user-123',
              value: JSON.stringify(rankedPlayerStats),
            },
          ];
        }
        if (objects[0].key === 'target-user') {
          return [
            {
              collection: 'player_stats',
              key: 'target-user',
              userId: 'target-user',
              value: JSON.stringify(rankedTargetStats),
            },
          ];
        }
        return [];
      });

      const payload = JSON.stringify({
        match_type: 'ranked',
        target_opponent_id: 'target-user',
        is_punch_up: true,
      });
      const result = rpcCreateMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.match.match_type).toBe('ranked');
      expect(parsed.match.is_punch_up).toBe(true);
      expect(parsed.punch_up_info).toBeDefined();
      expect(parsed.punch_up_info.is_punch_up).toBe(true);
      expect(parsed.punch_up_info.rank_difference).toBe(10);
    });

    it('should return error when player stats not found', () => {
      mockNk.storageRead = jest.fn(() => []);
      const payload = JSON.stringify({ match_type: 'ranked' });
      const result = rpcCreateMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Player stats not found');
    });

    it('should return validation error for invalid payload', () => {
      const payload = JSON.stringify({ match_type: 123 });
      const result = rpcCreateMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcAcceptMatch', () => {
    it('should accept pending match successfully', () => {
      const match = createMatch();
      const playerStats = {
        level: 5,
        xp: 500,
        stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 8 },
      };

      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: 'match_123', value: JSON.stringify(match) }];
        } else if (objects[0].collection === 'player_stats') {
          return [
            {
              collection: 'player_stats',
              key: 'test-user-123',
              value: JSON.stringify(playerStats),
            },
          ];
        }
        return [];
      });
      mockNk.storageWrite = jest.fn();

      const payload = JSON.stringify({ match_id: 'match_123' });
      const result = rpcAcceptMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.match.status).toBe('active');
      expect(parsed.match.opponent_id).toBe('test-user-123');
      expect(parsed.match.opponent_rank).toBe(63);
    });

    it('should return error when match not found', () => {
      mockNk.storageRead = jest.fn(() => []);
      const payload = JSON.stringify({ match_id: 'nonexistent' });
      const result = rpcAcceptMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Match not found');
    });

    it('should return error when user is the creator', () => {
      const match = createMatch({ creator_id: 'test-user-123' });
      mockNk.storageRead = jest.fn(() => [
        {
          collection: 'pvp_matches',
          key: 'match_123',
          value: JSON.stringify(match),
        },
      ]);

      const payload = JSON.stringify({ match_id: 'match_123' });
      const result = rpcAcceptMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Cannot accept your own match');
    });

    it('should return error when match not pending', () => {
      const match = createMatch({ status: 'completed' });
      mockNk.storageRead = jest.fn(() => [
        {
          collection: 'pvp_matches',
          key: 'match_123',
          value: JSON.stringify(match),
        },
      ]);

      const payload = JSON.stringify({ match_id: 'match_123' });
      const result = rpcAcceptMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Match is no longer available');
    });

    it('should return error when player stats not found', () => {
      const match = createMatch();
      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: 'match_123', value: JSON.stringify(match) }];
        }
        return [];
      });

      const payload = JSON.stringify({ match_id: 'match_123' });
      const result = rpcAcceptMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Player stats not found');
    });

    it('should return validation error for invalid payload', () => {
      const payload = JSON.stringify({ match_id: 123 });
      const result = rpcAcceptMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcListMatches', () => {
    it('should list pending matches excluding own', () => {
      const playerStats = {
        level: 5,
        xp: 500,
        stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 8 },
      };
      const now = Date.now();
      const matches = [
        createMatch({ match_id: 'match_1', creator_id: 'other1', created_at: now - 1000 }),
        createMatch({ match_id: 'match_2', creator_id: 'other2', created_at: now - 500 }),
        createMatch({ match_id: 'match_3', creator_id: 'test-user-123', created_at: now - 2000 }),
      ];

      mockNk.storageRead = jest.fn(() => [
        {
          collection: 'player_stats',
          key: 'test-user-123',
          value: JSON.stringify(playerStats),
        },
      ]);
      mockNk.storageList = jest.fn(() =>
        matches.map((m) => ({
          collection: 'pvp_matches',
          key: m.match_id,
          value: JSON.stringify(m),
        }))
      );

      const payload = JSON.stringify({});
      const result = rpcListMatches(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.matches).toHaveLength(2);
      expect(parsed.matches.map((m: any) => m.match_id)).toContain('match_1');
      expect(parsed.matches.map((m: any) => m.match_id)).toContain('match_2');
      expect(parsed.matches.map((m: any) => m.match_id)).not.toContain('match_3');
      expect(parsed.player_rank).toBeDefined();
      expect(parsed.total).toBe(2);
    });

    // Issue #902: list_matches must expose the canonical `power_rating`
    // field and keep `player_rank` as a deprecated alias for already-
    // shipped clients. Both fields must return the same value.
    it('should expose power_rating and keep player_rank as a deprecated alias (#902)', () => {
      const playerStats = {
        level: 5,
        xp: 500,
        stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 8 },
      };

      mockNk.storageRead = jest.fn(() => [
        {
          collection: 'player_stats',
          key: 'test-user-123',
          value: JSON.stringify(playerStats),
        },
      ]);
      mockNk.storageList = jest.fn(() => []);

      const result = rpcListMatches(mockCtx, mockLogger, mockNk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.power_rating).toBeDefined();
      expect(parsed.player_rank).toBeDefined();
      // Deprecated alias must return the same value as the canonical field
      expect(parsed.power_rating).toBe(parsed.player_rank);
    });

    it('should filter by match_type', () => {
      const playerStats = {
        level: 5,
        xp: 500,
        stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 8 },
      };
      const matches = [
        createMatch({ match_id: 'm1', match_type: 'ranked' }),
        createMatch({ match_id: 'm2', match_type: 'casual' }),
      ];

      mockNk.storageRead = jest.fn(() => [
        { collection: 'player_stats', key: 'test-user-123', value: JSON.stringify(playerStats) },
      ]);
      mockNk.storageList = jest.fn(() =>
        matches.map((m) => ({
          collection: 'pvp_matches',
          key: m.match_id,
          value: JSON.stringify(m),
        }))
      );

      const payload = JSON.stringify({ match_type: 'ranked' });
      const result = rpcListMatches(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.matches).toHaveLength(1);
      expect(parsed.matches[0].match_type).toBe('ranked');
    });

    it('should filter by min_rank and max_rank', () => {
      const playerStats = {
        level: 5,
        xp: 500,
        stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 8 },
      };
      const matches = [
        createMatch({ match_id: 'm1', creator_rank: 10 }),
        createMatch({ match_id: 'm2', creator_rank: 20 }),
        createMatch({ match_id: 'm3', creator_rank: 30 }),
      ];

      mockNk.storageRead = jest.fn(() => [
        { collection: 'player_stats', key: 'test-user-123', value: JSON.stringify(playerStats) },
      ]);
      mockNk.storageList = jest.fn(() =>
        matches.map((m) => ({
          collection: 'pvp_matches',
          key: m.match_id,
          value: JSON.stringify(m),
        }))
      );

      const payload = JSON.stringify({ min_rank: 15, max_rank: 25 });
      const result = rpcListMatches(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.matches).toHaveLength(1);
      expect(parsed.matches[0].match_id).toBe('m2');
    });

    it('should apply limit correctly', () => {
      const playerStats = {
        level: 5,
        xp: 500,
        stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 8 },
      };
      const matches = Array.from({ length: 5 }, (_, i) =>
        createMatch({ match_id: `m${i}`, created_at: Date.now() - i * 1000 })
      );

      mockNk.storageRead = jest.fn(() => [
        { collection: 'player_stats', key: 'test-user-123', value: JSON.stringify(playerStats) },
      ]);
      mockNk.storageList = jest.fn(() =>
        matches.map((m) => ({
          collection: 'pvp_matches',
          key: m.match_id,
          value: JSON.stringify(m),
        }))
      );

      const payload = JSON.stringify({ limit: 3 });
      const result = rpcListMatches(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.matches).toHaveLength(3);
    });

    it('should return error when player stats not found', () => {
      mockNk.storageRead = jest.fn(() => []);
      const payload = JSON.stringify({});
      const result = rpcListMatches(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Player stats not found');
    });

    it('should return validation error for invalid payload', () => {
      const payload = JSON.stringify({ limit: -1 });
      const result = rpcListMatches(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('calculateRank (Power Rating derivation)', () => {
    it('calculates rank correctly with base stats', () => {
      const stats = { attack: 20, defense: 15, dodge: 10, crit_rate: 8 };
      const rank = calculateRank({ level: 5, xp: 0, stats, user_id: 'test' });
      const expected = Math.floor(5 * 10 + (20 + 15 + 10 + 8) / 4);
      expect(rank).toBe(expected);
    });

    it('increases rank with level', () => {
      const stats = { attack: 10, defense: 10, dodge: 10, crit_rate: 10 };
      const rank1 = calculateRank({ level: 5, xp: 0, stats, user_id: 'test' });
      const rank2 = calculateRank({ level: 10, xp: 0, stats, user_id: 'test' });
      expect(rank2).toBeGreaterThan(rank1);
    });

    it('increases rank with stats', () => {
      const baseStats = { attack: 10, defense: 10, dodge: 10, crit_rate: 10 };
      const highStats = { attack: 30, defense: 30, dodge: 30, crit_rate: 30 };
      const rank1 = calculateRank({ level: 5, xp: 0, stats: baseStats, user_id: 'test' });
      const rank2 = calculateRank({ level: 5, xp: 0, stats: highStats, user_id: 'test' });
      expect(rank2).toBeGreaterThan(rank1);
    });

    it('handles zero stats', () => {
      const stats = { attack: 0, defense: 0, dodge: 0, crit_rate: 0 };
      const rank = calculateRank({ level: 1, xp: 0, stats, user_id: 'test' });
      expect(rank).toBe(10);
    });
  });

  describe('generateMatchId', () => {
    it('generates unique match IDs', () => {
      const id1 = generateMatchId();
      const id2 = generateMatchId();
      expect(id1).not.toBe(id2);
    });

    it('starts with match_ prefix', () => {
      const id = generateMatchId();
      expect(id.startsWith('match_')).toBe(true);
    });

    it('contains timestamp', () => {
      const id = generateMatchId();
      const parts = id.split('_');
      expect(parts.length).toBeGreaterThanOrEqual(2);
      expect(Number(parts[1])).toBeGreaterThan(0);
    });
  });

  describe('rpcCompleteMatch', () => {
    const createActiveMatch = (overrides = {}): PvPMatch => ({
      match_id: 'match_completion_test',
      creator_id: 'test-user-123',
      opponent_id: 'opponent-user',
      creator_rank: 1200,
      opponent_rank: 1150,
      match_type: 'ranked',
      is_punch_up: false,
      status: 'active',
      created_at: Date.now() - 10000,
      updated_at: Date.now() - 10000,
      expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
      last_turn_timestamp: Date.now() - 10000,
      current_turn: 1,
      current_player: 'test-user-123',
      turn_time_limit_ms: 30000,
      creator_health: 100,
      opponent_health: 100,
      max_turns: 10,
      creator_consecutive_timeouts: 0,
      opponent_consecutive_timeouts: 0,
      ...overrides,
    });

    /**
     * Installs a stateful storage mock so settlement writes become visible
     * to subsequent reads (needed for double-settlement idempotency tests).
     */
    const installStatefulStorage = (match: PvPMatch, combatState?: Record<string, unknown>) => {
      const stored: Record<string, string> = {
        [`pvp_matches:${match.match_id}`]: JSON.stringify(match),
      };
      if (combatState) {
        stored[`pvp_match_states:${match.match_id}`] = JSON.stringify(combatState);
      }
      mockNk.storageRead = jest.fn((objects: any[]) =>
        objects
          .map((o) => {
            const value = stored[`${o.collection}:${o.key}`];
            return value ? { collection: o.collection, key: o.key, value } : null;
          })
          .filter(Boolean)
      );
      mockNk.storageWrite = jest.fn((writes: any[]) => {
        writes.forEach((w) => {
          stored[`${w.collection}:${w.key}`] = w.value;
        });
        return writes.map((w) => ({ key: w.key, version: '2' }));
      });
      return stored;
    };

    beforeEach(() => {
      jest.clearAllMocks();
      (isPlayerFlagged as jest.Mock).mockReturnValue(false);
      (getFlagReason as jest.Mock).mockReturnValue('No reason');
      (getCurrentSeason as jest.Mock).mockReturnValue({
        season_id: 'season_1',
        start_time: 0,
        end_time: Date.now() + 86400000,
      });
      (getLeaderboardEntry as jest.Mock).mockReturnValue(null);
      (applyEloUpdates as jest.Mock).mockReturnValue({ winnerNewElo: 1210, loserNewElo: 1140 });
      (recordPlayerActivity as jest.Mock).mockImplementation();
      (logAudit as jest.Mock).mockImplementation();
      (recordMatchResult as jest.Mock).mockImplementation();
    });

    it('should settle a ranked match from server health-zero state', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.match.status).toBe('completed');
      expect(parsed.winner.user_id).toBe('test-user-123');
      expect(parsed.loser.user_id).toBe('opponent-user');
      expect(parsed.end_reason).toBe('health_zero');
      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should settle server truth when client-asserted winner disagrees with state', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);

      // Client falsely asserts the opponent won; server state says the
      // creator (test-user-123) reduced the opponent to zero health.
      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'opponent-user',
        loser_id: 'test-user-123',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.winner.user_id).toBe('test-user-123');
      expect(parsed.loser.user_id).toBe('opponent-user');
      // Advisory mismatch is logged for telemetry, never honored
      expect(logAudit).toHaveBeenCalledWith(
        mockNk,
        mockCtx.userId,
        mockCtx.ipAddress ?? null,
        'complete_match',
        'pvp_matches',
        expect.objectContaining({
          match_id: match.match_id,
          client_asserted_winner_id: 'opponent-user',
          server_declared_winner_id: 'test-user-123',
        }),
        'failure',
        'advisory_winner_mismatch'
      );
    });

    it('should ignore advisory non-participant winner and settle server truth', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'non-participant',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.winner.user_id).toBe('test-user-123');
    });

    it('should settle with no payload winner/loser at all (pure trigger)', () => {
      const match = createActiveMatch({ creator_health: 0 });
      installStatefulStorage(match);

      const payload = JSON.stringify({ match_id: match.match_id });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.winner.user_id).toBe('opponent-user');
      expect(parsed.loser.user_id).toBe('test-user-123');
    });

    it('should return explicit error when no server-side terminal state exists', () => {
      const match = createActiveMatch(); // both players at full health, no winner
      installStatefulStorage(match);

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('NO_SERVER_TERMINAL_STATE');
      expect(parsed.error).toContain('no server-side terminal state');
      expect(logAudit).toHaveBeenCalledWith(
        mockNk,
        mockCtx.userId,
        mockCtx.ipAddress ?? null,
        'complete_match',
        'pvp_matches',
        expect.objectContaining({ match_id: match.match_id }),
        'failure',
        'no_server_terminal_state'
      );
    });

    it('should be idempotent on double settlement', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const first = JSON.parse(rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload));
      expect(first.success).toBe(true);
      expect(first.already_settled).toBeUndefined();
      expect(applyEloUpdates).toHaveBeenCalledTimes(1);

      // Advance past the 30s match-completion cooldown so the replayed
      // trigger reaches the settlement idempotency path
      const realNow = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => realNow + 120000);

      const second = JSON.parse(rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload));
      nowSpy.mockRestore();

      expect(second.success).toBe(true);
      expect(second.already_settled).toBe(true);
      expect(second.winner).toBe('test-user-123');
      // No re-application of Elo/XP/rewards on the replay
      expect(applyEloUpdates).toHaveBeenCalledTimes(1);
      expect(recordMatchResult).toHaveBeenCalledTimes(2); // once per player, first call only
    });

    it('awards match coins to the unified player_currency ledger (issue #860)', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      const stored = installStatefulStorage(match);

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const result = JSON.parse(rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);

      // Ranked win = 50 coins, ranked loss = 10 coins. Coins land in the
      // ledger `coins` field (canonical "Coins" currency, renamed from
      // `gold` in #866) — not in the write-only Nakama wallet.
      const winnerCurrency = JSON.parse(stored['player_currency:test-user-123']);
      expect(winnerCurrency.coins).toBe(50);
      expect(winnerCurrency.gems).toBe(0);

      const loserCurrency = JSON.parse(stored['player_currency:opponent-user']);
      expect(loserCurrency.coins).toBe(10);
      expect(loserCurrency.gems).toBe(0);

      expect(mockNk.walletUpdate).not.toHaveBeenCalled();

      // Idempotent replay must not double-award currency
      const realNow = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => realNow + 120000);
      rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      nowSpy.mockRestore();

      const winnerAfterReplay = JSON.parse(stored['player_currency:test-user-123']);
      expect(winnerAfterReplay.coins).toBe(50);
    });

    describe('punch-up loss settlement (issue #864)', () => {
      beforeEach(() => {
        resetPunchUpWatchState();
      });

      /**
       * Active ranked punch-up: creator test-user-123 (rank 25) is the
       * underdog, opponent-user (rank 35) the favorite.
       */
      const createPunchUpMatch = (overrides = {}): PvPMatch =>
        createActiveMatch({
          creator_rank: 25,
          opponent_rank: 35,
          is_punch_up: true,
          ...overrides,
        });

      it('amplifies the underdog punch-up loss (2x K-factor) via server-derived underdog flag', () => {
        // Underdog (creator) at zero health: favorite wins the punch-up
        const match = createPunchUpMatch({ creator_health: 0 });
        installStatefulStorage(match);

        const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, JSON.stringify({
          match_id: match.match_id,
        }));
        const parsed = JSON.parse(result);

        expect(parsed.success).toBe(true);
        expect(parsed.winner.user_id).toBe('opponent-user');
        expect(parsed.loser.user_id).toBe('test-user-123');

        // applyEloUpdates receives the server-derived underdog flag so the
        // loser's deduction runs at 2x the punch-up K-factor
        const eloCall = (applyEloUpdates as jest.Mock).mock.calls[0];
        expect(eloCall[3]).toBe('opponent-user'); // winner (server-declared)
        expect(eloCall[4]).toBe('test-user-123'); // loser = underdog
        expect(eloCall[7]).toBe(true); // isPunchUp from server match record
        expect(eloCall[10]).toBe(true); // loserIsUnderdog -> amplified 2x K

        // Fairness telemetry emits the punch-up loss event for LC-T3 review
        const telemetryWrite = (mockNk.storageWrite as jest.Mock).mock.calls
          .map((call: any[]) => call[0])
          .flat()
          .find((w: any) => w.collection === 'fairness_punch_up_losses');
        expect(telemetryWrite).toBeTruthy();
        const event = JSON.parse(telemetryWrite.value);
        expect(event.match_id).toBe(match.match_id);
        expect(event.loser_id).toBe('test-user-123');
        expect(event.winner_id).toBe('opponent-user');
        expect(event.amplified).toBe(true);
        expect(event.winner_k_factor).toBe(50);
        expect(event.loser_k_factor).toBe(100);
        expect(event.loser_xp_gained).toBe(13);
        expect(event.watch.flagged).toBe(false);
      });

      it('keeps punch-up loss XP strictly positive and reduced', () => {
        const match = createPunchUpMatch({ creator_health: 0 });
        installStatefulStorage(match);

        const parsed = JSON.parse(
          rpcCompleteMatch(mockCtx, mockLogger, mockNk, JSON.stringify({ match_id: match.match_id }))
        );

        // Ranked loss base XP 25 reduced by the punch-up loss factor (0.5):
        // round(25 * 0.5) = 13 — reduced vs the old multiplied grant and vs
        // a normal loss, never zero or negative.
        expect(parsed.loser.xp_gained).toBe(13);
        expect(parsed.loser.xp_gained).toBeGreaterThan(0);
        // Issue #902: the favorite reward penalty was removed. The
        // favorite's consequence is the 2x K-factor on Ladder Rating
        // (issue #864), not an XP multiplier. Favorites in punch-up wins
        // now receive the full ranked-win XP grant (100).
        expect(parsed.winner.xp_gained).toBe(100);
        // XP reward entry matches the granted amount
        const loserXPReward = parsed.loser.rewards.find((r: any) => r.type === 'xp');
        expect(loserXPReward.quantity).toBe(13);
      });

      it('does not amplify when the favorite loses the punch-up (upset)', () => {
        // Favorite (opponent, rank 35) at zero health: underdog wins
        const match = createPunchUpMatch({ opponent_health: 0 });
        installStatefulStorage(match);

        const parsed = JSON.parse(
          rpcCompleteMatch(mockCtx, mockLogger, mockNk, JSON.stringify({ match_id: match.match_id }))
        );

        expect(parsed.winner.user_id).toBe('test-user-123');
        expect(parsed.loser.user_id).toBe('opponent-user');

        const eloCall = (applyEloUpdates as jest.Mock).mock.calls[0];
        expect(eloCall[7]).toBe(true); // isPunchUp
        expect(eloCall[10]).toBe(false); // loser is the favorite: NOT amplified
        // Issue #902: favorite XP penalty removed. Favorites who lose a
        // punch-up now receive the full ranked-loss base XP (25), and the
        // only consequence is the 2x K-factor on Ladder Rating (issue
        // #864) on the WINner's side, which is asserted via applyEloUpdates.
        expect(parsed.loser.xp_gained).toBe(25);
        expect(parsed.loser.xp_gained).toBeGreaterThan(0);
      });

      it('does not amplify or reduce XP on non-punch-up losses', () => {
        const match = createActiveMatch({ opponent_health: 0 }); // winner = creator
        installStatefulStorage(match);

        const parsed = JSON.parse(
          rpcCompleteMatch(mockCtx, mockLogger, mockNk, JSON.stringify({ match_id: match.match_id }))
        );

        const eloCall = (applyEloUpdates as jest.Mock).mock.calls[0];
        expect(eloCall[7]).toBe(false); // not a punch-up
        expect(eloCall[10]).toBe(false);
        // Normal ranked loss XP unchanged
        expect(parsed.loser.xp_gained).toBe(25);
      });

      it('keeps underdog punch-up loss XP strictly positive across punch-up rank differences', () => {
        for (const [creatorRank, opponentRank] of [
          [25, 30], // diff 5 (low)
          [25, 40], // diff 15 (high)
        ] as Array<[number, number]>) {
          // Reset per-iteration: match-completion cooldown + watch history
          resetRateLimiting();
          initializeRateLimiting();
          resetPunchUpWatchState();
          jest.clearAllMocks();
          (isPlayerFlagged as jest.Mock).mockReturnValue(false);
          (getCurrentSeason as jest.Mock).mockReturnValue({
            season_id: 'season_1',
            start_time: 0,
            end_time: Date.now() + 86400000,
          });
          (getLeaderboardEntry as jest.Mock).mockReturnValue(null);
          (applyEloUpdates as jest.Mock).mockReturnValue({ winnerNewElo: 1210, loserNewElo: 1140 });
          (recordPlayerActivity as jest.Mock).mockImplementation();
          (logAudit as jest.Mock).mockImplementation();
          (recordMatchResult as jest.Mock).mockImplementation();

          const match = createPunchUpMatch({
            creator_rank: creatorRank,
            opponent_rank: opponentRank,
            creator_health: 0,
            match_id: `match_punchup_diff_${opponentRank - creatorRank}`,
          });
          installStatefulStorage(match);

          const parsed = JSON.parse(
            rpcCompleteMatch(
              mockCtx,
              mockLogger,
              mockNk,
              JSON.stringify({ match_id: match.match_id })
            )
          );

          expect(parsed.success).toBe(true);
          expect(parsed.loser.xp_gained).toBeGreaterThan(0);
          expect(parsed.loser.xp_gained).toBe(13);
        }
      });
    });

    it('should settle from combat system MatchState winner with forfeit reason', () => {
      const match = createActiveMatch(); // match-level health not terminal
      installStatefulStorage(match, {
        match_id: match.match_id,
        status: 'completed',
        winner: 'opponent-user',
        forfeit_reason: 'rage_quit',
        creator_health: 100,
        opponent_health: 100,
      });

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123', // client falsely claims self as winner
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.winner.user_id).toBe('opponent-user');
      expect(parsed.loser.user_id).toBe('test-user-123');
      expect(parsed.end_reason).toBe('forfeit');
    });

    it('should map combat system timeout to end_reason timeout', () => {
      const match = createActiveMatch();
      installStatefulStorage(match, {
        match_id: match.match_id,
        status: 'completed',
        winner: 'opponent-user',
        forfeit_reason: 'timeout',
        creator_health: 100,
        opponent_health: 100,
      });

      const payload = JSON.stringify({ match_id: match.match_id });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.winner.user_id).toBe('opponent-user');
      expect(parsed.end_reason).toBe('timeout');
    });

    it('should settle from health-zero recorded only in combat MatchState', () => {
      const match = createActiveMatch(); // match-level health full
      installStatefulStorage(match, {
        match_id: match.match_id,
        status: 'active',
        creator_health: 100,
        opponent_health: 0, // combat state shows opponent defeated
      });

      const payload = JSON.stringify({ match_id: match.match_id });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.winner.user_id).toBe('test-user-123');
      expect(parsed.end_reason).toBe('health_zero');
    });

    it('should settle a combat-declared winner on a completed-but-unsettled match', () => {
      // Hybrid duel model: combat system declares the winner (status
      // completed + winner set) without settling; the client trigger settles.
      const match = createActiveMatch({
        status: 'completed',
        winner: 'opponent-user',
        end_reason: 'health_zero',
      });
      installStatefulStorage(match);

      const payload = JSON.stringify({ match_id: match.match_id });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.winner.user_id).toBe('opponent-user');
      expect(parsed.end_reason).toBe('health_zero');
    });

    it('should settle a max-turns draw without Elo or rewards', () => {
      const match = createActiveMatch({
        current_turn: 10,
        max_turns: 10,
        creator_health: 50,
        opponent_health: 50,
      });
      installStatefulStorage(match);

      const payload = JSON.stringify({ match_id: match.match_id });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.is_draw).toBe(true);
      expect(parsed.end_reason).toBe('draw');
      expect(applyEloUpdates).not.toHaveBeenCalled();
    });

    it('should settle a max-turns winner by remaining health', () => {
      const match = createActiveMatch({
        current_turn: 10,
        max_turns: 10,
        creator_health: 80,
        opponent_health: 30,
      });
      installStatefulStorage(match);

      const payload = JSON.stringify({ match_id: match.match_id });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.winner.user_id).toBe('test-user-123');
      expect(parsed.end_reason).toBe('max_turns');
    });

    it('should return error when winner (server-derived) is flagged', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);
      (isPlayerFlagged as jest.Mock).mockReturnValue(true);
      (getFlagReason as jest.Mock).mockReturnValue('Suspicious activity');

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('PLAYER_FLAGGED');
      expect(parsed.error).toContain('flagged for review');
    });

    it('should return error when loser (server-derived) is flagged', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);
      (isPlayerFlagged as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
      (getFlagReason as jest.Mock).mockReturnValue('Suspicious activity');

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('PLAYER_FLAGGED');
      expect(parsed.error).toContain('Opponent is flagged');
    });

    it('should return error when match not found', () => {
      mockNk.storageRead = jest.fn(() => []);

      const payload = JSON.stringify({
        match_id: 'non_existent_match',
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match not found');
    });

    it('should return error when match is not active', () => {
      const match = createActiveMatch({ status: 'pending' });
      installStatefulStorage(match);

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match is not active');
    });

    it('should return error when user is not authorized', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);

      // Create a context with a different user
      const otherCtx = { ...mockCtx, userId: 'unauthorized-user' };

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(otherCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Not authorized to complete this match');
    });

    it('should return validation error for invalid payload', () => {
      const payload = JSON.stringify({ match_id: 123 });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should complete a casual match without rank changes', () => {
      const match = createActiveMatch({ match_type: 'casual', opponent_health: 0 });
      installStatefulStorage(match);

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.match.status).toBe('completed');
      // For casual matches, rank changes should be 0
      expect(parsed.winner.rank_change).toBe(0);
      expect(parsed.loser.rank_change).toBe(0);
    });

    it('should use existing leaderboard entry for ranked matches', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      (getLeaderboardEntry as jest.Mock).mockReturnValue({ score: 1250 });
      installStatefulStorage(match);

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(getLeaderboardEntry).toHaveBeenCalled();
      expect(parsed.success).toBe(true);
    });

    it('should use server-recorded is_punch_up and ignore client claim', () => {
      const match = createActiveMatch({ is_punch_up: false, opponent_health: 0 });
      installStatefulStorage(match);

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
        is_punch_up: true, // client tries to amplify rewards
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      // Server-recorded flag wins; client-asserted punch-up is not honored
      expect(parsed.is_punch_up).toBe(false);
    });

    it('should not apply rank decay at settlement — decay is Ladder-Rating-read-only (issue #865)', () => {
      // Inactivity decay applies when the Ladder Rating is read
      // (season_leaderboard), never at settlement: both participants just
      // played, and their activity is recorded during settlement. The former
      // applyMatchRankDecay call was provably inert and is removed.
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(applyRankDecay).not.toHaveBeenCalled();
      expect(parsed.success).toBe(true);
      // new_rank must be the pure Elo result from applyEloUpdates (mocked),
      // not reduced by any inactivity adjustment.
      expect(parsed.winner.new_rank).toBe(1210);
      expect(parsed.loser.new_rank).toBe(1140);
    });

    it('should record player activity after match completion', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);

      expect(recordPlayerActivity).toHaveBeenCalledWith(mockNk, 'test-user-123');
      expect(recordPlayerActivity).toHaveBeenCalledWith(mockNk, 'opponent-user');
    });

    it('should record match result for anti-cheat analysis', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);

      expect(recordMatchResult).toHaveBeenCalledTimes(2);
    });

    it('should log audit event on match completion', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);

      expect(logAudit).toHaveBeenCalledWith(
        mockNk,
        mockCtx.userId,
        mockCtx.ipAddress ?? null,
        'complete_match',
        'pvp_matches',
        expect.objectContaining({ match_id: match.match_id }),
        'success'
      );
    });
  });

  describe('registerRpc functions', () => {
    it('should register rpc handlers on initializer', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      };

      registerRpcListMatches(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/list_matches',
        rpcListMatches
      );

      registerRpcCreateMatch(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/create_match',
        rpcCreateMatch
      );

      registerRpcAcceptMatch(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/accept_match',
        rpcAcceptMatch
      );

      // get_player_rank is registered solely by season_leaderboard's
      // consolidated handler (issue #871) — matchmaker no longer registers
      // a duplicate under the same RPC ID.

      registerRpcCompleteMatch(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/complete_match',
        rpcCompleteMatch
      );
    });
  });


  // ==================== LEGACY DUEL RPC DECOMMISSION (issue #903) ====================
  // The correspondence-style duel engine RPCs (submit_turn,
  // get_async_match_state, forfeit_match) and their correspondence-era
  // constants (TURN_TIMEOUT_MS = 24h, MAX_CONSECUTIVE_TIMEOUTS,
  // DEFAULT_MAX_TURNS, BASE_HEALTH, ACTIVE_MATCH_EXPIRY_MS) were removed
  // from the matchmaker module. The shipped hybrid duel model uses
  // submit_combat_action / get_match_state in combat_system.ts instead.

  describe('Legacy Duel RPC Decommission (issue #903)', () => {
    const legacyRpcs = [
      'armored_archer/submit_turn',
      'armored_archer/get_async_match_state',
      'armored_archer/forfeit_match',
    ];

    it.each(legacyRpcs)(
      'does not register legacy RPC %s',
      (rpcName) => {
        // Matchmaker.ts must not export a register* function for these
        // legacy RPCs, and index.ts must not register them on the
        // initializer. Verifying the named export is absent is the
        // strictest signal that the decommission is complete.
        const matchmakerModule = require('../matchmaker');
        const expectedRegisterName = `registerRpc${rpcName
          .split('/')
          .pop()
          ?.replace(/^./, (c: string) => c.toUpperCase())
          .replace(/_([a-z])/g, (_m: string, g: string) => g.toUpperCase())}`;
        expect(matchmakerModule[expectedRegisterName]).toBeUndefined();
      }
    );
  });

  describe('Punch-up Mechanics', () => {
    describe('isPunchUpMatch', () => {
      it('should detect punch-up with minimum rank difference', () => {
        const result = isPunchUpMatch(25, 30, 'player1', 'player2');

        expect(result.is_punch_up).toBe(true);
        expect(result.rank_difference).toBe(5);
        expect(result.underdog_rank).toBe(25);
        expect(result.favorite_rank).toBe(30);
        expect(result.underdog_id).toBe('player1');
        expect(result.reward_multiplier).toBeGreaterThan(1.0);
      });

      it('should detect punch-up with maximum rank difference', () => {
        const result = isPunchUpMatch(25, 40, 'player1', 'player2');

        expect(result.is_punch_up).toBe(true);
        expect(result.rank_difference).toBe(15);
        expect(result.reward_multiplier).toBe(2.0);
      });

      it('should not detect punch-up with rank difference below threshold', () => {
        const result = isPunchUpMatch(25, 29, 'player1', 'player2');

        expect(result.is_punch_up).toBe(false);
        expect(result.reward_multiplier).toBe(1.0);
      });

      it('should not detect punch-up with rank difference above maximum', () => {
        const result = isPunchUpMatch(25, 41, 'player1', 'player2');

        expect(result.is_punch_up).toBe(false);
        expect(result.reward_multiplier).toBe(1.0);
      });

      it('should not detect punch-up when both players are below minimum rank', () => {
        const result = isPunchUpMatch(15, 20, 'player1', 'player2');

        expect(result.is_punch_up).toBe(false);
        expect(result.reward_multiplier).toBe(1.0);
      });

      it('should correctly identify underdog and favorite', () => {
        // Note: variable names are intentionally misleading - 'high_ranker' has rank 30,
        // 'low_ranker' has rank 40, so 'high_ranker' is actually the underdog
        const result = isPunchUpMatch(30, 40, 'high_ranker', 'low_ranker');

        expect(result.is_punch_up).toBe(true);
        expect(result.underdog_id).toBe('high_ranker'); // The player with rank 30
        expect(result.underdog_rank).toBe(30);
        expect(result.favorite_rank).toBe(40);
      });

      it('should scale reward multiplier with rank difference', () => {
        const smallDiff = isPunchUpMatch(25, 30, 'p1', 'p2');
        const mediumDiff = isPunchUpMatch(25, 35, 'p1', 'p2');
        const largeDiff = isPunchUpMatch(25, 40, 'p1', 'p2');

        expect(smallDiff.reward_multiplier).toBeLessThan(mediumDiff.reward_multiplier);
        expect(mediumDiff.reward_multiplier).toBeLessThan(largeDiff.reward_multiplier);
      });
    });

    describe('calculatePunchUpGemBonus', () => {
      it('should return minimum gems for smallest punch-up', () => {
        const bonus = calculatePunchUpGemBonus(5);
        expect(bonus).toBe(3);
      });

      it('should return maximum gems for largest punch-up', () => {
        const bonus = calculatePunchUpGemBonus(15);
        expect(bonus).toBe(10);
      });

      it('should scale gem bonus with rank difference', () => {
        const smallBonus = calculatePunchUpGemBonus(5);
        const mediumBonus = calculatePunchUpGemBonus(10);
        const largeBonus = calculatePunchUpGemBonus(15);

        expect(smallBonus).toBeLessThan(mediumBonus);
        expect(mediumBonus).toBeLessThan(largeBonus);
      });
    });

    describe('generatePunchUpDescription', () => {
      it('should generate description for slight punch-up', () => {
        const info: PunchUpInfo = {
          is_punch_up: true,
          rank_difference: 6,
          underdog_rank: 25,
          favorite_rank: 31,
          underdog_id: 'player1',
          reward_multiplier: 1.25,
        };

        const description = generatePunchUpDescription(info);
        expect(description).toContain('slight difference of 6 ranks');
        expect(description).toContain('1.3x XP bonus'); // Formatted to 1 decimal place
      });

      it('should generate description for extreme punch-up', () => {
        const info: PunchUpInfo = {
          is_punch_up: true,
          rank_difference: 15,
          underdog_rank: 25,
          favorite_rank: 40,
          underdog_id: 'player1',
          reward_multiplier: 2.0,
        };

        const description = generatePunchUpDescription(info);
        expect(description).toContain('extreme difference of 15 ranks');
        expect(description).toContain('2.0x XP bonus');
        expect(description).toContain('10 bonus gems');
      });

      it('should describe the ratified punch-up consequence (issue #864/#902)', () => {
        const info: PunchUpInfo = {
          is_punch_up: true,
          rank_difference: 10,
          underdog_rank: 25,
          favorite_rank: 35,
          underdog_id: 'player1',
          reward_multiplier: 1.6,
        };

        const description = generatePunchUpDescription(info);
        // Issue #902: description must reference the ratified consequence
        // (2x K-factor on Ladder Rating) and must NOT mention the historic
        // "Favorites receive reduced rewards" reward-penalty heuristic.
        expect(description).toContain('2x K-factor');
        expect(description).not.toContain('Favorites receive reduced rewards');
      });
    });
  });

  describe('rpcGetMatchHistory', () => {
    it('should return match history from database', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      const matchRows = [
        {
          match_id: 'match_1',
          match_type: 'ranked',
          is_punch_up: false,
          creator_id: 'test-user',
          opponent_id: 'opponent1',
          winner_id: 'test-user',
          loser_id: 'opponent1',
          creator_rank: 100,
          opponent_rank: 95,
          total_turns: 5,
          duration_seconds: 120,
          end_reason: 'health_zero',
          created_at: new Date('2024-01-15').toISOString(),
          updated_at: new Date('2024-01-15').toISOString(),
          creator_health_remaining: 50,
          opponent_health_remaining: 0,
        },
      ];

      (nk.dbQuery as jest.Mock).mockReturnValueOnce([{ total: 1 }]).mockReturnValueOnce(matchRows);

      const result = rpcGetMatchHistory(ctx, logger, nk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.matches).toHaveLength(1);
      expect(parsed.total).toBe(1);
      expect(parsed.stats.wins).toBe(1);
      expect(parsed.stats.losses).toBe(0);
      expect(parsed.matches[0].is_victory).toBe(true);
      expect(parsed.matches[0].player_rank).toBe(100);
      expect(parsed.matches[0].opponent_rank_calculated).toBe(95);
    });

    it('should filter by match_type', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      (nk.dbQuery as jest.Mock).mockReturnValueOnce([{ total: 0 }]).mockReturnValueOnce([]);

      const result = rpcGetMatchHistory(ctx, logger, nk, JSON.stringify({ match_type: 'ranked' }));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.matches).toHaveLength(0);
    });

    it('should return validation error for invalid payload', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      const result = rpcGetMatchHistory(ctx, logger, nk, JSON.stringify({ match_type: 'invalid' }));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it('should handle database errors gracefully', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      (nk.dbQuery as jest.Mock).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = rpcGetMatchHistory(ctx, logger, nk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Failed to retrieve match history');
    });

    it('should identify losses correctly when opponent wins', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      const matchRows = [
        {
          match_id: 'match_2',
          match_type: 'ranked',
          is_punch_up: false,
          creator_id: 'opponent1',
          opponent_id: 'test-user',
          winner_id: 'opponent1',
          loser_id: 'test-user',
          creator_rank: 95,
          opponent_rank: 100,
          total_turns: 3,
          duration_seconds: 60,
          end_reason: 'health_zero',
          created_at: new Date('2024-01-15').toISOString(),
          updated_at: new Date('2024-01-15').toISOString(),
          creator_health_remaining: 30,
          opponent_health_remaining: 0,
        },
      ];

      (nk.dbQuery as jest.Mock).mockReturnValueOnce([{ total: 1 }]).mockReturnValueOnce(matchRows);

      const result = rpcGetMatchHistory(ctx, logger, nk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.matches[0].is_victory).toBe(false);
      expect(parsed.stats.losses).toBe(1);
      expect(parsed.matches[0].player_rank).toBe(100);
      expect(parsed.matches[0].player_health_remaining).toBe(0);
    });

    it('should apply date range filters', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      (nk.dbQuery as jest.Mock).mockReturnValueOnce([{ total: 0 }]).mockReturnValueOnce([]);

      const result = rpcGetMatchHistory(
        ctx,
        logger,
        nk,
        JSON.stringify({ start_date: '2024-01-01', end_date: '2024-01-31' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });
  });

  describe('rpcGetMatchDetails', () => {
    it('should return match details with combat log', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      const matchRow = {
        match_id: 'match_detail_1',
        result_id: 'result_1',
        creator_id: 'test-user',
        opponent_id: 'opponent1',
        creator_username: 'TestPlayer',
        opponent_username: 'Opponent1',
        winner_id: 'test-user',
        loser_id: 'opponent1',
        match_type: 'ranked',
        is_punch_up: false,
        creator_rank: 100,
        opponent_rank: 95,
        creator_old_elo: 1000,
        creator_new_elo: 1020,
        opponent_old_elo: 1000,
        opponent_new_elo: 980,
        total_turns: 5,
        duration_seconds: 120,
        end_reason: 'health_zero',
        combat_log: JSON.stringify([{ turn: 1, action: 'attack', damage: 20 }]),
        creator_health_remaining: 50,
        opponent_health_remaining: 0,
        creator_stats_at_match: JSON.stringify({ level: 10, strength: 5 }),
        opponent_stats_at_match: JSON.stringify({ level: 8, strength: 4 }),
        season_id: 'season_1',
        created_at: new Date('2024-01-15').toISOString(),
        updated_at: new Date('2024-01-15').toISOString(),
      };

      (nk.dbQuery as jest.Mock).mockReturnValue([matchRow]);

      const result = rpcGetMatchDetails(
        ctx,
        logger,
        nk,
        JSON.stringify({ match_id: 'match_detail_1' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.match.match_id).toBe('match_detail_1');
      expect(parsed.match.creator_username).toBe('TestPlayer');
      expect(parsed.match.combat_log).toEqual([{ turn: 1, action: 'attack', damage: 20 }]);
      expect(parsed.match.creator_stats_at_match).toEqual({ level: 10, strength: 5 });
    });

    it('should return error when match not found', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      (nk.dbQuery as jest.Mock).mockReturnValue([]);

      const result = rpcGetMatchDetails(
        ctx,
        logger,
        nk,
        JSON.stringify({ match_id: 'nonexistent' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Match not found');
    });

    it('should return validation error for invalid payload', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      const result = rpcGetMatchDetails(ctx, logger, nk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it('should handle database errors gracefully', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      (nk.dbQuery as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = rpcGetMatchDetails(ctx, logger, nk, JSON.stringify({ match_id: 'match_1' }));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Failed to retrieve match details');
    });

    it('should handle unparsable combat_log gracefully', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      const matchRow = {
        match_id: 'match_detail_2',
        result_id: 'result_2',
        creator_id: 'test-user',
        opponent_id: 'opponent1',
        creator_username: 'TestPlayer',
        opponent_username: 'Opponent1',
        winner_id: 'test-user',
        loser_id: 'opponent1',
        match_type: 'ranked',
        is_punch_up: false,
        creator_rank: 100,
        opponent_rank: 95,
        creator_old_elo: 1000,
        creator_new_elo: 1020,
        opponent_old_elo: 1000,
        opponent_new_elo: 980,
        total_turns: 5,
        duration_seconds: 120,
        end_reason: 'health_zero',
        combat_log: 'invalid-json{{{',
        creator_health_remaining: 50,
        opponent_health_remaining: 0,
        creator_stats_at_match: null,
        opponent_stats_at_match: null,
        season_id: 'season_1',
        created_at: new Date('2024-01-15').toISOString(),
        updated_at: new Date('2024-01-15').toISOString(),
      };

      (nk.dbQuery as jest.Mock).mockReturnValue([matchRow]);

      const result = rpcGetMatchDetails(
        ctx,
        logger,
        nk,
        JSON.stringify({ match_id: 'match_detail_2' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.match.combat_log).toEqual([]);
    });
  });

  describe('rpcAdminQueryMatches', () => {
    it('should query matches with no filters', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      const matchRows = [
        {
          match_id: 'admin_match_1',
          match_type: 'ranked',
          is_punch_up: false,
          creator_id: 'player1',
          opponent_id: 'player2',
          creator_username: 'Player1',
          opponent_username: 'Player2',
          winner_id: 'player1',
          loser_id: 'player2',
          creator_rank: 100,
          opponent_rank: 95,
          total_turns: 5,
          duration_seconds: 120,
          end_reason: 'health_zero',
          created_at: new Date('2024-01-15').toISOString(),
          updated_at: new Date('2024-01-15').toISOString(),
          creator_health_remaining: 50,
          opponent_health_remaining: 0,
          season_id: 'season_1',
        },
      ];

      (nk.dbQuery as jest.Mock).mockReturnValueOnce([{ total: 1 }]).mockReturnValueOnce(matchRows);

      const result = rpcAdminQueryMatches(ctx, logger, nk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.matches).toHaveLength(1);
      expect(parsed.total).toBe(1);
      expect(parsed.page).toBe(1);
      expect(parsed.total_pages).toBe(1);
      expect(parsed.matches[0].creator_username).toBe('Player1');
    });

    it('should filter by user_id', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      (nk.dbQuery as jest.Mock).mockReturnValueOnce([{ total: 0 }]).mockReturnValueOnce([]);

      const result = rpcAdminQueryMatches(ctx, logger, nk, JSON.stringify({ user_id: 'player1' }));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.matches).toHaveLength(0);
    });

    it('should filter by match_type and end_reason', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      (nk.dbQuery as jest.Mock).mockReturnValueOnce([{ total: 0 }]).mockReturnValueOnce([]);

      const result = rpcAdminQueryMatches(
        ctx,
        logger,
        nk,
        JSON.stringify({ match_type: 'ranked', end_reason: 'health_zero' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    it('should filter by is_punch_up and season_id', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      (nk.dbQuery as jest.Mock).mockReturnValueOnce([{ total: 0 }]).mockReturnValueOnce([]);

      const result = rpcAdminQueryMatches(
        ctx,
        logger,
        nk,
        JSON.stringify({ is_punch_up: true, season_id: 'season_1' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    it('should return validation error for invalid payload', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      const result = rpcAdminQueryMatches(
        ctx,
        logger,
        nk,
        JSON.stringify({ match_type: 'invalid' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it('should handle database errors gracefully', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      (nk.dbQuery as jest.Mock).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = rpcAdminQueryMatches(ctx, logger, nk, JSON.stringify({}));
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Failed to query matches');
    });

    it('should apply date range filters', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      (nk.dbQuery as jest.Mock).mockReturnValueOnce([{ total: 0 }]).mockReturnValueOnce([]);

      const result = rpcAdminQueryMatches(
        ctx,
        logger,
        nk,
        JSON.stringify({ start_date: '2024-01-01', end_date: '2024-01-31' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    it('should apply pagination correctly', () => {
      const ctx = createMockContext();
      const logger = createMockLogger();
      const nk = createMockNakama();

      const matchRows = Array.from({ length: 5 }, (_, i) => ({
        match_id: `match_${i}`,
        match_type: 'ranked',
        is_punch_up: false,
        creator_id: `player_${i}`,
        opponent_id: `player_${i + 1}`,
        creator_username: `Player${i}`,
        opponent_username: `Player${i + 1}`,
        winner_id: `player_${i}`,
        loser_id: `player_${i + 1}`,
        creator_rank: 100 + i,
        opponent_rank: 95 + i,
        total_turns: 5,
        duration_seconds: 120,
        end_reason: 'health_zero',
        created_at: new Date('2024-01-15').toISOString(),
        updated_at: new Date('2024-01-15').toISOString(),
        creator_health_remaining: 50,
        opponent_health_remaining: 0,
        season_id: 'season_1',
      }));

      (nk.dbQuery as jest.Mock).mockReturnValueOnce([{ total: 15 }]).mockReturnValueOnce(matchRows);

      const result = rpcAdminQueryMatches(
        ctx,
        logger,
        nk,
        JSON.stringify({ limit: 5, offset: 10 })
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.total).toBe(15);
      expect(parsed.page).toBe(3);
      expect(parsed.per_page).toBe(5);
      expect(parsed.total_pages).toBe(3);
    });
  });

  describe('registerRpc for history/details/admin', () => {
    it('should register get_match_history RPC', () => {
      const initializer = { registerRpc: jest.fn() };
      registerRpcGetMatchHistory(initializer as any);
      expect(initializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_match_history',
        expect.any(Function)
      );
    });

    it('should register get_match_details RPC', () => {
      const initializer = { registerRpc: jest.fn() };
      registerRpcGetMatchDetails(initializer as any);
      expect(initializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_match_details',
        expect.any(Function)
      );
    });

    it('should register admin_query_matches RPC', () => {
      const initializer = { registerRpc: jest.fn() };
      registerRpcAdminQueryMatches(initializer as any);
      expect(initializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/admin_query_matches',
        expect.any(Function)
      );
    });
  });
});
