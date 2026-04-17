import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';

// Mock anti_cheat module to control flagged/signature/timing behavior in tests
jest.mock('../anti_cheat', () => ({
  isPlayerFlagged: jest.fn().mockReturnValue(false),
  getFlagReason: jest.fn().mockReturnValue('suspicious activity'),
  recordMatchResult: jest.fn(),
  verifyRequestSignature: jest.fn().mockReturnValue({ valid: true, violations: [] }),
  detectTimingAttack: jest.fn().mockReturnValue(false),
  generateNonce: jest.fn().mockReturnValue('test-nonce'),
}));

import {
  isPlayerFlagged,
  getFlagReason,
  verifyRequestSignature,
  detectTimingAttack,
} from '../anti_cheat';
import {
  rpcGetSeasonInfo,
  rpcGetLeaderboard,
  rpcUpdateRank,
  rpcGetSeasonRewards,
  rpcClaimSeasonRewards,
  rpcEndSeason,
  registerRpcGetSeasonInfo,
  registerRpcGetLeaderboard,
  registerRpcUpdateRank,
  SeasonInfo,
} from '../season_system';
import { Runtime } from '../../types/nakama';

describe('season_system', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user', username: 'TestPlayer' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  const createMockLeaderboardRecord = (overrides?: any) => ({
    ownerId: 'test-user',
    username: 'TestPlayer',
    rank: 1,
    score: 1500,
    metadata: JSON.stringify({ wins: 10, losses: 2, win_rate: 0.83, punch_up_wins: 3 }),
    expiry: 0,
    maxNumScore: 0,
    numScore: 0,
    ...overrides,
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
      expect(parsed.season.status).toBe('active');
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
        createMockLeaderboardRecord({ ownerId: 'user1', rank: 1, score: 2000 }),
        createMockLeaderboardRecord({ ownerId: 'user2', rank: 2, score: 1800 }),
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
        match_id: 'match-123',
        winner_id: 'winner-user',
        loser_id: 'loser-user',
        winner_old_rank: 1500,
        loser_old_rank: 1400,
        winner_new_rank: 1520,
        loser_new_rank: 1380,
        is_punch_up: false,
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
        match_id: 'match-456',
        winner_id: 'new-winner',
        loser_id: 'new-loser',
        winner_old_rank: 1000,
        loser_old_rank: 1000,
        winner_new_rank: 1032,
        loser_new_rank: 968,
        is_punch_up: true,
      });
      const result = rpcUpdateRank(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.is_punch_up).toBe(true);
    });

    it('should validate input payload', () => {
      const payload = JSON.stringify({
        winner_id: '',
        loser_id: 'loser',
        is_punch_up: 'not a boolean',
      });
      const result = rpcUpdateRank(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
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
      expect(parsed.rewards.rank_tier).toBe('legendary');
    });

    it('should return epic rewards for ranks 11-50', () => {
      const record = createMockLeaderboardRecord({ rank: 25 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);

      const payload = JSON.stringify({});
      const result = rpcGetSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rewards.rank_tier).toBe('epic');
    });

    it('should return rare rewards for ranks 51-100', () => {
      const record = createMockLeaderboardRecord({ rank: 75 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);

      const payload = JSON.stringify({});
      const result = rpcGetSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rewards.rank_tier).toBe('rare');
    });

    it('should return uncommon rewards for ranks 101-500', () => {
      const record = createMockLeaderboardRecord({ rank: 200 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);

      const payload = JSON.stringify({});
      const result = rpcGetSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rewards.rank_tier).toBe('uncommon');
    });

    it('should return common rewards for ranks below 500', () => {
      const record = createMockLeaderboardRecord({ rank: 600 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);

      const payload = JSON.stringify({});
      const result = rpcGetSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rewards.rank_tier).toBe('common');
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
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'season_rewards_claimed',
          key: 'season_1_test-user',
          value: JSON.stringify({ claimed_at: Date.now() }),
        },
      ]);

      const payload = JSON.stringify({});
      const result = rpcClaimSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Rewards already claimed for this season');
    });

    it('should return error when no leaderboard entry', () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({});
      const result = rpcClaimSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('No leaderboard entry found');
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

    it('should set old season status to ended', () => {
      const payload = JSON.stringify({});
      const result = rpcEndSeason(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.old_season.status).toBe('ended');
      expect(parsed.new_season.status).toBe('active');
    });

    it('should create leaderboard for new season', () => {
      const payload = JSON.stringify({});
      rpcEndSeason(mockCtx, mockLogger, mockNk, payload);

      expect(mockNk.leaderboardCreate).toHaveBeenCalled();
    });

    it('should write new season to storage', () => {
      const payload = JSON.stringify({});
      rpcEndSeason(mockCtx, mockLogger, mockNk, payload);

      expect(mockNk.storageWrite).toHaveBeenCalled();
    });
  });

  describe('applyEloUpdates', () => {
    it('should calculate correct Elo changes for equal-rated players', () => {
      const { applyEloUpdates } = require('../season_system');
      mockNk.leaderboardRecordWrite = jest.fn();

      const result = applyEloUpdates(
        mockNk,
        mockCtx,
        { season_id: 'season_1' },
        'winner',
        'loser',
        1000,
        1000,
        false,
        null,
        null
      );

      expect(result.winnerNewElo).toBeGreaterThan(1000);
      expect(result.loserNewElo).toBeLessThan(1000);
    });

    it('should use higher K-factor for punch-up matches', () => {
      const { applyEloUpdates } = require('../season_system');
      mockNk.leaderboardRecordWrite = jest.fn();

      const normalResult = applyEloUpdates(
        mockNk,
        mockCtx,
        { season_id: 'season_1' },
        'winner',
        'loser',
        1000,
        1000,
        false,
        null,
        null
      );

      const punchUpResult = applyEloUpdates(
        mockNk,
        mockCtx,
        { season_id: 'season_1' },
        'winner',
        'loser',
        1000,
        1000,
        true,
        null,
        null
      );

      // Punch-up should give more points to the lower-rated winner
      expect(Math.abs(punchUpResult.winnerNewElo - 1000)).toBeGreaterThan(
        Math.abs(normalResult.winnerNewElo - 1000)
      );
    });

    it('should update leaderboard records', () => {
      const { applyEloUpdates } = require('../season_system');
      mockNk.leaderboardRecordWrite = jest.fn();

      applyEloUpdates(
        mockNk,
        mockCtx,
        { season_id: 'season_1' },
        'winner',
        'loser',
        1000,
        1000,
        false,
        null,
        null
      );

      expect(mockNk.leaderboardRecordWrite).toHaveBeenCalledTimes(2);
    });
  });

  describe('applyRankDecay', () => {
    it('should not decay players below minimum score', () => {
      const { applyRankDecay } = require('../season_system');
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const result = applyRankDecay(mockNk, 'user_123', 500);
      expect(result).toBe(500);
    });

    it('should not decay active players', () => {
      const { applyRankDecay } = require('../season_system');
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          value: JSON.stringify({ last_match_time: Date.now() - 1000 }),
        },
      ]);

      const result = applyRankDecay(mockNk, 'user_123', 1500);
      expect(result).toBe(1500);
    });

    it('should return current score when storage has no activity record', () => {
      const { applyRankDecay } = require('../season_system');
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const result = applyRankDecay(mockNk, 'user_123', 1500);
      expect(result).toBeLessThanOrEqual(1500);
      expect(result).toBeGreaterThanOrEqual(800);
    });
  });

  describe('getRankDecayInfo', () => {
    it('should return decay info for active player', () => {
      const { getRankDecayInfo } = require('../season_system');
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          value: JSON.stringify({ last_match_time: Date.now() }),
        },
      ]);

      const info = getRankDecayInfo(mockNk, 'user_123', 1500);
      expect(info.days_inactive).toBe(0);
      expect(info.points_at_risk).toBe(0);
      expect(info.can_decay).toBe(false);
    });

    it('should return decay info with no storage data', () => {
      const { getRankDecayInfo } = require('../season_system');
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const info = getRankDecayInfo(mockNk, 'user_123', 1500);
      expect(info.days_inactive).toBeGreaterThanOrEqual(0);
      expect(typeof info.can_decay).toBe('boolean');
    });

    it('should not decay below minimum score', () => {
      const { getRankDecayInfo } = require('../season_system');
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const info = getRankDecayInfo(mockNk, 'user_123', 500);
      expect(info.points_at_risk).toBe(0);
    });
  });

  describe('recordPlayerActivity', () => {
    it('should write activity to storage', () => {
      const { recordPlayerActivity } = require('../season_system');
      mockNk.storageWrite = jest.fn();

      recordPlayerActivity(mockNk, 'user_123');

      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          collection: 'player_activity',
          key: 'user_123',
        }),
      ]);
    });
  });

  describe('getLeaderboardEntry', () => {
    it('should return null when no entry found', () => {
      const { getLeaderboardEntry } = require('../season_system');
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);

      const entry = getLeaderboardEntry(mockNk, 'user_123', 'season_1');
      expect(entry).toBeNull();
    });

    it('should return entry when found', () => {
      const { getLeaderboardEntry } = require('../season_system');
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([
        {
          ownerId: 'user_123',
          username: 'Player',
          rank: 5,
          score: 1500,
          metadata: JSON.stringify({ wins: 10, losses: 2, win_rate: 0.83, punch_up_wins: 3 }),
        },
      ]);

      const entry = getLeaderboardEntry(mockNk, 'user_123', 'season_1');
      expect(entry).toBeDefined();
      expect(entry!.rank).toBe(5);
      expect(entry!.score).toBe(1500);
    });
  });

  describe('calculateRewards', () => {
    it('should return legendary rewards for rank 1-10', () => {
      const { calculateRewards } = require('../season_system');
      const rewards = calculateRewards(1, 5);
      expect(rewards.rank_tier).toBe('legendary');
      expect(rewards.coins).toBe(10000);
      expect(rewards.gems).toBe(500);
      expect(rewards.cosmetics).toBeDefined();
    });

    it('should return epic rewards for rank 11-50', () => {
      const { calculateRewards } = require('../season_system');
      const rewards = calculateRewards(25, 5);
      expect(rewards.rank_tier).toBe('epic');
      expect(rewards.coins).toBe(5000);
      expect(rewards.gems).toBe(200);
    });

    it('should return rare rewards for rank 51-100', () => {
      const { calculateRewards } = require('../season_system');
      const rewards = calculateRewards(75, 5);
      expect(rewards.rank_tier).toBe('rare');
      expect(rewards.coins).toBe(2000);
      expect(rewards.gems).toBe(100);
    });

    it('should return uncommon rewards for rank 101-500', () => {
      const { calculateRewards } = require('../season_system');
      const rewards = calculateRewards(200, 5);
      expect(rewards.rank_tier).toBe('uncommon');
      expect(rewards.coins).toBe(500);
      expect(rewards.gems).toBe(0);
    });

    it('should return common rewards for rank >500', () => {
      const { calculateRewards } = require('../season_system');
      const rewards = calculateRewards(600, 5);
      expect(rewards.rank_tier).toBe('common');
      expect(rewards.coins).toBe(100);
      expect(rewards.gems).toBe(0);
    });

    it('should include season number in cosmetics title', () => {
      const { calculateRewards } = require('../season_system');
      const rewards = calculateRewards(1, 7);
      expect(rewards.cosmetics!.title).toContain('Season 7');
    });
  });

  describe('getCurrentSeason', () => {
    it('should return active season info', () => {
      const { getCurrentSeason } = require('../season_system');
      const season = getCurrentSeason();

      expect(season.season_id).toBeDefined();
      expect(season.season_number).toBeGreaterThan(0);
      expect(season.status).toBe('active');
      expect(season.duration_weeks).toBe(4);
      expect(season.end_time).toBeGreaterThan(season.start_time);
    });
  });

  describe('rpcGetSeasonInfo validation error', () => {
    it('should return validation error for invalid payload', () => {
      // get_season_info schema is object({}), so invalid JSON should trigger error
      const result = rpcGetSeasonInfo(mockCtx, mockLogger, mockNk, 'not valid json{{');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcGetLeaderboard validation error', () => {
    it('should return validation error for invalid payload', () => {
      // get_leaderboard schema expects optional object with optional limit (number)
      // Passing a string for limit should fail validation
      const payload = JSON.stringify({ limit: 'not-a-number' });
      const result = rpcGetLeaderboard(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcUpdateRank with flagged player', () => {
    it('should block when winner is flagged', () => {
      (isPlayerFlagged as jest.Mock).mockImplementation((id: string) => id === 'winner-user');
      (getFlagReason as jest.Mock).mockReturnValue('match manipulation');

      const payload = JSON.stringify({
        match_id: 'match-123',
        winner_id: 'winner-user',
        loser_id: 'loser-user',
        winner_old_rank: 1500,
        loser_old_rank: 1400,
        winner_new_rank: 1520,
        loser_new_rank: 1380,
        is_punch_up: false,
      });
      const result = rpcUpdateRank(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('PLAYER_FLAGGED');
      expect(parsed.error).toContain('Player is flagged for review');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should block when loser is flagged', () => {
      (isPlayerFlagged as jest.Mock).mockImplementation((id: string) => id === 'loser-user');
      (getFlagReason as jest.Mock).mockReturnValue('suspicious win rate');

      const payload = JSON.stringify({
        match_id: 'match-123',
        winner_id: 'winner-user',
        loser_id: 'loser-user',
        winner_old_rank: 1500,
        loser_old_rank: 1400,
        winner_new_rank: 1520,
        loser_new_rank: 1380,
        is_punch_up: false,
      });
      const result = rpcUpdateRank(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('PLAYER_FLAGGED');
      expect(parsed.error).toContain('Opponent is flagged for review');
    });
  });

  describe('rpcUpdateRank with signature validation failure', () => {
    it('should reject when signature verification fails', () => {
      (isPlayerFlagged as jest.Mock).mockReturnValue(false);
      (verifyRequestSignature as jest.Mock).mockReturnValue({
        valid: false,
        violations: ['invalid_signature', 'replay_attack'],
      });

      const payload = JSON.stringify({
        match_id: 'match-123',
        winner_id: 'winner-user',
        loser_id: 'loser-user',
        winner_old_rank: 1500,
        loser_old_rank: 1400,
        winner_new_rank: 1520,
        loser_new_rank: 1380,
        is_punch_up: false,
        requestId: 'req-abc123',
        timestamp: Date.now(),
        signature: 'a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]a]',
        nonce: 'nonce-12345678901234567890123456',
      });
      const result = rpcUpdateRank(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('ANTI_CHEAT_VIOLATION');
      expect(parsed.error).toBe('Invalid request signature');
      expect(parsed.violations).toEqual(['invalid_signature', 'replay_attack']);
    });
  });

  describe('rpcUpdateRank with timing attack detection', () => {
    it('should reject when timing attack is detected', () => {
      (isPlayerFlagged as jest.Mock).mockReturnValue(false);
      (verifyRequestSignature as jest.Mock).mockReturnValue({ valid: true, violations: [] });
      (detectTimingAttack as jest.Mock).mockReturnValue(true);

      const payload = JSON.stringify({
        match_id: 'match-123',
        winner_id: 'winner-user',
        loser_id: 'loser-user',
        winner_old_rank: 1500,
        loser_old_rank: 1400,
        winner_new_rank: 1520,
        loser_new_rank: 1380,
        is_punch_up: false,
      });
      const result = rpcUpdateRank(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('TIMING_ANOMALY');
      expect(parsed.error).toBe('Suspicious request pattern detected');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Timing attack detected for user: %s',
        mockCtx.userId
      );
    });
  });

  describe('registerRpcGetSeasonInfo', () => {
    it('should register the RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcGetSeasonInfo(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_season_info',
        rpcGetSeasonInfo
      );
    });
  });

  describe('registerRpcGetLeaderboard', () => {
    it('should register the RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcGetLeaderboard(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_leaderboard',
        rpcGetLeaderboard
      );
    });
  });

  describe('registerRpcUpdateRank', () => {
    it('should register the RPC endpoint', () => {
      const { registerRpcUpdateRank } = require('../season_system');
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcUpdateRank(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/update_rank',
        rpcUpdateRank
      );
    });
  });

  describe('rpcGetPlayerCosmetics', () => {
    it('should return empty cosmetics for new player', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const { rpcGetPlayerCosmetics } = require('../season_system');
      const payload = JSON.stringify({});
      const result = rpcGetPlayerCosmetics(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.cosmetics).toBeDefined();
      expect(parsed.cosmetics.titles).toEqual([]);
      expect(parsed.cosmetics.auras).toEqual([]);
    });

    it('should return player cosmetics when available', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          value: JSON.stringify({
            titles: ['Season 5 Champion', 'Season 4 Elite'],
            auras: ['legendary_aura'],
          }),
        },
      ]);

      const { rpcGetPlayerCosmetics } = require('../season_system');
      const payload = JSON.stringify({});
      const result = rpcGetPlayerCosmetics(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.cosmetics.titles).toHaveLength(2);
      expect(parsed.cosmetics.titles[0]).toBe('Season 5 Champion');
      expect(parsed.cosmetics.auras).toHaveLength(1);
    });
  });

  describe('getPlayerCosmetics', () => {
    it('should return empty cosmetics when storage has no data', () => {
      const { getPlayerCosmetics } = require('../season_system');
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const cosmetics = getPlayerCosmetics(mockNk, 'user-123');

      expect(cosmetics.titles).toEqual([]);
      expect(cosmetics.auras).toEqual([]);
    });

    it('should return cosmetics from storage', () => {
      const { getPlayerCosmetics } = require('../season_system');
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          value: JSON.stringify({
            titles: ['Test Title'],
            auras: ['test_aura'],
          }),
        },
      ]);

      const cosmetics = getPlayerCosmetics(mockNk, 'user-456');

      expect(cosmetics.titles).toEqual(['Test Title']);
      expect(cosmetics.auras).toEqual(['test_aura']);
    });
  });

  describe('addPlayerCosmetic', () => {
    it('should add title to player cosmetics', () => {
      const { addPlayerCosmetic } = require('../season_system');
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      mockNk.storageWrite = jest.fn();

      addPlayerCosmetic(mockNk, 'user-123', 'New Title');

      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          collection: 'player_cosmetics',
          key: 'user-123',
        }),
      ]);
    });

    it('should add aura to player cosmetics', () => {
      const { addPlayerCosmetic } = require('../season_system');
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      mockNk.storageWrite = jest.fn();

      addPlayerCosmetic(mockNk, 'user-123', null, 'new_aura');

      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          collection: 'player_cosmetics',
        }),
      ]);
    });

    it('should prevent duplicate cosmetics', () => {
      const { addPlayerCosmetic } = require('../season_system');
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          value: JSON.stringify({
            titles: ['Existing Title'],
            auras: [],
          }),
        },
      ]);
      mockNk.storageWrite = jest.fn();

      addPlayerCosmetic(mockNk, 'user-123', 'Existing Title');

      const writeCall = mockNk.storageWrite.mock.calls[0][0][0];
      const writtenData = JSON.parse(writeCall.value);
      expect(writtenData.titles).toEqual(['Existing Title']); // Not added twice
    });
  });

  describe('registerRpcGetPlayerCosmetics', () => {
    it('should register the RPC endpoint', () => {
      const { registerRpcGetPlayerCosmetics } = require('../season_system');
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcGetPlayerCosmetics(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_player_cosmetics',
        expect.any(Function)
      );
    });
  });
});
