import { createMockLogger, createMockContext, createMockNakama } from "../../__mocks__/nakama";
import { 
  rpcGetSeasonInfo, 
  rpcGetLeaderboard, 
  rpcUpdateRank,
  rpcGetSeasonRewards,
  rpcClaimSeasonRewards,
  rpcEndSeason,
  SeasonInfo
} from "../season_system";
import { Runtime } from "../../types/nakama";

describe('season_system', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: "test-user", username: "TestPlayer" });
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  const createMockLeaderboardRecord = (overrides?: any) => ({
    ownerId: "test-user",
    username: "TestPlayer",
    rank: 1,
    score: 1500,
    metadata: JSON.stringify({ wins: 10, losses: 2, win_rate: 0.83, punch_up_wins: 3 }),
    expiry: 0,
    maxNumScore: 0,
    numScore: 0,
    ...overrides
  });

  describe('rpcGetSeasonInfo', () => {
    it('should return current season info', () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({});
      const result = rpcGetSeasonInfo(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.season).toBeDefined();
      expect(parsed.season.season_id).toBeDefined();
      expect(parsed.season.status).toBe("active");
    });

    it('should include player rank when available', () => {
      const record = createMockLeaderboardRecord();
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);

      const payload = JSON.stringify({});
      const result = rpcGetSeasonInfo(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.player_rank).toBe(1);
    });
  });

  describe('rpcGetLeaderboard', () => {
    it('should return leaderboard entries', () => {
      const records = [
        createMockLeaderboardRecord({ ownerId: "user1", rank: 1, score: 2000 }),
        createMockLeaderboardRecord({ ownerId: "user2", rank: 2, score: 1800 }),
      ];
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue(records);

      const payload = JSON.stringify({ limit: 50 });
      const result = rpcGetLeaderboard(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.leaderboard).toHaveLength(2);
    });

    it('should respect limit parameter', () => {
      const records = Array.from({ length: 100 }, (_, i) => 
        createMockLeaderboardRecord({ ownerId: `user${i}`, rank: i + 1, score: 2000 - i * 10 })
      );
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue(records);

      const payload = JSON.stringify({ limit: 10 });
      const result = rpcGetLeaderboard(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.leaderboard).toHaveLength(100);
    });
  });

  describe('rpcUpdateRank', () => {
    it('should update rank for winner and loser', () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({
        match_id: "match-123",
        winner_id: "winner-user",
        loser_id: "loser-user",
        winner_old_rank: 1500,
        loser_old_rank: 1400,
        winner_new_rank: 1520,
        loser_new_rank: 1380,
        is_punch_up: false
      });
      const result = rpcUpdateRank(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.winner).toBeDefined();
      expect(parsed.loser).toBeDefined();
      expect(parsed.winner.rank_change).toBeGreaterThan(0);
    });

    it('should handle new players without existing entry', () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({
        match_id: "match-456",
        winner_id: "new-winner",
        loser_id: "new-loser",
        winner_old_rank: 1000,
        loser_old_rank: 1000,
        winner_new_rank: 1032,
        loser_new_rank: 968,
        is_punch_up: true
      });
      const result = rpcUpdateRank(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.is_punch_up).toBe(true);
    });

    it('should validate input payload', () => {
      const payload = JSON.stringify({
        winner_id: "",
        loser_id: "loser",
        is_punch_up: "not a boolean"
      });
      const result = rpcUpdateRank(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe("VALIDATION_ERROR");
    });
  });

  describe('rpcGetSeasonRewards', () => {
    it('should return null rewards when no leaderboard entry', () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({});
      const result = rpcGetSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rewards).toBeNull();
    });

    it('should return legendary rewards for top 10', () => {
      const record = createMockLeaderboardRecord({ rank: 5 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);

      const payload = JSON.stringify({});
      const result = rpcGetSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rewards).toBeDefined();
      expect(parsed.rewards.rank_tier).toBe("legendary");
    });

    it('should return epic rewards for ranks 11-50', () => {
      const record = createMockLeaderboardRecord({ rank: 25 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);

      const payload = JSON.stringify({});
      const result = rpcGetSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rewards.rank_tier).toBe("epic");
    });

    it('should return rare rewards for ranks 51-100', () => {
      const record = createMockLeaderboardRecord({ rank: 75 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);

      const payload = JSON.stringify({});
      const result = rpcGetSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rewards.rank_tier).toBe("rare");
    });

    it('should return uncommon rewards for ranks 101-500', () => {
      const record = createMockLeaderboardRecord({ rank: 200 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);

      const payload = JSON.stringify({});
      const result = rpcGetSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rewards.rank_tier).toBe("uncommon");
    });

    it('should return common rewards for ranks below 500', () => {
      const record = createMockLeaderboardRecord({ rank: 600 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);

      const payload = JSON.stringify({});
      const result = rpcGetSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rewards.rank_tier).toBe("common");
    });
  });

  describe('rpcClaimSeasonRewards', () => {
    it('should claim rewards successfully', () => {
      const record = createMockLeaderboardRecord({ rank: 5 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({});
      const result = rpcClaimSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rewards).toBeDefined();
      expect(parsed.claimed).toBe(true);
    });

    it('should return error when rewards already claimed', () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([createMockLeaderboardRecord()]);
      mockNk.storageRead = jest.fn().mockReturnValue([{
        collection: "season_rewards_claimed",
        key: "season_1_test-user",
        value: JSON.stringify({ claimed_at: Date.now() })
      }]);

      const payload = JSON.stringify({});
      const result = rpcClaimSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe("Rewards already claimed for this season");
    });

    it('should return error when no leaderboard entry', () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({});
      const result = rpcClaimSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe("No leaderboard entry found");
    });
  });

  describe('rpcEndSeason', () => {
    it('should end current season and create new one', () => {
      const payload = JSON.stringify({});
      const result = rpcEndSeason(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.old_season).toBeDefined();
      expect(parsed.new_season).toBeDefined();
      expect(parsed.new_season.season_number).toBeGreaterThan(parsed.old_season.season_number);
    });
  });
});
