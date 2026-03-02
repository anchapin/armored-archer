import { createMockLogger, createMockContext, createMockNakama } from "../../__mocks__/nakama";
import { 
  rpcHealthCheck, 
  rpcGetPlayerStats 
} from "../player_rpc";
import { Runtime } from "../../types/nakama";
import { PlayerStats } from "../../types/game";
import { initializeCaches } from "../../utils/cache";

describe('player_rpc', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: "test-user" });
    mockNk = createMockNakama();
    jest.clearAllMocks();
    initializeCaches(mockLogger);
  });

  describe('rpcHealthCheck', () => {
    it('should return healthy status', () => {
      const payload = JSON.stringify({});
      const result = rpcHealthCheck(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe("ok");
      expect(parsed.version).toBe("0.1.0");
      expect(parsed.timestamp).toBeDefined();
    });

    it('should accept empty payload', () => {
      const payload = "";
      const result = rpcHealthCheck(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe("ok");
    });
  });

  describe('rpcGetPlayerStats', () => {
    it('should return player stats from storage', () => {
      const stats: PlayerStats = {
        level: 10,
        xp: 1500,
        stats: { attack: 25, defense: 20, dodge: 15, crit_rate: 12 }
      };
      
      mockNk.storageRead = jest.fn().mockReturnValue([{
        collection: "player_stats",
        key: "test-user",
        value: JSON.stringify(stats)
      }]);

      const payload = JSON.stringify({});
      const result = rpcGetPlayerStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.level).toBe(10);
      expect(parsed.xp).toBe(1500);
      expect(parsed.stats.attack).toBe(25);
    });

    it('should return error when player stats not found', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({});
      const result = rpcGetPlayerStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe("Player stats not found");
    });

    it('should cache player stats', () => {
      const stats: PlayerStats = {
        level: 5,
        xp: 500,
        stats: { attack: 15, defense: 12, dodge: 10, crit_rate: 8 }
      };
      
      mockNk.storageRead = jest.fn().mockReturnValue([{
        collection: "player_stats",
        key: "test-user",
        value: JSON.stringify(stats)
      }]);

      const payload = JSON.stringify({});
      rpcGetPlayerStats(mockCtx, mockLogger, mockNk, payload);
      rpcGetPlayerStats(mockCtx, mockLogger, mockNk, payload);

      expect(mockNk.storageRead).toHaveBeenCalledTimes(1);
    });
  });
});
