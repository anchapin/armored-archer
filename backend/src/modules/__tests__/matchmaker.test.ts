import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import {
  rpcCreateMatch,
  rpcAcceptMatch,
  rpcListMatches,
  rpcGetPlayerRank,
  rpcCompleteMatch,
  calculateRank,
  generateMatchId,
  PvPMatch,
  registerRpcListMatches,
  registerRpcCreateMatch,
  registerRpcAcceptMatch,
  registerRpcGetPlayerRank,
  registerRpcCompleteMatch,
  rpcSubmitTurn,
  rpcGetAsyncMatchState,
  rpcForfeitMatch,
  registerRpcSubmitTurn,
  registerRpcGetAsyncMatchState,
  registerRpcForfeitMatch,
  isPunchUpMatch,
  calculateFavoritePenalty,
  calculatePunchUpGemBonus,
  generatePunchUpDescription,
  type PunchUpInfo,
} from '../matchmaker';

// Mock anti_cheat module
jest.mock('../anti_cheat', () => ({
  isPlayerFlagged: jest.fn(),
  getFlagReason: jest.fn(),
  recordMatchResult: jest.fn(),
}));

// Mock season_system module
jest.mock('../season_system', () => ({
  getCurrentSeason: jest.fn(),
  applyEloUpdates: jest.fn(),
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

  describe('rpcGetPlayerRank', () => {
    beforeEach(() => {
      (applyRankDecay as jest.Mock).mockImplementation((_nk, _userId, rank) => rank);
    });

    it('should return player rank, level, and xp', () => {
      const playerStats = {
        level: 7,
        xp: 1250,
        stats: { attack: 25, defense: 20, dodge: 15, crit_rate: 12 },
      };
      mockNk.storageRead = jest.fn(() => [
        {
          collection: 'player_stats',
          key: 'test-user-123',
          value: JSON.stringify(playerStats),
        },
      ]);

      const payload = JSON.stringify({});
      const result = rpcGetPlayerRank(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rank).toBeDefined();
      expect(parsed.level).toBe(7);
      expect(parsed.xp).toBe(1250);
    });

    it('should return error when player stats not found', () => {
      mockNk.storageRead = jest.fn(() => []);
      const payload = JSON.stringify({});
      const result = rpcGetPlayerRank(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Player stats not found');
    });
  });

  describe('calculateRank', () => {
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
      ...overrides,
    });

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
      (applyRankDecay as jest.Mock).mockImplementation((_nk, _userId, rank) => rank);
      (logAudit as jest.Mock).mockImplementation();
      (recordMatchResult as jest.Mock).mockImplementation();
    });

    it('should complete a ranked match successfully', () => {
      const match = createActiveMatch();
      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: match.match_id, value: JSON.stringify(match) }];
        }
        return [];
      });

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
      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should return error when winner is flagged', () => {
      (isPlayerFlagged as jest.Mock).mockReturnValue(true);
      (getFlagReason as jest.Mock).mockReturnValue('Suspicious activity');

      const payload = JSON.stringify({
        match_id: 'match_test',
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('PLAYER_FLAGGED');
      expect(parsed.error).toContain('flagged for review');
    });

    it('should return error when loser is flagged', () => {
      (isPlayerFlagged as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
      (getFlagReason as jest.Mock).mockReturnValue('Suspicious activity');

      const payload = JSON.stringify({
        match_id: 'match_test',
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
      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: match.match_id, value: JSON.stringify(match) }];
        }
        return [];
      });

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
      const match = createActiveMatch();
      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: match.match_id, value: JSON.stringify(match) }];
        }
        return [];
      });

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

    it('should return error when winner is not a participant', () => {
      const match = createActiveMatch();
      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: match.match_id, value: JSON.stringify(match) }];
        }
        return [];
      });

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'non-participant',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Winner and loser must be match participants');
    });

    it('should return error when loser is not a participant', () => {
      const match = createActiveMatch();
      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: match.match_id, value: JSON.stringify(match) }];
        }
        return [];
      });

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'non-participant',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Winner and loser must be match participants');
    });

    it('should return error when winner and loser are the same', () => {
      const match = createActiveMatch();
      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: match.match_id, value: JSON.stringify(match) }];
        }
        return [];
      });

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'test-user-123',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Winner and loser must be different');
    });

    it('should return validation error for invalid payload', () => {
      const payload = JSON.stringify({ match_id: 123 });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should complete a casual match without rank changes', () => {
      const match = createActiveMatch({ match_type: 'casual' });
      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: match.match_id, value: JSON.stringify(match) }];
        }
        return [];
      });

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
      const match = createActiveMatch();
      (getLeaderboardEntry as jest.Mock).mockReturnValue({ score: 1250 });

      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: match.match_id, value: JSON.stringify(match) }];
        }
        return [];
      });

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

    it('should use is_punch_up from request when provided', () => {
      const match = createActiveMatch({ is_punch_up: false });
      (applyEloUpdates as jest.Mock).mockReturnValue({ winnerNewElo: 1215, loserNewElo: 1135 });

      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: match.match_id, value: JSON.stringify(match) }];
        }
        return [];
      });

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
        is_punch_up: true,
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.is_punch_up).toBe(true);
    });

    it('should apply rank decay when applicable', () => {
      const match = createActiveMatch();
      (applyRankDecay as jest.Mock).mockImplementation((_nk, userId, rank) => {
        // Simulate rank decay for inactive players
        return rank > 1100 ? rank - 10 : rank;
      });

      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: match.match_id, value: JSON.stringify(match) }];
        }
        return [];
      });

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      const result = rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(applyRankDecay).toHaveBeenCalled();
      expect(parsed.success).toBe(true);
    });

    it('should record player activity after match completion', () => {
      const match = createActiveMatch();

      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: match.match_id, value: JSON.stringify(match) }];
        }
        return [];
      });

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
      const match = createActiveMatch();

      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: match.match_id, value: JSON.stringify(match) }];
        }
        return [];
      });

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);

      expect(recordMatchResult).toHaveBeenCalledTimes(2);
    });

    it('should log audit event on match completion', () => {
      const match = createActiveMatch();

      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: match.match_id, value: JSON.stringify(match) }];
        }
        return [];
      });

      const payload = JSON.stringify({
        match_id: match.match_id,
        winner_id: 'test-user-123',
        loser_id: 'opponent-user',
      });

      rpcCompleteMatch(mockCtx, mockLogger, mockNk, payload);

      expect(logAudit).toHaveBeenCalled();
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

      registerRpcGetPlayerRank(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_player_rank',
        rpcGetPlayerRank
      );

      registerRpcCompleteMatch(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/complete_match',
        rpcCompleteMatch
      );
    });
  });

  // ==================== ASYNC DUEL LIFECYCLE TESTS ====================

  describe('Async Duel Lifecycle', () => {
    describe('rpcSubmitTurn', () => {
      it('should submit a turn successfully', () => {
        const match: PvPMatch = {
          match_id: 'match_123',
          creator_id: 'creator-user',
          opponent_id: 'opponent-user',
          creator_rank: 15,
          opponent_rank: 14,
          match_type: 'ranked',
          is_punch_up: false,
          status: 'active',
          created_at: Date.now() - 60000,
          updated_at: Date.now(),
          creator_turn_data: undefined,
          opponent_turn_data: undefined,
          winner: undefined,
          expires_at: Date.now() + 86400000,
          last_turn_timestamp: Date.now() - 30000,
          // Async duel fields
          current_turn: 1,
          current_player: 'creator-user',
          turn_time_limit_ms: 86400000,
          creator_health: 100,
          opponent_health: 100,
          max_turns: 10,
          creator_consecutive_timeouts: 0,
          opponent_consecutive_timeouts: 0,
        };

        mockNk.storageRead = jest.fn(() => [
          {
            collection: 'pvp_matches',
            key: 'match_123',
            userId: 'test-user-123',
            value: JSON.stringify(match),
          },
        ]);

        const payload = JSON.stringify({
          match_id: 'match_123',
          action_type: 'shoot',
          angle: 1.57,
          power: 0.9,
        });

        mockCtx.userId = 'creator-user';

        const result = rpcSubmitTurn(mockCtx, mockLogger, mockNk, payload);
        const response = JSON.parse(result);

        expect(response.success).toBe(true);
        expect(response.turn_submitted).toBe(true);
        expect(response.match.creator_turn_data).toBeDefined();
        expect(response.match.creator_turn_data.action_type).toBe('shoot');
        expect(mockNk.storageWrite).toHaveBeenCalled();
      });

      it('should reject turn submission when not player\'s turn', () => {
        const match: PvPMatch = {
          match_id: 'match_123',
          creator_id: 'creator-user',
          opponent_id: 'opponent-user',
          creator_rank: 15,
          opponent_rank: 14,
          match_type: 'ranked',
          is_punch_up: false,
          status: 'active',
          created_at: Date.now() - 60000,
          updated_at: Date.now(),
          creator_turn_data: undefined,
          opponent_turn_data: undefined,
          winner: undefined,
          expires_at: Date.now() + 86400000,
          last_turn_timestamp: Date.now() - 30000,
          current_turn: 1,
          current_player: 'opponent-user', // Not creator's turn
          turn_time_limit_ms: 86400000,
          creator_health: 100,
          opponent_health: 100,
          max_turns: 10,
          creator_consecutive_timeouts: 0,
          opponent_consecutive_timeouts: 0,
        };

        mockNk.storageRead = jest.fn(() => [
          {
            collection: 'pvp_matches',
            key: 'match_123',
            userId: 'test-user-123',
            value: JSON.stringify(match),
          },
        ]);

        const payload = JSON.stringify({
          match_id: 'match_123',
          action_type: 'shoot',
          angle: 1.57,
        });

        mockCtx.userId = 'creator-user';

        const result = rpcSubmitTurn(mockCtx, mockLogger, mockNk, payload);
        const response = JSON.parse(result);

        expect(response.success).toBeUndefined();
        expect(response.error).toBe('It is not your turn');
        expect(response.current_player).toBe('opponent-user');
      });

      it('should reject turn submission for non-active match', () => {
        const match: PvPMatch = {
          match_id: 'match_123',
          creator_id: 'creator-user',
          opponent_id: 'opponent-user',
          creator_rank: 15,
          opponent_rank: 14,
          match_type: 'ranked',
          is_punch_up: false,
          status: 'pending', // Not active
          created_at: Date.now() - 60000,
          updated_at: Date.now(),
          creator_turn_data: undefined,
          opponent_turn_data: undefined,
          winner: undefined,
          expires_at: Date.now() + 86400000,
          last_turn_timestamp: Date.now() - 30000,
          current_turn: 1,
          current_player: 'creator-user',
          turn_time_limit_ms: 86400000,
          creator_health: 100,
          opponent_health: 100,
          max_turns: 10,
          creator_consecutive_timeouts: 0,
          opponent_consecutive_timeouts: 0,
        };

        mockNk.storageRead = jest.fn(() => [
          {
            collection: 'pvp_matches',
            key: 'match_123',
            userId: 'test-user-123',
            value: JSON.stringify(match),
          },
        ]);

        const payload = JSON.stringify({
          match_id: 'match_123',
          action_type: 'shoot',
          angle: 1.57,
        });

        mockCtx.userId = 'creator-user';

        const result = rpcSubmitTurn(mockCtx, mockLogger, mockNk, payload);
        const response = JSON.parse(result);

        expect(response.success).toBeUndefined();
        expect(response.error).toBe('Match is not active');
        expect(response.match_status).toBe('pending');
      });
    });

    describe('rpcGetAsyncMatchState', () => {
      it('should return match state with player-specific information', () => {
        const match: PvPMatch = {
          match_id: 'match_123',
          creator_id: 'creator-user',
          opponent_id: 'opponent-user',
          creator_rank: 15,
          opponent_rank: 14,
          match_type: 'ranked',
          is_punch_up: false,
          status: 'active',
          created_at: Date.now() - 60000,
          updated_at: Date.now(),
          creator_turn_data: undefined,
          opponent_turn_data: undefined,
          winner: undefined,
          expires_at: Date.now() + 86400000,
          last_turn_timestamp: Date.now() - 30000,
          current_turn: 1,
          current_player: 'creator-user',
          turn_time_limit_ms: 86400000,
          creator_health: 85,
          opponent_health: 92,
          max_turns: 10,
          creator_consecutive_timeouts: 0,
          opponent_consecutive_timeouts: 0,
        };

        mockNk.storageRead = jest.fn(() => [
          {
            collection: 'pvp_matches',
            key: 'match_123',
            userId: 'test-user-123',
            value: JSON.stringify(match),
          },
        ]);

        const payload = JSON.stringify({ match_id: 'match_123' });
        mockCtx.userId = 'creator-user';

        const result = rpcGetAsyncMatchState(mockCtx, mockLogger, mockNk, payload);
        const response = JSON.parse(result);

        expect(response.success).toBe(true);
        expect(response.is_my_turn).toBe(true);
        expect(response.my_health).toBe(85);
        expect(response.opponent_health).toBe(92);
        expect(response.time_remaining_ms).toBeGreaterThan(0);
      });

      it('should correctly identify opponent\'s turn', () => {
        const match: PvPMatch = {
          match_id: 'match_123',
          creator_id: 'creator-user',
          opponent_id: 'opponent-user',
          creator_rank: 15,
          opponent_rank: 14,
          match_type: 'ranked',
          is_punch_up: false,
          status: 'active',
          created_at: Date.now() - 60000,
          updated_at: Date.now(),
          creator_turn_data: undefined,
          opponent_turn_data: undefined,
          winner: undefined,
          expires_at: Date.now() + 86400000,
          last_turn_timestamp: Date.now() - 30000,
          current_turn: 1,
          current_player: 'opponent-user', // Opponent's turn
          turn_time_limit_ms: 86400000,
          creator_health: 85,
          opponent_health: 92,
          max_turns: 10,
          creator_consecutive_timeouts: 0,
          opponent_consecutive_timeouts: 0,
        };

        mockNk.storageRead = jest.fn(() => [
          {
            collection: 'pvp_matches',
            key: 'match_123',
            userId: 'test-user-123',
            value: JSON.stringify(match),
          },
        ]);

        const payload = JSON.stringify({ match_id: 'match_123' });
        mockCtx.userId = 'creator-user';

        const result = rpcGetAsyncMatchState(mockCtx, mockLogger, mockNk, payload);
        const response = JSON.parse(result);

        expect(response.success).toBe(true);
        expect(response.is_my_turn).toBe(false);
      });

      it('should return error for non-existent match', () => {
        mockNk.storageRead = jest.fn(() => []);

        const payload = JSON.stringify({ match_id: 'nonexistent' });
        mockCtx.userId = 'creator-user';

        const result = rpcGetAsyncMatchState(mockCtx, mockLogger, mockNk, payload);
        const response = JSON.parse(result);

        expect(response.success).toBeUndefined();
        expect(response.error).toBe('Match not found');
      });
    });

    describe('rpcForfeitMatch', () => {
      it('should forfeit match successfully', () => {
        const match: PvPMatch = {
          match_id: 'match_123',
          creator_id: 'creator-user',
          opponent_id: 'opponent-user',
          creator_rank: 15,
          opponent_rank: 14,
          match_type: 'ranked',
          is_punch_up: false,
          status: 'active',
          created_at: Date.now() - 60000,
          updated_at: Date.now(),
          creator_turn_data: undefined,
          opponent_turn_data: undefined,
          winner: undefined,
          expires_at: Date.now() + 86400000,
          last_turn_timestamp: Date.now() - 30000,
          current_turn: 1,
          current_player: 'creator-user',
          turn_time_limit_ms: 86400000,
          creator_health: 85,
          opponent_health: 92,
          max_turns: 10,
          creator_consecutive_timeouts: 0,
          opponent_consecutive_timeouts: 0,
        };

        mockNk.storageRead = jest.fn(() => [
          {
            collection: 'pvp_matches',
            key: 'match_123',
            userId: 'test-user-123',
            value: JSON.stringify(match),
          },
        ]);

        const payload = JSON.stringify({ match_id: 'match_123' });
        mockCtx.userId = 'creator-user';

        // Mock complete match process
        (applyEloUpdates as jest.Mock).mockReturnValue({
          winnerNewElo: 1220,
          loserNewElo: 1180,
        });

        (getLeaderboardEntry as jest.Mock).mockReturnValue({ score: 1200 });

        const result = rpcForfeitMatch(mockCtx, mockLogger, mockNk, payload);
        const response = JSON.parse(result);

        expect(response.success).toBe(true);
        expect(response.forfeited_by).toBe('creator-user');
        expect(response.forfeit_reason).toBe('voluntary');
        expect(response.match.winner).toBe('opponent-user');
      });

      it('should reject forfeit for non-active match', () => {
        const match: PvPMatch = {
          match_id: 'match_123',
          creator_id: 'creator-user',
          opponent_id: 'opponent-user',
          creator_rank: 15,
          opponent_rank: 14,
          match_type: 'ranked',
          is_punch_up: false,
          status: 'pending', // Not active
          created_at: Date.now() - 60000,
          updated_at: Date.now(),
          creator_turn_data: undefined,
          opponent_turn_data: undefined,
          winner: undefined,
          expires_at: Date.now() + 86400000,
          last_turn_timestamp: Date.now() - 30000,
          current_turn: 1,
          current_player: 'creator-user',
          turn_time_limit_ms: 86400000,
          creator_health: 100,
          opponent_health: 100,
          max_turns: 10,
          creator_consecutive_timeouts: 0,
          opponent_consecutive_timeouts: 0,
        };

        mockNk.storageRead = jest.fn(() => [
          {
            collection: 'pvp_matches',
            key: 'match_123',
            userId: 'creator-user',
            value: JSON.stringify(match),
          },
        ]);

        const payload = JSON.stringify({ match_id: 'match_123' });
        mockCtx.userId = 'creator-user';

        const result = rpcForfeitMatch(mockCtx, mockLogger, mockNk, payload);
        const response = JSON.parse(result);

        expect(response.error).toBe('Match is not active');
      });
    });

    describe('RPC Registration', () => {
      it('should register submit_turn RPC', () => {
        const mockInitializer = { registerRpc: jest.fn() };

        registerRpcSubmitTurn(mockInitializer as any);
        expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
          'armored_archer/submit_turn',
          rpcSubmitTurn
        );
      });

      it('should register get_async_match_state RPC', () => {
        const mockInitializer = { registerRpc: jest.fn() };

        registerRpcGetAsyncMatchState(mockInitializer as any);
        expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
          'armored_archer/get_async_match_state',
          rpcGetAsyncMatchState
        );
      });

      it('should register forfeit_match RPC', () => {
        const mockInitializer = { registerRpc: jest.fn() };

        registerRpcForfeitMatch(mockInitializer as any);
        expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
          'armored_archer/forfeit_match',
          rpcForfeitMatch
        );
      });
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

      describe('calculateFavoritePenalty', () => {
        it('should return no penalty for non-punch-up matches', () => {
          const penalty = calculateFavoritePenalty(false, 10);
          expect(penalty).toBe(1.0);
        });

        it('should calculate minimum penalty for smallest punch-up', () => {
          const penalty = calculateFavoritePenalty(true, 5);
          expect(penalty).toBe(0.7);
        });

        it('should calculate maximum penalty for largest punch-up', () => {
          const penalty = calculateFavoritePenalty(true, 15);
          expect(penalty).toBe(0.5);
        });

        it('should scale penalty with rank difference', () => {
          const smallPenalty = calculateFavoritePenalty(true, 5);
          const mediumPenalty = calculateFavoritePenalty(true, 10);
          const largePenalty = calculateFavoritePenalty(true, 15);

          expect(smallPenalty).toBeGreaterThan(mediumPenalty);
          expect(mediumPenalty).toBeGreaterThan(largePenalty);
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

        it('should mention favorite penalty', () => {
          const info: PunchUpInfo = {
            is_punch_up: true,
            rank_difference: 10,
            underdog_rank: 25,
            favorite_rank: 35,
            underdog_id: 'player1',
            reward_multiplier: 1.6,
          };

          const description = generatePunchUpDescription(info);
          expect(description).toContain('Favorites receive reduced rewards');
        });
      });
    });
  });
});
