import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import {
  rpcGainXP,
  rpcAllocateStats,
  registerRpcAllocateStats,
  registerRpcGainXP,
  registerRpcGetPlayerStats,
  PlayerStats,
} from '../rpg_system';
import { rpcGetPlayerStats } from '../player_rpc';
import { Runtime } from '../../types/nakama';

describe('rpg_system', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext();
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  describe('rpcGainXP', () => {
    it('should create new player stats if none exist', () => {
      const payload = JSON.stringify({ xp_amount: 50, source: 'pve' });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.player_stats.level).toBe(1);
      expect(parsed.xp_gained).toBe(50);
    });

    it('should add XP to existing player', () => {
      const existingStats: PlayerStats = {
        user_id: 'test-user-123',
        level: 1,
        xp: 50,
        ability_points: 0,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(existingStats),
        },
      ]);

      const payload = JSON.stringify({ xp_amount: 100, source: 'pve' });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.player_stats.xp).toBe(150);
    });

    it('should level up when XP threshold is reached', () => {
      const existingStats: PlayerStats = {
        user_id: 'test-user-123',
        level: 1,
        xp: 90,
        ability_points: 0,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(existingStats),
        },
      ]);

      const payload = JSON.stringify({ xp_amount: 50, source: 'pve' });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.player_stats.level).toBe(2);
      expect(parsed.levels_gained).toBe(1);
      expect(parsed.player_stats.ability_points).toBe(1);
    });

    it('should handle validation errors', () => {
      const payload = JSON.stringify({ xp_amount: -10, source: 'invalid' });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should handle multiple level ups', () => {
      const existingStats: PlayerStats = {
        user_id: 'test-user-123',
        level: 1,
        xp: 50,
        ability_points: 0,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(existingStats),
        },
      ]);

      const payload = JSON.stringify({ xp_amount: 1000, source: 'pvp' });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.levels_gained).toBeGreaterThan(1);
      expect(parsed.player_stats.ability_points).toBeGreaterThan(1);
    });
  });

  describe('rpcAllocateStats', () => {
    it('should allocate stat points successfully', () => {
      const existingStats: PlayerStats = {
        user_id: 'test-user-123',
        level: 2,
        xp: 0,
        ability_points: 5,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(existingStats),
        },
      ]);

      const payload = JSON.stringify({ stat_name: 'attack', points: 3 });
      const result = rpcAllocateStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.player_stats.stats.attack).toBe(13);
      expect(parsed.player_stats.ability_points).toBe(2);
    });

    it('should return error when not enough ability points', () => {
      const existingStats: PlayerStats = {
        user_id: 'test-user-123',
        level: 1,
        xp: 0,
        ability_points: 1,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(existingStats),
        },
      ]);

      const payload = JSON.stringify({ stat_name: 'attack', points: 5 });
      const result = rpcAllocateStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Not enough ability points');
    });

    it('should return error when player stats not found', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({ stat_name: 'defense', points: 1 });
      const result = rpcAllocateStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Player stats not found');
    });

    it('should validate stat allocation input', () => {
      const payload = JSON.stringify({ stat_name: 'invalid_stat', points: 1 });
      const result = rpcAllocateStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcGetPlayerStats', () => {
    it('should return existing player stats', () => {
      const existingStats: PlayerStats = {
        user_id: 'test-user-123',
        level: 5,
        xp: 500,
        ability_points: 10,
        stats: { attack: 20, defense: 15, dodge: 12, crit_rate: 8 },
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(existingStats),
        },
      ]);

      const payload = JSON.stringify({});
      const result = rpcGetPlayerStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.level).toBe(5);
      expect(parsed.xp).toBe(500);
    });

    it('should return error when player stats not found', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({});
      const result = rpcGetPlayerStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Player stats not found');
    });
  });

  describe('rpcGainXP - enhanced coverage', () => {
    it('should handle existing player data with valid parse', () => {
      const existingStats: PlayerStats = {
        user_id: 'test-user-123',
        level: 3,
        xp: 250,
        ability_points: 2,
        stats: { attack: 15, defense: 12, dodge: 10, crit_rate: 7 },
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(existingStats),
        },
      ]);

      const payload = JSON.stringify({ xp_amount: 100, source: 'pve' });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.player_stats.xp).toBe(350);
      expect(parsed.player_stats.user_id).toBe('test-user-123');
      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should handle corrupted player data with parse failure', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: '{invalid json!!!',
        },
      ]);

      const payload = JSON.stringify({ xp_amount: 50, source: 'pve' });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Failed to parse data');
      expect(parsed.error_code).toBe('INVALID_DATA');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to parse data');
    });

    it('should handle empty/null value in storage', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: null,
        },
      ]);

      const payload = JSON.stringify({ xp_amount: 50, source: 'pve' });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.player_stats.level).toBe(1);
      expect(parsed.player_stats.xp).toBe(50);
    });

    it('should log audit on validation failure', () => {
      const payload = JSON.stringify({ xp_amount: -10, source: 'invalid' });
      rpcGainXP(mockCtx, mockLogger, mockNk, payload);

      const writeCalls = (mockNk.storageWrite as jest.Mock).mock.calls;
      const auditWrites = writeCalls.filter((call: any[]) =>
        call[0].some((obj: any) => obj.collection === 'audit_logs')
      );
      expect(auditWrites.length).toBeGreaterThan(0);

      const auditEntry = JSON.parse(auditWrites[0][0][0].value);
      expect(auditEntry.action).toBe('gain_xp');
      expect(auditEntry.result).toBe('failure');
    });

    it('should return correct response structure with levels_gained', () => {
      const existingStats: PlayerStats = {
        user_id: 'test-user-123',
        level: 1,
        xp: 50,
        ability_points: 0,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(existingStats),
        },
      ]);

      const payload = JSON.stringify({ xp_amount: 100, source: 'pve' });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('success', true);
      expect(parsed).toHaveProperty('player_stats');
      expect(parsed).toHaveProperty('xp_gained', 100);
      expect(parsed).toHaveProperty('levels_gained');
      expect(typeof parsed.levels_gained).toBe('number');
    });
  });

  describe('registerRpcAllocateStats', () => {
    it('should register the allocate_stats RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcAllocateStats(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/allocate_stats',
        expect.any(Function)
      );
    });
  });

  describe('registerRpcGainXP', () => {
    it('should register the gain_xp RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcGainXP(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/gain_xp',
        expect.any(Function)
      );
    });
  });

  describe('registerRpcGetPlayerStats', () => {
    it('should register the get_player_stats RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcGetPlayerStats(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_player_stats',
        expect.any(Function)
      );
    });
  });
});
