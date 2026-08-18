import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';

import {
  rpcGetSeasonInfo,
  rpcGetLeaderboard,
  rpcGetSeasonRewards,
  rpcClaimSeasonRewards,
  rpcEndSeason,
  registerRpcGetSeasonInfo,
  registerRpcGetLeaderboard,
  registerRpcGetSeasonRewards,
  registerRpcClaimSeasonRewards,
  registerRpcEndSeason,
  applyEloUpdates,
  getEloKFactors,
  BASE_K_FACTOR,
  PUNCH_UP_K_FACTOR,
  PUNCH_UP_LOSS_K_MULTIPLIER,
  calculateSoftResetElo,
  evaluatePrestigeTiers,
  updatePlayerPrestigeRecord,
  grantPrestigeRewards,
  rpcGetPrestigeProgress,
  rpcGetProjectedNextSeasonElo,
  registerRpcGetPrestigeProgress,
  registerRpcGetProjectedNextSeasonElo,
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

  describe('update_rank removal (issue #1076)', () => {
    it('must not export a client-callable rpcUpdateRank handler', () => {
      const mod = require('../season_system');
      expect(mod.rpcUpdateRank).toBeUndefined();
      expect(mod.registerRpcUpdateRank).toBeUndefined();
    });

    it('must not register armored_archer/update_rank via any registerRpc* export', () => {
      const mod = require('../season_system');
      const registeredIds: string[] = [];
      const mockInitializer = {
        registerRpc: jest.fn((id: string) => registeredIds.push(id)),
      } as unknown as Runtime.Initializer;

      Object.keys(mod)
        .filter((name: string) => name.startsWith('registerRpc'))
        .forEach((name: string) => mod[name](mockInitializer));

      expect(registeredIds).not.toContain('armored_archer/update_rank');
    });

    it('must not export settlement helpers that accept client-declared winners', () => {
      // ADR-0002: only complete_match's resolveServerTerminalState path may
      // mutate Elo, via the exported applyEloUpdates used by matchmaker.ts.
      // The client-facing wrapper around it must stay gone.
      const mod = require('../season_system');
      expect(typeof mod.applyEloUpdates).toBe('function');
      expect(mod.validateRankUpdateSignature).toBeUndefined();
      expect(mod.checkPlayerFlagged).toBeUndefined();
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
        null,
        false
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
        null,
        false
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
        null,
        false
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
        null,
        false
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
      expect(rewards.coins).toBe(8500);
      expect(rewards.gems).toBe(600);
      expect(rewards.cosmetics).toBeDefined();
    });

    it('should return epic rewards for rank 11-50', () => {
      const { calculateRewards } = require('../season_system');
      const rewards = calculateRewards(25, 5);
      expect(rewards.rank_tier).toBe('epic');
      expect(rewards.coins).toBe(4500);
      expect(rewards.gems).toBe(250);
    });

    it('should return rare rewards for rank 51-100', () => {
      const { calculateRewards } = require('../season_system');
      const rewards = calculateRewards(75, 5);
      expect(rewards.rank_tier).toBe('rare');
      expect(rewards.coins).toBe(2200);
      expect(rewards.gems).toBe(125);
    });

    it('should return uncommon rewards for rank 101-500', () => {
      const { calculateRewards } = require('../season_system');
      const rewards = calculateRewards(200, 5);
      expect(rewards.rank_tier).toBe('uncommon');
      expect(rewards.coins).toBe(750);
      expect(rewards.gems).toBe(25);
    });

    it('should return common rewards for rank >500', () => {
      const { calculateRewards } = require('../season_system');
      const rewards = calculateRewards(600, 5);
      expect(rewards.rank_tier).toBe('common');
      expect(rewards.coins).toBe(250);
      expect(rewards.gems).toBe(10);
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

  describe('registerRpcGetSeasonRewards', () => {
    it('should register the get season rewards RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcGetSeasonRewards(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_season_rewards',
        expect.any(Function)
      );
    });
  });

  describe('registerRpcClaimSeasonRewards', () => {
    it('should register the claim season rewards RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcClaimSeasonRewards(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/claim_season_rewards',
        expect.any(Function)
      );
    });
  });

  describe('registerRpcEndSeason', () => {
    it('should register the end season RPC endpoint', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcEndSeason(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/end_season',
        expect.any(Function)
      );
    });
  });

  describe('calculateSoftResetElo', () => {
    it('should return correct elo for top ranks', () => {
      const elo = calculateSoftResetElo(1);
      expect(elo).toBeGreaterThan(1000);
    });

    it('should return default 1000 for very low ranks', () => {
      const elo = calculateSoftResetElo(10000);
      expect(elo).toBe(1000);
    });
  });

  describe('evaluatePrestigeTiers', () => {
    it('should return empty for no finishes', () => {
      const tiers = evaluatePrestigeTiers([]);
      expect(tiers).toEqual([]);
    });

    it('should earn bronze after 2 qualifying seasons', () => {
      const finishes = [
        { season_id: 'season_1', rank: 50 },
        { season_id: 'season_2', rank: 30 },
      ];
      const tiers = evaluatePrestigeTiers(finishes);
      expect(tiers).toContain('bronze');
    });

    it('should not earn tier without enough qualifying seasons', () => {
      const finishes = [{ season_id: 'season_1', rank: 50 }];
      const tiers = evaluatePrestigeTiers(finishes);
      expect(tiers).not.toContain('bronze');
    });

    it('should not count same season twice', () => {
      const finishes = [
        { season_id: 'season_1', rank: 50 },
        { season_id: 'season_1', rank: 30 },
      ];
      const tiers = evaluatePrestigeTiers(finishes);
      expect(tiers).not.toContain('bronze');
    });
  });

  describe('updatePlayerPrestigeRecord', () => {
    it('should add a qualifying season finish', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      mockNk.storageWrite = jest.fn();

      const result = updatePlayerPrestigeRecord(mockNk, 'player-1', 'season_1', 10);

      expect(result.record.season_finishes).toHaveLength(1);
      expect(result.record.season_finishes[0].rank).toBe(10);
      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should update existing season finish with better rank', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          value: JSON.stringify({
            player_id: 'player-1',
            season_finishes: [{ season_id: 'season_1', rank: 50 }],
            prestige_tiers_earned: [],
            last_updated: 0,
          }),
        },
      ]);
      mockNk.storageWrite = jest.fn();

      const result = updatePlayerPrestigeRecord(mockNk, 'player-1', 'season_1', 10);

      expect(result.record.season_finishes[0].rank).toBe(10);
    });

    it('should skip non-qualifying ranks above 100', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      mockNk.storageWrite = jest.fn();

      const result = updatePlayerPrestigeRecord(mockNk, 'player-1', 'season_1', 200);

      expect(result.record.season_finishes).toHaveLength(0);
    });

    it('should detect newly earned tiers', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          value: JSON.stringify({
            player_id: 'player-1',
            season_finishes: [{ season_id: 'season_1', rank: 50 }],
            prestige_tiers_earned: [],
            last_updated: 0,
          }),
        },
      ]);
      mockNk.storageWrite = jest.fn();

      const result = updatePlayerPrestigeRecord(mockNk, 'player-1', 'season_2', 30);

      expect(result.new_tiers).toContain('bronze');
    });
  });

  describe('grantPrestigeRewards', () => {
    it('should add cosmetics for each new tier', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      mockNk.storageWrite = jest.fn();

      grantPrestigeRewards(mockNk, 'player-1', ['bronze']);

      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should handle empty tiers array', () => {
      mockNk.storageWrite = jest.fn();

      grantPrestigeRewards(mockNk, 'player-1', []);

      expect(mockNk.storageWrite).not.toHaveBeenCalled();
    });
  });

  describe('rpcEndSeason with players', () => {
    it('should distribute rewards to all players', () => {
      const players = [
        createMockLeaderboardRecord({ ownerId: 'player-1', rank: 5, score: 2000 }),
        createMockLeaderboardRecord({ ownerId: 'player-2', rank: 50, score: 1500 }),
      ];
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue(players);
      mockNk.walletUpdate = jest.fn();
      mockNk.storageWrite = jest.fn();
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      mockNk.leaderboardRecordWrite = jest.fn();

      const payload = JSON.stringify({});
      const result = rpcEndSeason(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      // Issue #860: season rewards land in the unified player_currency
      // storage ledger (not the wallet) so they are visible + spendable.
      const currencyWrites = mockNk.storageWrite.mock.calls.filter(
        (call: any[]) => call[0][0].collection === 'player_currency'
      );
      expect(currencyWrites).toHaveLength(2);
      const awardedPlayers = currencyWrites.map((call: any[]) => call[0][0].userId);
      expect(awardedPlayers).toContain('player-1');
      expect(awardedPlayers).toContain('player-2');
      for (const call of currencyWrites) {
        const record = JSON.parse(call[0][0].value);
        expect(record.gems).toBeGreaterThanOrEqual(0);
        expect(record.coins).toBeGreaterThanOrEqual(0);
      }
    });

    it('should seed players into new season with soft-reset elo', () => {
      const players = [
        createMockLeaderboardRecord({
          ownerId: 'player-1',
          username: 'Player1',
          rank: 1,
          score: 2500,
        }),
      ];
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue(players);
      mockNk.walletUpdate = jest.fn();
      mockNk.storageWrite = jest.fn();
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      mockNk.leaderboardRecordWrite = jest.fn();

      const payload = JSON.stringify({});
      rpcEndSeason(mockCtx, mockLogger, mockNk, payload);

      expect(mockNk.leaderboardRecordWrite).toHaveBeenCalled();
      const allCalls = mockNk.leaderboardRecordWrite.mock.calls;
      const seedingCall = allCalls.find((call: any[]) => !call[0].startsWith('season_1'));
      expect(seedingCall).toBeDefined();
      expect(seedingCall![1]).toBe('player-1');
    });

    it('should handle players with cosmetic rewards', () => {
      const players = [createMockLeaderboardRecord({ ownerId: 'player-1', rank: 5, score: 2000 })];
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue(players);
      mockNk.walletUpdate = jest.fn();
      mockNk.storageWrite = jest.fn();
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      mockNk.leaderboardRecordWrite = jest.fn();

      const payload = JSON.stringify({});
      const result = rpcEndSeason(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should handle pagination when many players exist', () => {
      const batch1 = Array.from({ length: 500 }, (_, i) =>
        createMockLeaderboardRecord({ ownerId: `player-${i}`, rank: i + 1, score: 2000 - i })
      );
      const batch2 = Array.from({ length: 10 }, (_, i) =>
        createMockLeaderboardRecord({
          ownerId: `player-${500 + i}`,
          rank: 501 + i,
          score: 1490 - i,
        })
      );

      let callCount = 0;
      mockNk.leaderboardRecordList = jest.fn(() => {
        callCount++;
        if (callCount === 1) return batch1;
        if (callCount === 2) return batch2;
        return [];
      });
      mockNk.walletUpdate = jest.fn();
      mockNk.storageWrite = jest.fn();
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      mockNk.leaderboardRecordWrite = jest.fn();

      const payload = JSON.stringify({});
      const result = rpcEndSeason(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(mockNk.leaderboardRecordList).toHaveBeenCalled();
    });

    it('should handle empty leaderboard', () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);
      mockNk.storageWrite = jest.fn();
      mockNk.leaderboardRecordWrite = jest.fn();

      const payload = JSON.stringify({});
      const result = rpcEndSeason(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      // No players → no currency ledger writes
      const currencyWrites = mockNk.storageWrite.mock.calls.filter(
        (call: any[]) => call[0][0].collection === 'player_currency'
      );
      expect(currencyWrites).toHaveLength(0);
    });

    it('should handle prestige tier upgrades for qualifying players', () => {
      mockNk.storageRead = jest.fn((objects: any[]) => {
        for (const obj of objects) {
          if (obj.collection === 'player_prestige') {
            return [
              {
                value: JSON.stringify({
                  player_id: obj.key,
                  season_finishes: [{ season_id: 'season_1', rank: 50 }],
                  prestige_tiers_earned: [],
                  last_updated: 0,
                }),
              },
            ];
          }
        }
        return [];
      });

      const players = [createMockLeaderboardRecord({ ownerId: 'player-1', rank: 30, score: 2000 })];
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue(players);
      mockNk.walletUpdate = jest.fn();
      mockNk.storageWrite = jest.fn();
      mockNk.leaderboardRecordWrite = jest.fn();

      const payload = JSON.stringify({});
      const result = rpcEndSeason(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });
  });

  describe('rpcClaimSeasonRewards advanced', () => {
    it('should claim rewards and credit the unified currency ledger', () => {
      const record = createMockLeaderboardRecord({ rank: 5 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      mockNk.storageWrite = jest.fn();

      const payload = JSON.stringify({});
      const result = rpcClaimSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.claimed).toBe(true);
      // Issue #860: claimed rewards land in the player_currency storage
      // ledger — never in the (write-only) Nakama wallet.
      const currencyWrites = mockNk.storageWrite.mock.calls.filter(
        (call: any[]) => call[0][0].collection === 'player_currency'
      );
      expect(currencyWrites).toHaveLength(1);
      const ledgerRecord = JSON.parse(currencyWrites[0][0][0].value);
      expect(ledgerRecord.user_id).toBe('test-user');
      expect(ledgerRecord.gems).toBeGreaterThan(0);
      expect(ledgerRecord.coins).toBeGreaterThan(0);
      expect(mockNk.walletUpdate).not.toHaveBeenCalled();
    });

    it('should handle validation error', () => {
      const payload = 'invalid-json';

      const result = rpcClaimSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
    });
  });

  describe('rpcGetSeasonRewards advanced', () => {
    it('should handle validation error', () => {
      const payload = 'invalid-json';

      const result = rpcGetSeasonRewards(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
    });
  });

  describe('rpcGetSeasonInfo additional branches', () => {
    it('should return player_score 0 when no entry', () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({});
      const result = rpcGetSeasonInfo(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.player_rank).toBeNull();
      expect(parsed.player_score).toBe(0);
    });
  });

  describe('rpcGetLeaderboard additional branches', () => {
    it('should use default limit when not specified', () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({});
      const result = rpcGetLeaderboard(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(mockNk.leaderboardRecordList).toHaveBeenCalledWith(expect.any(String), [], 50, '', 0);
    });

    it('should use specified limit', () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({ limit: 10 });
      const result = rpcGetLeaderboard(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(mockNk.leaderboardRecordList).toHaveBeenCalledWith(expect.any(String), [], 10, '', 0);
    });
  });

  describe('applyEloUpdates additional branches', () => {
    it('should handle missing loser entry', () => {
      mockNk.leaderboardRecordWrite = jest.fn();

      const result = applyEloUpdates(
        mockNk,
        mockCtx,
        { season_id: 'season_1' },
        'winner',
        'loser',
        1500,
        1500,
        false,
        null,
        null,
        false
      );

      expect(result.loserNewElo).toBeLessThan(1500);
    });

    it('should use higher K-factor for punch-up wins', () => {
      mockNk.leaderboardRecordWrite = jest.fn();

      const normalResult = applyEloUpdates(
        mockNk,
        mockCtx,
        { season_id: 'season_1' },
        'winner',
        'loser',
        1200,
        1000,
        false,
        null,
        null,
        false
      );

      mockNk.leaderboardRecordWrite = jest.fn();
      const punchUpResult = applyEloUpdates(
        mockNk,
        mockCtx,
        { season_id: 'season_1' },
        'winner',
        'loser',
        1200,
        1000,
        true,
        null,
        null,
        false
      );

      const normalDelta = normalResult.winnerNewElo - 1200;
      const punchUpDelta = punchUpResult.winnerNewElo - 1200;
      expect(punchUpDelta).toBeGreaterThan(normalDelta);
    });
  });

  describe('applyEloUpdates amplified punch-up loss (issue #864)', () => {
    // Favorite 1200 vs underdog 1100: expectedWinner = 0.64006,
    // expectedLoser = 0.35994.
    // - Amplified loss deduction:  round(1100 - 100 * 0.35994) = 1064 (drop of 36)
    // - Non-amplified punch-up:    round(1100 - 50  * 0.35994) = 1082 (drop of 18)
    // - Winner (favorite) gain:    round(1200 + 50  * 0.35994) = 1218
    const FAVORITE_ELO = 1200;
    const UNDERDOG_ELO = 1100;

    const settle = (isPunchUp: boolean, loserIsUnderdog: boolean) => {
      mockNk.leaderboardRecordWrite = jest.fn();
      const { applyEloUpdates } = require('../season_system');
      return applyEloUpdates(
        mockNk,
        mockCtx,
        { season_id: 'season_1' },
        'favorite',
        'underdog',
        FAVORITE_ELO,
        UNDERDOG_ELO,
        isPunchUp,
        null,
        null,
        loserIsUnderdog
      );
    };

    it('deducts the underdog punch-up loss at 2x the punch-up K-factor', () => {
      const amplified = settle(true, true);
      const nonAmplified = settle(true, false);

      const amplifiedDeduction = UNDERDOG_ELO - amplified.loserNewElo;
      const nonAmplifiedDeduction = UNDERDOG_ELO - nonAmplified.loserNewElo;

      // 2x K-factor: the deduction is exactly double (pre-rounding both are
      // K * expectedLoser, so doubling K doubles the deduction)
      expect(amplifiedDeduction).toBe(nonAmplifiedDeduction * 2);
      expect(amplified.loserNewElo).toBe(1064);
      expect(nonAmplified.loserNewElo).toBe(1082);
    });

    it('leaves the winner side unchanged by the amplified loser deduction', () => {
      const withAmplifiedLoser = settle(true, true);
      const withoutAmplifiedLoser = settle(true, false);

      expect(withAmplifiedLoser.winnerNewElo).toBe(withoutAmplifiedLoser.winnerNewElo);
      expect(withAmplifiedLoser.winnerNewElo).toBe(1218);
    });

    it('does not amplify losses in non-punch-up matches regardless of underdog flag', () => {
      const normalLoss = settle(false, true);
      const normalBaseline = settle(false, false);

      expect(normalLoss.loserNewElo).toBe(normalBaseline.loserNewElo);
      // Base K deduction: round(1100 - 32 * 0.35994) = 1088
      expect(normalLoss.loserNewElo).toBe(1088);
    });

    it('does not amplify a favorite losing a punch-up (upset)', () => {
      // Underdog 1200 wins... i.e. settle with the LOWER rated player winning:
      // winner 1100, loser 1200 — loser is the favorite, not the underdog.
      mockNk.leaderboardRecordWrite = jest.fn();
      const { applyEloUpdates } = require('../season_system');
      const upset = applyEloUpdates(
        mockNk,
        mockCtx,
        { season_id: 'season_1' },
        'underdog',
        'favorite',
        UNDERDOG_ELO,
        FAVORITE_ELO,
        true,
        null,
        null,
        false
      );

      // Loser is the 1200-rated favorite losing to the 1100-rated winner:
      // loserOld - winnerOld = +100 -> the favorite's expected score is high.
      const expectedLoser = 1 - 1 / (1 + Math.pow(10, (FAVORITE_ELO - UNDERDOG_ELO) / 400));
      // Plain punch-up K (50), NOT amplified
      expect(upset.loserNewElo).toBe(Math.round(FAVORITE_ELO - PUNCH_UP_K_FACTOR * expectedLoser));
    });

    it('exposes per-side K-factors for telemetry', () => {
      expect(getEloKFactors(false, false)).toEqual({ winnerK: BASE_K_FACTOR, loserK: BASE_K_FACTOR });
      expect(getEloKFactors(false, true)).toEqual({ winnerK: BASE_K_FACTOR, loserK: BASE_K_FACTOR });
      expect(getEloKFactors(true, false)).toEqual({
        winnerK: PUNCH_UP_K_FACTOR,
        loserK: PUNCH_UP_K_FACTOR,
      });
      expect(getEloKFactors(true, true)).toEqual({
        winnerK: PUNCH_UP_K_FACTOR,
        loserK: PUNCH_UP_K_FACTOR * PUNCH_UP_LOSS_K_MULTIPLIER,
      });
    });
  });

  describe('calculateSoftResetElo additional branches', () => {
    it('should return 1300 for rank 1-10', () => {
      expect(calculateSoftResetElo(1)).toBe(1300);
      expect(calculateSoftResetElo(10)).toBe(1300);
    });

    it('should return 1200 for rank 11-50', () => {
      expect(calculateSoftResetElo(25)).toBe(1200);
    });

    it('should return 1150 for rank 51-100', () => {
      expect(calculateSoftResetElo(75)).toBe(1150);
    });

    it('should return 1100 for rank 101-500', () => {
      expect(calculateSoftResetElo(200)).toBe(1100);
    });
  });

  describe('rpcGetPrestigeProgress', () => {
    it('should return prestige progress for a player', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          value: JSON.stringify({
            player_id: 'test-user',
            season_finishes: [
              { season_id: 'season_1', rank: 50 },
              { season_id: 'season_2', rank: 30 },
            ],
            prestige_tiers_earned: [],
            last_updated: Date.now(),
          }),
        },
      ]);

      const result = rpcGetPrestigeProgress(mockCtx, mockLogger, mockNk, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.prestige).toBeDefined();
      expect(parsed.prestige.season_finishes).toHaveLength(2);
      expect(parsed.prestige.tier_progress).toBeDefined();
    });

    it('should handle player with no prestige record', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const result = rpcGetPrestigeProgress(mockCtx, mockLogger, mockNk, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.prestige.season_finishes).toHaveLength(0);
    });
  });

  describe('rpcGetProjectedNextSeasonElo', () => {
    it('should return projected ELO when player has leaderboard entry', () => {
      const record = createMockLeaderboardRecord({ rank: 5, score: 2500 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);

      const result = rpcGetProjectedNextSeasonElo(mockCtx, mockLogger, mockNk, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.projected_elo).toBe(1300);
      expect(parsed.tier_name).toBe('Legendary');
      expect(parsed.current_rank).toBe(5);
    });

    it('should return default ELO when player has no leaderboard entry', () => {
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([]);

      const result = rpcGetProjectedNextSeasonElo(mockCtx, mockLogger, mockNk, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.projected_elo).toBe(1000);
      expect(parsed.tier_name).toBe('Unranked');
    });

    it('should return correct tier for rank 30', () => {
      const record = createMockLeaderboardRecord({ rank: 30, score: 1800 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);

      const result = rpcGetProjectedNextSeasonElo(mockCtx, mockLogger, mockNk, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.tier_name).toBe('Epic');
    });

    it('should return correct tier for rank 200', () => {
      const record = createMockLeaderboardRecord({ rank: 200, score: 1200 });
      mockNk.leaderboardRecordList = jest.fn().mockReturnValue([record]);

      const result = rpcGetProjectedNextSeasonElo(mockCtx, mockLogger, mockNk, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.tier_name).toBe('Uncommon');
    });
  });

  describe('registerRpcGetPrestigeProgress', () => {
    it('should register the RPC endpoint', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      registerRpcGetPrestigeProgress(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_prestige_progress',
        expect.any(Function)
      );
    });
  });

  describe('registerRpcGetProjectedNextSeasonElo', () => {
    it('should register the RPC endpoint', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      registerRpcGetProjectedNextSeasonElo(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_projected_next_season_elo',
        expect.any(Function)
      );
    });
  });
});
