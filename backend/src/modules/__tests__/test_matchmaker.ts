import { createMockLogger, createMockContext, createMockNakama } from "../../__mocks__/nakama";
import { rpcCreateMatch } from "../matchmaker";

const mockCtx = createMockContext();
const mockLogger = createMockLogger();
const mockNk = createMockNakama();

function createMockPlayerStats(overrides = {}): PlayerStats {
  return {
    level: 5,
    xp: 500,
    stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 8 },
    ...overrides,
  };
}

describe('rpcCreateMatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create a match with target opponent', () => {
    const playerStats = createMockPlayerStats();
    const targetPlayerStats = createMockPlayerStats();
    
    mockNk.storageRead = jest.fn((objects) => {
      console.log("storageRead called with:", objects);
      if (objects[0].key === "test-user-123") {
        console.log("Returning player stats for test-user-123");
        return [{ collection: "player_stats", key: "test-user-123", value: JSON.stringify(playerStats) }];
      } else if (objects[0].key === "target-user") {
        console.log("Returning player stats for target-user");
        return [{ collection: "player_stats", key: "target-user", value: JSON.stringify(targetPlayerStats) }];
      }
      console.log("No matching key found");
      return [];
    });

    const payload = JSON.stringify({ 
      match_type: "ranked", 
      target_opponent_id: "target-user" 
    });
    
    console.log("Calling rpcCreateMatch...");
    const result = rpcCreateMatch(mockCtx, mockLogger, mockNk, payload);
    console.log("Result:", typeof result, result);
    
    if (result) {
      const parsed = JSON.parse(result);
      console.log("Parsed result:", parsed);
      expect(parsed.success).toBe(true);
      expect(parsed.match.opponent_id).toBe("target-user");
    } else {
      expect(result).toBeDefined();
    }
  });
});