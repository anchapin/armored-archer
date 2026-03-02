import { createMockLogger, createMockContext, createMockNakama } from "../../__mocks__/nakama";
import { rpcGainXP, rpcAllocateStats, rpcGetPlayerStats, PlayerStats } from "../rpg_system";
import { Runtime } from "../../types/nakama";

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
      const payload = JSON.stringify({ xp_amount: 50, source: "pve" });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.player_stats.level).toBe(1);
      expect(parsed.xp_gained).toBe(50);
    });

    it('should add XP to existing player', () => {
      const existingStats: PlayerStats = {
        user_id: "test-user-123",
        level: 1,
        xp: 50,
        ability_points: 0,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }
      };
      
      mockNk.storageRead = jest.fn().mockReturnValue([{
        collection: "player_stats",
        key: "test-user-123",
        userId: "test-user-123",
        value: JSON.stringify(existingStats)
      }]);

      const payload = JSON.stringify({ xp_amount: 100, source: "pve" });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.player_stats.xp).toBe(150);
    });

    it('should level up when XP threshold is reached', () => {
      const existingStats: PlayerStats = {
        user_id: "test-user-123",
        level: 1,
        xp: 90,
        ability_points: 0,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }
      };
      
      mockNk.storageRead = jest.fn().mockReturnValue([{
        collection: "player_stats",
        key: "test-user-123",
        userId: "test-user-123",
        value: JSON.stringify(existingStats)
      }]);

      const payload = JSON.stringify({ xp_amount: 50, source: "pve" });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.player_stats.level).toBe(2);
      expect(parsed.levels_gained).toBe(1);
      expect(parsed.player_stats.ability_points).toBe(1);
    });

    it('should handle validation errors', () => {
      const payload = JSON.stringify({ xp_amount: -10, source: "invalid" });
      const result = rpcGainXP(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.error_code).toBe("VALIDATION_ERROR");
    });

    it('should handle multiple level ups', () => {
      const existingStats: PlayerStats = {
        user_id: "test-user-123",
        level: 1,
        xp: 50,
        ability_points: 0,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }
      };
      
      mockNk.storageRead = jest.fn().mockReturnValue([{
        collection: "player_stats",
        key: "test-user-123",
        userId: "test-user-123",
        value: JSON.stringify(existingStats)
      }]);

      const payload = JSON.stringify({ xp_amount: 1000, source: "pvp" });
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
        user_id: "test-user-123",
        level: 2,
        xp: 0,
        ability_points: 5,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }
      };
      
      mockNk.storageRead = jest.fn().mockReturnValue([{
        collection: "player_stats",
        key: "test-user-123",
        userId: "test-user-123",
        value: JSON.stringify(existingStats)
      }]);

      const payload = JSON.stringify({ stat_name: "attack", points: 3 });
      const result = rpcAllocateStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.player_stats.stats.attack).toBe(13);
      expect(parsed.player_stats.ability_points).toBe(2);
    });

    it('should return error when not enough ability points', () => {
      const existingStats: PlayerStats = {
        user_id: "test-user-123",
        level: 1,
        xp: 0,
        ability_points: 1,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }
      };
      
      mockNk.storageRead = jest.fn().mockReturnValue([{
        collection: "player_stats",
        key: "test-user-123",
        userId: "test-user-123",
        value: JSON.stringify(existingStats)
      }]);

      const payload = JSON.stringify({ stat_name: "attack", points: 5 });
      const result = rpcAllocateStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe("Not enough ability points");
    });

    it('should return error when player stats not found', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({ stat_name: "defense", points: 1 });
      const result = rpcAllocateStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe("Player stats not found");
    });

    it('should validate stat allocation input', () => {
      const payload = JSON.stringify({ stat_name: "invalid_stat", points: 1 });
      const result = rpcAllocateStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe("VALIDATION_ERROR");
    });
  });

  describe('rpcGetPlayerStats', () => {
    it('should return existing player stats', () => {
      const existingStats: PlayerStats = {
        user_id: "test-user-123",
        level: 5,
        xp: 500,
        ability_points: 10,
        stats: { attack: 20, defense: 15, dodge: 12, crit_rate: 8 }
      };
      
      mockNk.storageRead = jest.fn().mockReturnValue([{
        collection: "player_stats",
        key: "test-user-123",
        userId: "test-user-123",
        value: JSON.stringify(existingStats)
      }]);

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

      expect(parsed.error).toBe("Player stats not found");
    });
  });
});
