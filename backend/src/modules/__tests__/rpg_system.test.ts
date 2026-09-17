import {
  createMockLogger,
  createMockContext,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import {
  rpcGainXP,
  rpcAllocateStats,
  rpcRespecStats,
  rpcSaveBuild,
  rpcLoadBuild,
  rpcGetBuilds,
  registerRpcAllocateStats,
  registerRpcGainXP,
  registerRpcGetPlayerStats,
  registerRpcRespecStats,
  registerRpcSaveBuild,
  registerRpcLoadBuild,
  registerRpcGetBuilds,
  PlayerStats,
} from '../rpg_system';
import { rpcGetPlayerStats } from '../player_rpc';
import { Runtime } from '../../types/nakama';

describe('rpg_system', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    testStorage.clear();
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

      const auditEntry = (typeof auditWrites[0][0][0].value === 'string' ? JSON.parse(auditWrites[0][0][0].value) : auditWrites[0][0][0].value);
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

  describe('rpcGainXP - server-authoritative cap (issue #1068)', () => {
    const buildExistingStats = (xp: number): PlayerStats => ({
      user_id: 'test-user-123',
      level: 1,
      xp,
      ability_points: 0,
      stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
    });

    it('should cap an inflated xp_amount at the server stage-XP ceiling', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(buildExistingStats(100)),
        },
      ]);

      // Schema ceiling is 1,000,000 - well above the server cap of 275
      // ((60 base + 65 boss bonus) * 2.2 nightmare multiplier)
      const payload = JSON.stringify({ xp_amount: 999999, source: 'pve' });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.xp_gained).toBe(275);
      expect(parsed.xp_capped).toBe(true);

      // Stored XP must reflect the capped grant, not the client claim
      const writeCalls = (mockNk.storageWrite as jest.Mock).mock.calls;
      const statsWrites = writeCalls.filter((call: any[]) =>
        call[0].some((obj: any) => obj.collection === 'player_stats')
      );
      expect(statsWrites.length).toBeGreaterThan(0);
      const storedStatsRaw = statsWrites[0][0].find(
        (obj: any) => obj.collection === 'player_stats'
      ).value;
      const storedStats =
        typeof storedStatsRaw === 'string' ? JSON.parse(storedStatsRaw) : storedStatsRaw;
      expect(storedStats.xp).toBe(375); // 100 existing + 275 capped grant
    });

    it('should cap inflated xp_amount for the pvp source identically', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(buildExistingStats(0)),
        },
      ]);

      const payload = JSON.stringify({ xp_amount: 50000, source: 'pvp' });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.xp_gained).toBe(275);
      expect(parsed.xp_capped).toBe(true);
      expect(parsed.player_stats.xp).toBe(275);
    });

    it('should grant the full amount when at or below the cap', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(buildExistingStats(0)),
        },
      ]);

      const payload = JSON.stringify({ xp_amount: 275, source: 'pve' });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.xp_gained).toBe(275);
      expect(parsed.xp_capped).toBe(false);
      expect(parsed.player_stats.xp).toBe(275);
    });

    it('should audit when a request is capped', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(buildExistingStats(0)),
        },
      ]);

      const payload = JSON.stringify({ xp_amount: 10000, source: 'pve' });
      rpcGainXP(mockCtx, mockLogger, mockNk, payload);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Capping XP request'),
        10000,
        275,
        'test-user',
        'pve'
      );

      const writeCalls = (mockNk.storageWrite as jest.Mock).mock.calls;
      const auditWrites = writeCalls.filter((call: any[]) =>
        call[0].some((obj: any) => obj.collection === 'audit_logs')
      );
      expect(auditWrites.length).toBeGreaterThan(0);
      const auditEntry = (typeof auditWrites[0][0][0].value === 'string' ? JSON.parse(auditWrites[0][0][0].value) : auditWrites[0][0][0].value);
      expect(auditEntry.action).toBe('gain_xp');
      expect(auditEntry.details.xp_amount).toBe(10000);
      expect(auditEntry.details.xp_granted).toBe(275);
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

  describe('rpcSaveBuild', () => {
    it('should save a build to a valid slot', () => {
      const payload = JSON.stringify({
        build_slot: 1,
        build_name: 'Warrior',
        stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 5 },
        level: 5,
      });
      const result = rpcSaveBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.build_data.name).toBe('Warrior');
      expect(parsed.build_data.stats.attack).toBe(20);
      expect(parsed.build_data.level).toBe(5);
      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should reject invalid build slot', () => {
      const payload = JSON.stringify({
        build_slot: 5,
        build_name: 'Test',
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        level: 1,
      });
      const result = rpcSaveBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty build name', () => {
      const payload = JSON.stringify({
        build_slot: 1,
        build_name: '',
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        level: 1,
      });
      const result = rpcSaveBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcLoadBuild', () => {
    it('should load an existing build', () => {
      const buildData = {
        name: 'Tank',
        stats: { attack: 10, defense: 25, dodge: 10, crit_rate: 5 },
        level: 8,
        timestamp: 1700000000,
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_builds',
          key: 'test-user-123_slot_1',
          userId: 'test-user-123',
          value: JSON.stringify(buildData),
        },
      ]);

      const payload = JSON.stringify({ build_slot: 1 });
      const result = rpcLoadBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.build_data.name).toBe('Tank');
      expect(parsed.build_data.stats.defense).toBe(25);
    });

    it('should return error for missing build', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({ build_slot: 1 });
      const result = rpcLoadBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Build not found');
    });

    it('should return error for corrupted build data', () => {
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

    it('should reject invalid build slot', () => {
      const payload = JSON.stringify({ build_slot: 0 });
      const result = rpcLoadBuild(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcGetBuilds', () => {
    it('should return all saved builds', () => {
      const build1 = {
        name: 'Warrior',
        stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 5 },
        level: 5,
        timestamp: 1700000000,
      };
      const build2 = {
        name: 'Archer',
        stats: { attack: 15, defense: 10, dodge: 15, crit_rate: 10 },
        level: 6,
        timestamp: 1700000001,
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_builds',
          key: 'test-user-123_slot_1',
          userId: 'test-user-123',
          value: JSON.stringify(build1),
        },
        {
          collection: 'player_builds',
          key: 'test-user-123_slot_2',
          userId: 'test-user-123',
          value: JSON.stringify(build2),
        },
      ]);

      const result = rpcGetBuilds(mockCtx, mockLogger, mockNk, '');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(Object.keys(parsed.builds).length).toBe(2);
      expect(parsed.builds[1].name).toBe('Warrior');
      expect(parsed.builds[2].name).toBe('Archer');
    });

    it('should return empty builds when none saved', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const result = rpcGetBuilds(mockCtx, mockLogger, mockNk, '');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(Object.keys(parsed.builds).length).toBe(0);
    });
  });

  describe('rpcRespecStats', () => {
    const existingStats: PlayerStats = {
      user_id: 'test-user-123',
      level: 5,
      xp: 500,
      ability_points: 4,
      stats: { attack: 15, defense: 12, dodge: 10, crit_rate: 5 },
    };

    it('should reject invalid payload', () => {
      const payload = JSON.stringify({ bad_field: true });
      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });

    it('should reject when player stats not found', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({
        new_allocation: { attack: 15, defense: 12, dodge: 10, crit_rate: 5 },
        use_free_respec: false,
      });
      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Player stats not found');
    });

    it('should reject when allocation total does not match', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user-123',
          userId: 'test-user-123',
          value: JSON.stringify(existingStats),
        },
      ]);

      const payload = JSON.stringify({
        new_allocation: { attack: 50, defense: 12, dodge: 10, crit_rate: 5 },
        use_free_respec: false,
      });
      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain('Total stat points must match');
    });

    it('should perform free respec successfully', () => {
      const respecData = {
        last_respec_time: 0,
        free_respecs_used: 0,
        current_season_id: 'season1',
      };

      mockNk.storageRead = jest.fn().mockImplementation((keys: any[]) => {
        const collection = keys[0].collection;
        if (collection === 'player_stats') {
          return [
            {
              collection,
              key: 'test-user-123',
              userId: 'test-user-123',
              value: JSON.stringify(existingStats),
            },
          ];
        }
        if (collection === 'respec_data') {
          return [
            {
              collection,
              key: 'test-user-123',
              userId: 'test-user-123',
              value: JSON.stringify(respecData),
            },
          ];
        }
        return [];
      });

      const payload = JSON.stringify({
        new_allocation: { attack: 20, defense: 12, dodge: 10, crit_rate: 0 },
        use_free_respec: true,
      });
      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.used_free_respec).toBe(true);
      expect(parsed.cost_paid).toBe(0);
      expect(parsed.player_stats.stats.attack).toBe(20);
    });

    it('should pay respec cost from the unified currency ledger (issue #860)', () => {
      const respecData = {
        last_respec_time: 0,
        free_respecs_used: 1, // free respec already used → paid path
        current_season_id: 'season1',
      };
      const currency = { user_id: 'test-user', gems: 10000, coins: 0 };

      mockNk.storageRead = jest.fn().mockImplementation((keys: any[]) => {
        const collection = keys[0].collection;
        if (collection === 'player_stats') {
          return [{ collection, key: 'test-user-123', value: JSON.stringify(existingStats) }];
        }
        if (collection === 'respec_data') {
          return [{ collection, key: 'test-user-123', value: JSON.stringify(respecData) }];
        }
        if (collection === 'player_currency') {
          return [{ collection, key: 'test-user', value: JSON.stringify(currency) }];
        }
        return [];
      });

      const payload = JSON.stringify({
        new_allocation: { attack: 20, defense: 12, dodge: 10, crit_rate: 0 },
        use_free_respec: false,
      });
      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.cost_paid).toBe(500); // 5% of 10000, clamped [100, 1000]

      // The cost is debited from the player_currency ledger — not the
      // write-only wallet key the old path used.
      const ledgerRaw = testStorage.get('player_currency:test-user');
      expect(ledgerRaw).toBeDefined();
      expect(JSON.parse(ledgerRaw!).gems).toBe(9500);
      expect(mockNk.walletUpdate).not.toHaveBeenCalled();
    });

    it('should reject paid respec when the ledger balance is insufficient', () => {
      const respecData = {
        last_respec_time: 0,
        free_respecs_used: 1,
        current_season_id: 'season1',
      };
      const currency = { user_id: 'test-user', gems: 50, coins: 0 };

      mockNk.storageRead = jest.fn().mockImplementation((keys: any[]) => {
        const collection = keys[0].collection;
        if (collection === 'player_stats') {
          return [{ collection, key: 'test-user-123', value: JSON.stringify(existingStats) }];
        }
        if (collection === 'respec_data') {
          return [{ collection, key: 'test-user-123', value: JSON.stringify(respecData) }];
        }
        if (collection === 'player_currency') {
          return [{ collection, key: 'test-user', value: JSON.stringify(currency) }];
        }
        return [];
      });

      const payload = JSON.stringify({
        new_allocation: { attack: 20, defense: 12, dodge: 10, crit_rate: 0 },
        use_free_respec: false,
      });
      const result = rpcRespecStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Minimum cost is 100 gems; balance of 50 cannot pay it
      expect(parsed.error).toContain('Not enough gems');
      expect(parsed.cost).toBe(100);
    });
  });

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
});
