import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import {
  rpcCreateMatch,
  rpcAcceptMatch,
  rpcListMatches,
  rpcGetPlayerRank,
  calculateRank,
  generateMatchId,
  PvPMatch,
} from '../matchmaker';

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
    mockCtx = createMockContext();
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

      const payload = JSON.stringify({
        match_type: 'ranked',
        target_opponent_id: 'target-user',
        is_punch_up: true,
      });
      const result = rpcCreateMatch(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.match.is_punch_up).toBe(true);
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

      expect(parsed.error).toBe('Rank difference too large for direct challenge');
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
});
