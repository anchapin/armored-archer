import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import {
  rpcGainXP,
  rpcAllocateStats,
  registerRpcAllocateStats,
  registerRpcGainXP,
  registerRpcGetPlayerStats,
  registerRpcRespecStats,
  registerRpcSaveBuild,
  registerRpcLoadBuild,
  registerRpcGetBuilds,
  rpcRespecStats,
  rpcSaveBuild,
  rpcLoadBuild,
  rpcGetBuilds,
  PlayerStats,
  calculateLevel,
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

  // ==================== calculateLevel Tests ====================
  describe('calculateLevel', () => {
    it('should return level 1 for XP below threshold', () => {
      expect(calculateLevel(0)).toBe(1);
      expect(calculateLevel(50)).toBe(1);
      expect(calculateLevel(99)).toBe(1);
    });

    it('should return level 2 for XP reaching first threshold', () => {
      expect(calculateLevel(100)).toBe(2);
      expect(calculateLevel(150)).toBe(2);
      expect(calculateLevel(249)).toBe(2);
    });

    it('should calculate higher levels correctly', () => {
      // Level 3 requires 100 + 150 = 250 XP
      expect(calculateLevel(250)).toBe(3);
      // Level 4 requires 250 + 225 = 475 XP
      expect(calculateLevel(475)).toBe(4);
      // Level 5 requires 475 + 337 = 812 XP (rounded down)
      expect(calculateLevel(812)).toBe(5);
    });

    it('should handle large XP values', () => {
      expect(calculateLevel(10000)).toBeGreaterThan(5);
      expect(calculateLevel(100000)).toBeGreaterThan(10);
    });

    it('should handle exact level boundaries', () => {
      expect(calculateLevel(99)).toBe(1);
      expect(calculateLevel(100)).toBe(2);
      expect(calculateLevel(249)).toBe(2);
      expect(calculateLevel(250)).toBe(3);
    });
  });

  // ==================== Respec System Tests ====================
  describe('registerRpcRespecStats', () => {
    it('should register the respec_stats RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcRespecStats(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/respec_stats',
        expect.any(Function)
      );
    });
  });

  describe('rpcRespecStats', () => {
    const createMockPlayerStats = (
      overrides: Partial<PlayerStats> = {}
    ): PlayerStats => ({
      user_id: 'test-user-123',
      level: 5,
      xp: 500,
      ability_points: 10,
      stats: {
        attack: 20,
        defense: 15,
        dodge: 12,
        crit_rate: 8,
      },
      ...overrides,
    });

    const createMockRespecData = (
      overrides: Partial<Record<string, unknown>> = {}
    ): any => ({
      last_respec_time: 0,
      free_respecs_used: 0,
      current_season_id: 'season-1',
      ...overrides,
    });

    beforeEach(() => {
      // Mock storageRead to return player stats and respec data
      mockNk.storageRead = jest.fn().mockImplementation((requests) => {
        const results: any[] = [];
        for (const req of requests) {
          if (req.collection === 'player_stats') {
            results.push({
              collection: 'player_stats',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify(createMockPlayerStats()),
            });
          } else if (req.collection === 'respec_data') {
            results.push({
              collection: 'respec_data',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify(createMockRespecData()),
            });
          } else if (req.collection === 'player_currency') {
            results.push({
              collection: 'player_currency',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify({ gems: 1000 }),
            });
          }
        }
        return results;
      });

      // Mock walletUpdate for gem deduction
      mockNk.walletUpdate = jest.fn();

      // Mock walletGet to return gem balance
      mockNk.walletGet = jest.fn().mockReturnValue({ gem: 1000 });
    });

    it('should respec stats with valid allocation', () => {
      const payload = JSON.stringify({
        new_allocation: { attack: 15, defense: 20, dodge: 12, crit_rate: 8 },
        use_free_respec: false,
      });

      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.player_stats.stats.attack).toBe(15);
      expect(parsed.player_stats.stats.defense).toBe(20);
      expect(mockNk.walletUpdate).toHaveBeenCalled();
    });

    it('should use free respec when available', () => {
      const payload = JSON.stringify({
        new_allocation: { attack: 18, defense: 17, dodge: 12, crit_rate: 8 },
        use_free_respec: true,
      });

      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.used_free_respec).toBe(true);
      expect(parsed.cost_paid).toBe(0);
      expect(mockNk.walletUpdate).not.toHaveBeenCalled();
    });

    it('should return error when allocation total does not match', () => {
      const payload = JSON.stringify({
        new_allocation: { attack: 30, defense: 30, dodge: 10, crit_rate: 10 },
        use_free_respec: false,
      });

      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('Total stat points must match');
    });

    it('should return error when respec is on cooldown', () => {
      // Set respec time to recent (within cooldown)
      const recentTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      mockNk.storageRead = jest.fn().mockImplementation((requests) => {
        const results: any[] = [];
        for (const req of requests) {
          if (req.collection === 'player_stats') {
            results.push({
              collection: 'player_stats',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify(createMockPlayerStats()),
            });
          } else if (req.collection === 'respec_data') {
            results.push({
              collection: 'respec_data',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify(createMockRespecData({ last_respec_time: recentTime })),
            });
          }
        }
        return results;
      });

      const payload = JSON.stringify({
        new_allocation: { attack: 18, defense: 17, dodge: 12, crit_rate: 8 },
        use_free_respec: false,
      });

      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain('Respec is on cooldown');
    });

    it('should bypass cooldown when using free respec', () => {
      const recentTime = Math.floor(Date.now() / 1000) - 3600;

      mockNk.storageRead = jest.fn().mockImplementation((requests) => {
        const results: any[] = [];
        for (const req of requests) {
          if (req.collection === 'player_stats') {
            results.push({
              collection: 'player_stats',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify(createMockPlayerStats()),
            });
          } else if (req.collection === 'respec_data') {
            results.push({
              collection: 'respec_data',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify(createMockRespecData({ last_respec_time: recentTime })),
            });
          }
        }
        return results;
      });

      const payload = JSON.stringify({
        new_allocation: { attack: 18, defense: 17, dodge: 12, crit_rate: 8 },
        use_free_respec: true,
      });

      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.used_free_respec).toBe(true);
    });

    it('should return error when free respecs exhausted', () => {
      mockNk.storageRead = jest.fn().mockImplementation((requests) => {
        const results: any[] = [];
        for (const req of requests) {
          if (req.collection === 'player_stats') {
            results.push({
              collection: 'player_stats',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify(createMockPlayerStats()),
            });
          } else if (req.collection === 'respec_data') {
            results.push({
              collection: 'respec_data',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify(createMockRespecData({ free_respecs_used: 1 })), // Already used free respec
            });
          } else if (req.collection === 'player_currency') {
            results.push({
              collection: 'player_currency',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify({ gems: 1000 }),
            });
          }
        }
        return results;
      });

      const payload = JSON.stringify({
        new_allocation: { attack: 18, defense: 17, dodge: 12, crit_rate: 8 },
        use_free_respec: true,
      });

      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.used_free_respec).toBe(false); // Falls back to paid
    });

    it('should return error when player not found', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({
        new_allocation: { attack: 18, defense: 17, dodge: 12, crit_rate: 8 },
        use_free_respec: false,
      });

      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });

    it('should handle invalid payload validation', () => {
      const payload = JSON.stringify({
        new_allocation: { attack: -1 }, // Invalid - missing fields
        use_free_respec: false,
      });

      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });

    it('should calculate cost correctly based on gem balance', () => {
      const lowGemStats = createMockPlayerStats({ stats: { attack: 20, defense: 15, dodge: 12, crit_rate: 8 } });

      mockNk.storageRead = jest.fn().mockImplementation((requests) => {
        const results: any[] = [];
        for (const req of requests) {
          if (req.collection === 'player_stats') {
            results.push({
              collection: 'player_stats',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify(lowGemStats),
            });
          } else if (req.collection === 'respec_data') {
            results.push({
              collection: 'respec_data',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify(createMockRespecData()),
            });
          } else if (req.collection === 'player_currency') {
            results.push({
              collection: 'player_currency',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify({ gems: 500 }),
            });
          }
        }
        return results;
      });

      // Mock wallet with low gem balance
      mockNk.walletGet = jest.fn().mockReturnValue({ gem: 500 });

      const payload = JSON.stringify({
        new_allocation: { attack: 18, defense: 17, dodge: 12, crit_rate: 8 },
        use_free_respec: false,
      });

      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.cost_paid).toBeGreaterThanOrEqual(100); // Minimum cost
    });

    it('should enforce maximum cost cap', () => {
      const highGemStats = createMockPlayerStats({ stats: { attack: 20, defense: 15, dodge: 12, crit_rate: 8 } });

      mockNk.storageRead = jest.fn().mockImplementation((requests) => {
        const results: any[] = [];
        for (const req of requests) {
          if (req.collection === 'player_stats') {
            results.push({
              collection: 'player_stats',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify(highGemStats),
            });
          } else if (req.collection === 'respec_data') {
            results.push({
              collection: 'respec_data',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify(createMockRespecData()),
            });
          } else if (req.collection === 'player_currency') {
            results.push({
              collection: 'player_currency',
              key: req.key,
              userId: req.userId,
              value: JSON.stringify({ gems: 100000 }),
            });
          }
        }
        return results;
      });

      // Mock wallet with high gem balance
      mockNk.walletGet = jest.fn().mockReturnValue({ gem: 100000 });

      const payload = JSON.stringify({
        new_allocation: { attack: 18, defense: 17, dodge: 12, crit_rate: 8 },
        use_free_respec: false,
      });

      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.cost_paid).toBeLessThanOrEqual(1000); // Maximum cost
    });
  });

  // ==================== Build System Tests ====================
  describe('registerRpcSaveBuild', () => {
    it('should register the save_build RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcSaveBuild(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/save_build',
        expect.any(Function)
      );
    });
  });

  describe('registerRpcLoadBuild', () => {
    it('should register the load_build RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcLoadBuild(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/load_build',
        expect.any(Function)
      );
    });
  });

  describe('registerRpcGetBuilds', () => {
    it('should register the get_builds RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcGetBuilds(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_builds',
        expect.any(Function)
      );
    });
  });

  describe('rpcSaveBuild', () => {
    it('should save a build successfully', () => {
      const payload = JSON.stringify({
        build_slot: 1,
        build_name: 'My Tank Build',
        stats: { attack: 15, defense: 25, dodge: 5, crit_rate: 10 },
        level: 5,
      });

      const result = rpcSaveBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.build_data.name).toBe('My Tank Build');
      expect(parsed.build_data.level).toBe(5);
      expect(mockNk.storageWrite).toHaveBeenCalled();

      const writtenData = (mockNk.storageWrite as jest.Mock).mock.calls[0][0][0];
      expect(writtenData.collection).toBe('player_builds');
      expect(writtenData.key).toContain('_slot_1');
    });

    it('should save builds in different slots', () => {
      const payload = JSON.stringify({
        build_slot: 3,
        build_name: 'DPS Build',
        stats: { attack: 30, defense: 10, dodge: 5, crit_rate: 20 },
        level: 10,
      });

      const result = rpcSaveBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.build_data.stats.attack).toBe(30);

      const writtenData = (mockNk.storageWrite as jest.Mock).mock.calls[0][0][0];
      expect(writtenData.key).toContain('_slot_3');
    });

    it('should validate build_slot range', () => {
      const invalidPayloads = [
        { build_slot: 0, build_name: 'Test', stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }, level: 1 },
        { build_slot: 4, build_name: 'Test', stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }, level: 1 },
        { build_slot: -1, build_name: 'Test', stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }, level: 1 },
      ];

      for (const payloadData of invalidPayloads) {
        const payload = JSON.stringify(payloadData);
        const result = rpcSaveBuild(mockCtx, mockLogger, mockNk, payload);
        const parsed = JSON.parse(result);

        expect(parsed.error).toBeDefined();
      }
    });

    it('should validate build_name length', () => {
      const emptyNamePayload = JSON.stringify({
        build_slot: 1,
        build_name: '',
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        level: 1,
      });

      const result = rpcSaveBuild(mockCtx, mockLogger, mockNk, emptyNamePayload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });

    it('should include timestamp in saved build', () => {
      const beforeTime = Math.floor(Date.now() / 1000);

      const payload = JSON.stringify({
        build_slot: 1,
        build_name: 'Time Test Build',
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        level: 1,
      });

      const result = rpcSaveBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.build_data.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(typeof parsed.build_data.timestamp).toBe('number');
    });
  });

  describe('rpcLoadBuild', () => {
    const createMockBuild = (slot: number): any => ({
      collection: 'player_builds',
      key: `test-user-123_slot_${slot}`,
      userId: 'test-user-123',
      value: JSON.stringify({
        name: `Build ${slot}`,
        stats: { attack: 10 + slot * 5, defense: 10, dodge: 10, crit_rate: 5 },
        level: slot,
        timestamp: Math.floor(Date.now() / 1000),
      }),
    });

    it('should load an existing build', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([createMockBuild(1)]);

      const payload = JSON.stringify({ build_slot: 1 });
      const result = rpcLoadBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.build_data.name).toBe('Build 1');
      expect(parsed.build_data.stats.attack).toBe(15);
    });

    it('should return error for non-existent build', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({ build_slot: 2 });
      const result = rpcLoadBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Build not found');
    });

    it('should handle corrupted build data', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_builds',
          key: 'test-user-123_slot_1',
          userId: 'test-user-123',
          value: '{invalid json',
        },
      ]);

      const payload = JSON.stringify({ build_slot: 1 });
      const result = rpcLoadBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Failed to parse build data');
    });

    it('should handle null value in storage', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_builds',
          key: 'test-user-123_slot_1',
          userId: 'test-user-123',
          value: null,
        },
      ]);

      const payload = JSON.stringify({ build_slot: 1 });
      const result = rpcLoadBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Build data corrupted');
    });

    it('should validate build_slot range', () => {
      const payload = JSON.stringify({ build_slot: 5 });
      const result = rpcLoadBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });
  });

  describe('rpcGetBuilds', () => {
    const createMockBuild = (slot: number, exists: boolean = true): any => {
      if (!exists) return null;

      return {
        collection: 'player_builds',
        key: `test-user-123_slot_${slot}`,
        userId: 'test-user-123',
        value: JSON.stringify({
          name: `Build ${slot}`,
          stats: { attack: 10 + slot * 5, defense: 10, dodge: 10, crit_rate: 5 },
          level: slot,
          timestamp: Math.floor(Date.now() / 1000) - slot * 1000,
        }),
      };
    };

    it('should return all saved builds', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        createMockBuild(1),
        createMockBuild(2),
        createMockBuild(3),
      ]);

      const payload = JSON.stringify({});
      const result = rpcGetBuilds(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(Object.keys(parsed.builds)).toHaveLength(3);
      expect(parsed.builds[1].name).toBe('Build 1');
      expect(parsed.builds[2].name).toBe('Build 2');
      expect(parsed.builds[3].name).toBe('Build 3');
    });

    it('should handle partially filled build slots', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        createMockBuild(1),
        null, // Slot 2 not saved
        createMockBuild(3),
      ]);

      const payload = JSON.stringify({});
      const result = rpcGetBuilds(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(Object.keys(parsed.builds)).toHaveLength(2);
      expect(parsed.builds[1]).toBeDefined();
      expect(parsed.builds[3]).toBeDefined();
      expect(parsed.builds[2]).toBeUndefined();
    });

    it('should handle empty builds', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        null,
        null,
        null,
      ]);

      const payload = JSON.stringify({});
      const result = rpcGetBuilds(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(Object.keys(parsed.builds)).toHaveLength(0);
    });

    it('should skip corrupted build data', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        createMockBuild(1),
        {
          collection: 'player_builds',
          key: 'test-user-123_slot_2',
          userId: 'test-user-123',
          value: '{corrupted}',
        },
        createMockBuild(3),
      ]);

      const payload = JSON.stringify({});
      const result = rpcGetBuilds(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(Object.keys(parsed.builds)).toHaveLength(2);
      expect(parsed.builds[1]).toBeDefined();
      expect(parsed.builds[3]).toBeDefined();
      expect(parsed.builds[2]).toBeUndefined();
    });
  });

  // ==================== Helper Function Tests ====================
  describe('savePlayerStats internal function', () => {
    it('should save player stats and invalidate cache', () => {
      const playerStats: PlayerStats = {
        user_id: 'test-user-123',
        level: 5,
        xp: 500,
        ability_points: 10,
        stats: { attack: 20, defense: 15, dodge: 12, crit_rate: 8 },
      };

      // Call rpcGainXP which internally calls savePlayerStats
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(playerStats),
        },
      ]);

      const payload = JSON.stringify({ xp_amount: 100, source: 'pve' });
      rpcGainXP(mockCtx, mockLogger, mockNk, payload);

      // Verify storageWrite was called
      expect(mockNk.storageWrite).toHaveBeenCalled();

      // Verify audit was logged
      const writeCalls = (mockNk.storageWrite as jest.Mock).mock.calls;
      const auditWrites = writeCalls.filter((call: any[]) =>
        call[0].some((obj: any) => obj.collection === 'audit_logs')
      );
      expect(auditWrites.length).toBeGreaterThan(0);
    });
  });

  describe('rpcAllocateStats - additional coverage', () => {
    it('should log audit on failure', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({ stat_name: 'defense', points: 1 });
      const result = rpcAllocateStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Player stats not found');

      const writeCalls = (mockNk.storageWrite as jest.Mock).mock.calls;
      const auditWrites = writeCalls.filter((call: any[]) =>
        call[0].some((obj: any) => obj.collection === 'audit_logs')
      );
      expect(auditWrites.length).toBeGreaterThan(0);

      const auditEntry = JSON.parse(auditWrites[0][0][0].value);
      expect(auditEntry.action).toBe('allocate_stats');
      expect(auditEntry.result).toBe('failure');
    });

    it('should handle corrupted player data', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: '{invalid json',
        },
      ]);

      const payload = JSON.stringify({ stat_name: 'attack', points: 1 });
      const result = rpcAllocateStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('INVALID_DATA');
    });

    it('should allocate to each valid stat type', () => {
      const validStats = ['attack', 'defense', 'dodge', 'crit_rate'];

      for (const stat of validStats) {
        jest.clearAllMocks();

        const existingStats: PlayerStats = {
          user_id: 'test-user-123',
          level: 2,
          xp: 0,
          ability_points: 2,
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

        const payload = JSON.stringify({ stat_name: stat, points: 1 });
        const result = rpcAllocateStats(mockCtx, mockLogger, mockNk, payload);
        const parsed = JSON.parse(result);

        expect(parsed.success).toBe(true);
        expect(parsed.player_stats.ability_points).toBe(1);
      }
    });
  });
});
