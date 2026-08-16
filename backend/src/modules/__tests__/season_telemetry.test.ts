/**
 * Season Telemetry Module Tests
 * @fileoverview Tests for rank inflation, reward concentration, and season progression velocity telemetry.
 */

import {
  logRankChange,
  logRewardClaim,
  captureRatingSnapshot,
  getSeasonTelemetrySummary,
  getRankInflation,
  getRewardConcentration,
  getProgressionVelocity,
  recordSeasonEndSnapshot,
  type RankChangeEvent,
  type RewardClaimEvent,
  type SeasonTelemetryQuery,
} from '../season_telemetry';
import { Runtime } from '../../types/nakama';

describe('Season Telemetry', () => {
  const mockNk: Runtime.Nakama = {
    storageRead: jest.fn().mockResolvedValue([]),
    storageWrite: jest.fn().mockResolvedValue(undefined),
    leaderboardRecordList: jest.fn().mockReturnValue([]),
    leaderboardRecordWrite: jest.fn(),
    leaderboardCreate: jest.fn(),
  } as unknown as Runtime.Nakama;

  const mockCtx: Runtime.Context = {
    userId: 'test-user-id',
    username: 'testuser',
    variables: {},
    env: {},
    sessionExpiry: Math.floor(Date.now() / 1000) + 3600,
  };

  const mockLogger: Runtime.Logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    (mockNk.storageRead as jest.Mock).mockResolvedValue([]);
    (mockNk.storageWrite as jest.Mock).mockResolvedValue(undefined);
    (mockNk.leaderboardRecordList as jest.Mock).mockReturnValue([]);
  });

  describe('logRankChange', () => {
    it('should store rank change event in storage', async () => {
      const event: RankChangeEvent = {
        event_id: 'rc_test_1',
        match_id: 'match_123',
        season_id: 'season_1',
        timestamp: Date.now(),
        winner_id: 'winner_1',
        loser_id: 'loser_1',
        winner_old_elo: 1000,
        winner_new_elo: 1016,
        winner_rank_delta: 16,
        loser_old_elo: 1000,
        loser_new_elo: 984,
        loser_rank_delta: -16,
        is_punch_up: false,
        k_factor: 32,
        days_into_season: 5,
      };

      await logRankChange(mockNk, event);

      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          collection: 'season_telemetry_rank_changes',
          key: 'rc_test_1',
          userId: '00000000-0000-0000-0000-000000000000',
        }),
      ]);
    });

    it('should auto-generate event_id if not provided', async () => {
      const event: RankChangeEvent = {
        event_id: '',
        match_id: 'match_123',
        season_id: 'season_1',
        timestamp: Date.now(),
        winner_id: 'winner_1',
        loser_id: 'loser_1',
        winner_old_elo: 1000,
        winner_new_elo: 1016,
        winner_rank_delta: 16,
        loser_old_elo: 1000,
        loser_new_elo: 984,
        loser_rank_delta: -16,
        is_punch_up: false,
        k_factor: 32,
        days_into_season: 5,
      };

      await logRankChange(mockNk, event);

      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          key: expect.stringMatching(/^rc_\d+_[a-z0-9]+$/),
        }),
      ]);
    });

    it('should handle storage write failure gracefully', async () => {
      (mockNk.storageWrite as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const event: RankChangeEvent = {
        event_id: 'rc_test_fail',
        match_id: 'match_123',
        season_id: 'season_1',
        timestamp: Date.now(),
        winner_id: 'winner_1',
        loser_id: 'loser_1',
        winner_old_elo: 1000,
        winner_new_elo: 1016,
        winner_rank_delta: 16,
        loser_old_elo: 1000,
        loser_new_elo: 984,
        loser_rank_delta: -16,
        is_punch_up: false,
        k_factor: 32,
        days_into_season: 5,
      };

      await expect(logRankChange(mockNk, event)).resolves.toBeUndefined();
    });
  });

  describe('logRewardClaim', () => {
    it('should store reward claim event in storage', async () => {
      const event: RewardClaimEvent = {
        event_id: 'rw_test_1',
        season_id: 'season_1',
        user_id: 'user_1',
        timestamp: Date.now(),
        rank: 5,
        rank_tier: 'legendary',
        coins_awarded: 10000,
        gems_awarded: 500,
        had_cosmetics: true,
      };

      await logRewardClaim(mockNk, event);

      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          collection: 'season_telemetry_reward_claims',
          key: 'rw_test_1',
        }),
      ]);
    });

    it('should auto-generate event_id if not provided', async () => {
      const event: RewardClaimEvent = {
        event_id: '',
        season_id: 'season_1',
        user_id: 'user_1',
        timestamp: Date.now(),
        rank: 100,
        rank_tier: 'rare',
        coins_awarded: 2000,
        gems_awarded: 100,
        had_cosmetics: true,
      };

      await logRewardClaim(mockNk, event);

      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          key: expect.stringMatching(/^rw_\d+_[a-z0-9]+$/),
        }),
      ]);
    });
  });

  describe('captureRatingSnapshot', () => {
    it('should compute percentiles from leaderboard data', async () => {
      const scores = [800, 900, 950, 1000, 1050, 1100, 1200, 1300, 1400, 1500];
      (mockNk.leaderboardRecordList as jest.Mock).mockReturnValue(
        scores.map((score) => ({ score, ownerId: `user_${score}` }))
      );

      const snapshot = await captureRatingSnapshot(mockNk, 'season_1', Date.now() - 28 * 86400000);

      expect(snapshot).not.toBeNull();
      expect(snapshot!.total_players).toBe(10);
      expect(snapshot!.avg_elo).toBe(1120);
      expect(snapshot!.base_elo_drift).toBe(120);
      expect(snapshot!.percentile_buckets.p10).toBe(800);
      expect(snapshot!.percentile_buckets.p99).toBe(1500);
    });

    it('should return null for empty leaderboard', async () => {
      (mockNk.leaderboardRecordList as jest.Mock).mockReturnValue([]);

      const snapshot = await captureRatingSnapshot(mockNk, 'season_1', Date.now());

      expect(snapshot).toBeNull();
    });
  });

  describe('getRankInflation', () => {
    it('should return stable drift when no snapshots exist', async () => {
      (mockNk.storageRead as jest.Mock).mockResolvedValue([]);

      const result = await getRankInflation(mockNk, 'season_1', Date.now() - 86400000, Date.now());

      expect(result.current_avg_elo).toBe(1000);
      expect(result.drift_direction).toBe('stable');
      expect(result.snapshots_analyzed).toBe(0);
    });

    it('should detect inflation when average drifts above 1010', async () => {
      const snapshots = [
        { season_id: 'season_1', timestamp: Date.now() - 3600000, avg_elo: 1050 },
        { season_id: 'season_1', timestamp: Date.now(), avg_elo: 1080 },
      ];
      (mockNk.storageRead as jest.Mock).mockResolvedValue(
        snapshots.map((s) => ({ value: JSON.stringify(s) }))
      );

      const result = await getRankInflation(
        mockNk,
        'season_1',
        Date.now() - 86400000 * 2,
        Date.now()
      );

      expect(result.current_avg_elo).toBe(1080);
      expect(result.drift_direction).toBe('inflating');
      expect(result.snapshots_analyzed).toBe(2);
      expect(result.historical_avg_trend).toEqual([1050, 1080]);
    });

    it('should detect deflation when average drifts below 990', async () => {
      const snapshots = [{ season_id: 'season_1', timestamp: Date.now(), avg_elo: 980 }];
      (mockNk.storageRead as jest.Mock).mockResolvedValue(
        snapshots.map((s) => ({ value: JSON.stringify(s) }))
      );

      const result = await getRankInflation(mockNk, 'season_1', Date.now() - 86400000, Date.now());

      expect(result.current_avg_elo).toBe(980);
      expect(result.drift_direction).toBe('deflating');
    });
  });

  describe('getRewardConcentration', () => {
    it('should return zero stats when no claims exist', async () => {
      (mockNk.storageRead as jest.Mock).mockResolvedValue([]);

      const result = await getRewardConcentration(
        mockNk,
        'season_1',
        Date.now() - 86400000,
        Date.now()
      );

      expect(result.total_claims).toBe(0);
      expect(result.total_coins_injected).toBe(0);
      expect(result.gini_coefficient).toBe(0);
    });

    it('should calculate tier distribution and currency totals', async () => {
      const claims = [
        {
          season_id: 'season_1',
          timestamp: Date.now(),
          user_id: 'u1',
          rank: 5,
          rank_tier: 'legendary',
          coins_awarded: 10000,
          gems_awarded: 500,
          had_cosmetics: true,
        },
        {
          season_id: 'season_1',
          timestamp: Date.now(),
          user_id: 'u2',
          rank: 50,
          rank_tier: 'epic',
          coins_awarded: 5000,
          gems_awarded: 200,
          had_cosmetics: true,
        },
        {
          season_id: 'season_1',
          timestamp: Date.now(),
          user_id: 'u3',
          rank: 200,
          rank_tier: 'uncommon',
          coins_awarded: 500,
          gems_awarded: 0,
          had_cosmetics: false,
        },
      ];
      (mockNk.storageRead as jest.Mock).mockResolvedValue(
        claims.map((c) => ({ value: JSON.stringify(c) }))
      );

      const result = await getRewardConcentration(
        mockNk,
        'season_1',
        Date.now() - 86400000,
        Date.now()
      );

      expect(result.total_claims).toBe(3);
      expect(result.total_coins_injected).toBe(15500);
      expect(result.total_gems_injected).toBe(700);
      expect(result.claims_by_tier.legendary).toBe(1);
      expect(result.claims_by_tier.epic).toBe(1);
      expect(result.claims_by_tier.uncommon).toBe(1);
      expect(result.gini_coefficient).toBeGreaterThan(0);
      expect(result.top_10_percent_share).toBeGreaterThan(0);
    });

    it('should filter claims by season_id', async () => {
      const claims = [
        {
          season_id: 'season_1',
          timestamp: Date.now(),
          user_id: 'u1',
          rank: 5,
          rank_tier: 'legendary',
          coins_awarded: 10000,
          gems_awarded: 500,
          had_cosmetics: true,
        },
        {
          season_id: 'season_2',
          timestamp: Date.now(),
          user_id: 'u2',
          rank: 50,
          rank_tier: 'epic',
          coins_awarded: 5000,
          gems_awarded: 200,
          had_cosmetics: true,
        },
      ];
      (mockNk.storageRead as jest.Mock).mockResolvedValue(
        claims.map((c) => ({ value: JSON.stringify(c) }))
      );

      const result = await getRewardConcentration(
        mockNk,
        'season_1',
        Date.now() - 86400000,
        Date.now()
      );

      expect(result.total_claims).toBe(1);
      expect(result.total_coins_injected).toBe(10000);
    });
  });

  describe('getProgressionVelocity', () => {
    it('should return zero stats when no rank changes exist', async () => {
      (mockNk.storageRead as jest.Mock).mockResolvedValue([]);

      const result = await getProgressionVelocity(
        mockNk,
        'season_1',
        Date.now() - 86400000,
        Date.now() - 86400000,
        Date.now()
      );

      expect(result.total_matches_tracked).toBe(0);
      expect(result.avg_rank_change_per_match).toBe(0);
      expect(result.punch_up_rate).toBe(0);
    });

    it('should calculate weekly velocity and punch-up rate', async () => {
      const rankChanges = [
        {
          season_id: 'season_1',
          timestamp: Date.now(),
          winner_rank_delta: 16,
          loser_rank_delta: -16,
          is_punch_up: false,
          days_into_season: 3,
        },
        {
          season_id: 'season_1',
          timestamp: Date.now(),
          winner_rank_delta: 30,
          loser_rank_delta: -30,
          is_punch_up: true,
          days_into_season: 10,
        },
        {
          season_id: 'season_1',
          timestamp: Date.now(),
          winner_rank_delta: 14,
          loser_rank_delta: -14,
          is_punch_up: false,
          days_into_season: 20,
        },
      ];
      (mockNk.storageRead as jest.Mock).mockResolvedValue(
        rankChanges.map((rc) => ({ value: JSON.stringify(rc) }))
      );

      const result = await getProgressionVelocity(
        mockNk,
        'season_1',
        Date.now() - 28 * 86400000,
        Date.now() - 28 * 86400000,
        Date.now()
      );

      expect(result.total_matches_tracked).toBe(3);
      expect(result.punch_up_rate).toBeCloseTo(1 / 3);
      expect(result.rank_velocity_by_week.week_1.matches).toBe(1);
      expect(result.rank_velocity_by_week.week_2.matches).toBe(1);
      expect(result.rank_velocity_by_week.week_3.matches).toBe(1);
      expect(result.rank_velocity_by_week.week_4.matches).toBe(0);
    });
  });

  describe('getSeasonTelemetrySummary', () => {
    it('should return complete telemetry summary', async () => {
      (mockNk.storageRead as jest.Mock).mockResolvedValue([]);
      (mockNk.leaderboardRecordList as jest.Mock).mockReturnValue([]);

      const query: SeasonTelemetryQuery = {
        season_id: 'season_1',
        start_date: '2026-01-01',
        end_date: '2026-01-28',
      };

      const summary = await getSeasonTelemetrySummary(mockNk, query);

      expect(summary).toHaveProperty('rank_inflation');
      expect(summary).toHaveProperty('reward_concentration');
      expect(summary).toHaveProperty('progression_velocity');
      expect(summary.season_id).toBe('season_1');
      expect(summary.period_start).toBe(new Date('2026-01-01').getTime());
      expect(summary.period_end).toBe(new Date('2026-01-28').getTime());
    });
  });

  describe('recordSeasonEndSnapshot', () => {
    it('should write final season summary to storage', async () => {
      (mockNk.leaderboardRecordList as jest.Mock).mockReturnValue([]);
      (mockNk.storageRead as jest.Mock).mockResolvedValue([]);

      await recordSeasonEndSnapshot(mockNk, 'season_1', Date.now() - 28 * 86400000);

      // Should write season summary
      const writeCalls = (mockNk.storageWrite as jest.Mock).mock.calls;
      const summaryWrite = writeCalls.find(
        (call: any[]) => call[0]?.[0]?.collection === 'season_telemetry_season_summaries'
      );
      expect(summaryWrite).toBeDefined();
      expect(summaryWrite[0][0].key).toBe('summary_season_1');
    });

    it('should capture a final rating snapshot', async () => {
      (mockNk.leaderboardRecordList as jest.Mock).mockReturnValue([
        { score: 1000, ownerId: 'user1' },
        { score: 1050, ownerId: 'user2' },
      ]);
      (mockNk.storageRead as jest.Mock).mockResolvedValue([]);

      await recordSeasonEndSnapshot(mockNk, 'season_1', Date.now() - 28 * 86400000);

      const writeCalls = (mockNk.storageWrite as jest.Mock).mock.calls;
      const snapshotWrite = writeCalls.find(
        (call: any[]) => call[0]?.[0]?.collection === 'season_telemetry_rating_snapshots'
      );
      expect(snapshotWrite).toBeDefined();
    });
  });
});
