/**
 * Fairness Telemetry Module Tests
 * @fileoverview Tests for fairness telemetry including hit resolution, disconnects, timeouts, and ranking deltas.
 */

import {
  logHitResolution,
  logDisconnect,
  logTimeout,
  logRankingDelta,
  logPunchUpLoss,
  getFairnessSummary,
  registerFairnessTelemetryEndpoints,
  rpcLogHitResolution,
  rpcLogDisconnect,
  rpcLogTimeout,
  rpcLogRankingDelta,
  rpcGetFairnessSummary,
  type HitResolutionEvent,
  type DisconnectEvent,
  type TimeoutEvent,
  type RankingDeltaEvent,
  type PunchUpLossEvent,
  type FairnessQuery,
  type FairnessSummary,
} from '../fairness_telemetry';
import { Runtime } from '../../types/nakama';
import { logger } from '../../config/logger';

describe('Fairness Telemetry', () => {
  const mockNk: Runtime.Nakama = {
    storageRead: jest.fn(),
    storageWrite: jest.fn(),
  } as unknown as Runtime.Nakama;

  const mockCtx: Runtime.Context = {
    userId: 'test-user-id',
    username: 'testuser',
    environment: {},
    client_ip: '127.0.0.1',
    client_port: '8080',
    lang: 'en',
    match_id: 'test-match-id',
    node: 'test-node-1',
    session_id: 'test-session',
    expires: Math.floor(Date.now() / 1000) + 3600,
    vars: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logHitResolution', () => {
    it('should store hit resolution event in storage', async () => {
      const event: HitResolutionEvent = {
        event_id: 'test_hit_1',
        match_id: 'match_123',
        timestamp: Date.now(),
        attacker_id: 'attacker_1',
        defender_id: 'defender_1',
        hit: true,
        damage: 25,
        is_crit: false,
        angle: 1.57,
        power: 0.8,
        attacker_health: 100,
        defender_health: 75,
        turn: 3,
      };

      await logHitResolution(mockNk, event);

      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          collection: 'fairness_hit_resolution',
          key: 'test_hit_1',
          userId: '00000000-0000-0000-0000-000000000000',
        }),
      ]);
    });
  });

  describe('logDisconnect', () => {
    it('should store disconnect event in storage', async () => {
      const event: DisconnectEvent = {
        event_id: 'test_dc_1',
        match_id: 'match_123',
        timestamp: Date.now(),
        user_id: 'user_1',
        opponent_id: 'user_2',
        disconnect_reason: 'network_error',
        match_status: 'active',
        match_type: 'ranked',
        current_turn_user_id: 'user_1',
        was_winning: true,
        health_before_disconnect: 80,
        opponent_health_before_disconnect: 50,
      };

      await logDisconnect(mockNk, event);

      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          collection: 'fairness_disconnects',
          key: 'test_dc_1',
          userId: '00000000-0000-0000-0000-000000000000',
        }),
      ]);
    });
  });

  describe('logTimeout', () => {
    it('should store timeout event in storage', async () => {
      const event: TimeoutEvent = {
        event_id: 'test_to_1',
        match_id: 'match_123',
        timestamp: Date.now(),
        timed_out_user_id: 'user_1',
        opponent_id: 'user_2',
        timeout_type: 'turn_timeout',
        consecutive_timeouts: 1,
        match_type: 'ranked',
        turn: 3,
        turn_duration_ms: 30000,
      };

      await logTimeout(mockNk, event);

      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          collection: 'fairness_timeouts',
          key: 'test_to_1',
          userId: '00000000-0000-0000-0000-000000000000',
        }),
      ]);
    });
  });

  describe('logRankingDelta', () => {
    it('should store ranking delta event in storage', async () => {
      const event: RankingDeltaEvent = {
        event_id: 'test_rank_1',
        match_id: 'match_123',
        timestamp: Date.now(),
        winner_id: 'winner_1',
        loser_id: 'loser_1',
        winner_old_rank: 1200,
        winner_new_rank: 1220,
        winner_rank_change: 20,
        loser_old_rank: 1200,
        loser_new_rank: 1180,
        loser_rank_change: -20,
        match_type: 'ranked',
        is_punch_up: false,
        winner_old_season_position: 10,
        winner_new_season_position: 8,
        loser_old_season_position: 15,
        loser_new_season_position: 18,
        season_id: 'season_2024_1',
      };

      await logRankingDelta(mockNk, event);

      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          collection: 'fairness_ranking_deltas',
          key: 'test_rank_1',
          userId: '00000000-0000-0000-0000-000000000000',
        }),
      ]);
    });
  });

  describe('getFairnessSummary', () => {
    it('should return zero stats when no events exist', async () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const query: FairnessQuery = {};
      const summary: FairnessSummary = await getFairnessSummary(mockNk, query);

      expect(summary.hit_resolution_stats.total_hits).toBe(0);
      expect(summary.disconnect_stats.total_disconnects).toBe(0);
      expect(summary.timeout_stats.total_timeouts).toBe(0);
      expect(summary.ranking_stats.total_matches).toBe(0);
    });
  });

  describe('RPC handlers', () => {
    describe('rpcLogHitResolution', () => {
      it('should validate payload and log hit resolution', async () => {
        const payload = JSON.stringify({
          match_id: 'match_123',
          timestamp: Date.now(),
          attacker_id: 'attacker_1',
          defender_id: 'defender_1',
          hit: true,
          damage: 25,
          is_crit: false,
          angle: 1.57,
          attacker_health: 100,
          defender_health: 75,
          turn: 3,
        });

        const result = await rpcLogHitResolution(mockCtx, logger, mockNk, payload);
        const parsed = JSON.parse(result);

        expect(parsed.success).toBe(true);
        expect(parsed.event_id).toBeDefined();
        expect(mockNk.storageWrite).toHaveBeenCalled();
      });
    });

    describe('rpcLogDisconnect', () => {
      it('should validate payload and log disconnect', async () => {
        const payload = JSON.stringify({
          match_id: 'match_123',
          timestamp: Date.now(),
          user_id: 'user_1',
          opponent_id: 'user_2',
          disconnect_reason: 'network_error',
          match_status: 'active',
          match_type: 'ranked',
          current_turn_user_id: 'user_1',
        });

        const result = await rpcLogDisconnect(mockCtx, logger, mockNk, payload);
        const parsed = JSON.parse(result);

        expect(parsed.success).toBe(true);
        expect(parsed.event_id).toBeDefined();
        expect(mockNk.storageWrite).toHaveBeenCalled();
      });
    });

    describe('rpcLogTimeout', () => {
      it('should validate payload and log timeout', async () => {
        const payload = JSON.stringify({
          match_id: 'match_123',
          timestamp: Date.now(),
          timed_out_user_id: 'user_1',
          opponent_id: 'user_2',
          timeout_type: 'turn_timeout',
          consecutive_timeouts: 1,
          match_type: 'ranked',
          turn: 3,
          turn_duration_ms: 30000,
        });

        const result = await rpcLogTimeout(mockCtx, logger, mockNk, payload);
        const parsed = JSON.parse(result);

        expect(parsed.success).toBe(true);
        expect(parsed.event_id).toBeDefined();
        expect(mockNk.storageWrite).toHaveBeenCalled();
      });
    });

    describe('rpcLogRankingDelta', () => {
      it('should validate payload and log ranking delta', async () => {
        const payload = JSON.stringify({
          match_id: 'match_123',
          timestamp: Date.now(),
          winner_id: 'winner_1',
          loser_id: 'loser_1',
          winner_old_rank: 1200,
          winner_new_rank: 1220,
          winner_rank_change: 20,
          loser_old_rank: 1200,
          loser_new_rank: 1180,
          loser_rank_change: -20,
          match_type: 'ranked',
          is_punch_up: false,
          winner_old_season_position: 10,
          winner_new_season_position: 8,
          loser_old_season_position: 15,
          loser_new_season_position: 18,
          season_id: 'season_2024_1',
        });

        const result = await rpcLogRankingDelta(mockCtx, logger, mockNk, payload);
        const parsed = JSON.parse(result);

        expect(parsed.success).toBe(true);
        expect(parsed.event_id).toBeDefined();
        expect(mockNk.storageWrite).toHaveBeenCalled();
      });
    });

    describe('rpcGetFairnessSummary', () => {
      it('should validate query and return fairness summary', async () => {
        const payload = JSON.stringify({
          start_date: '2024-01-01',
          end_date: '2024-01-31',
        });

        mockNk.storageRead = jest.fn().mockReturnValue([]);

        const result = await rpcGetFairnessSummary(mockCtx, logger, mockNk, payload);
        const parsed = JSON.parse(result);

        expect(parsed.success).toBe(true);
        expect(parsed.summary).toBeDefined();
        expect(mockNk.storageRead).toHaveBeenCalled();
      });
    });
  });
});

describe('branch coverage additions (#1661)', () => {
  const nk = () =>
    ({ storageRead: jest.fn().mockReturnValue([]), storageWrite: jest.fn().mockReturnValue(undefined) }) as unknown as Runtime.Nakama;

  const punchUpEvent: PunchUpLossEvent = {
    event_id: 'e1',
    match_id: 'm1',
    timestamp: Date.now(),
    season_id: 's1',
    loser_id: 'l1',
    winner_id: 'w1',
    loser_old_rank: 10,
    loser_new_rank: 12,
    loser_rank_change: -2,
    loser_xp_gained: 5,
    winner_rank_change: 1,
    amplified: true,
    winner_k_factor: 32,
    loser_k_factor: 32,
    end_reason: 'ko',
    watch: { flagged: false, reason: '', pair_loss_count: 0, player_loss_count: 0 },
  };

  it('logPunchUpLoss writes to the punch-up collection', async () => {
    const mock = nk();
    logPunchUpLoss(mock, punchUpEvent);
    const writes = (mock.storageWrite as jest.Mock).mock.calls.map((c) => c[0][0]);
    const punchWrite = writes.find((w) => w.collection === 'fairness_punch_up_losses');
    expect(punchWrite).toBeDefined();
    expect(punchWrite.key).toBe('e1');
    expect(punchWrite.permissionWrite).toBe(0);
  });

  it('logPunchUpLoss swallows storage failures', () => {
    const mock = nk();
    (mock.storageWrite as jest.Mock).mockImplementation(() => { throw new Error('disk full'); });
    expect(() => logPunchUpLoss(mock, punchUpEvent)).not.toThrow();
  });

  it('getFairnessSummary returns zeroed stats for empty storage', async () => {
    const summary = getFairnessSummary(nk(), {});
    expect(summary.hit_resolution_stats.total_hits).toBe(0);
    expect(summary.hit_resolution_stats.avg_damage).toBe(0);
    expect(summary.disconnect_stats.total_disconnects).toBe(0);
    expect(summary.timeout_stats.avg_consecutive_timeouts).toBe(0);
    expect(summary.ranking_stats.avg_rank_change).toBe(0);
  });

  it('getFairnessSummary aggregates hits, disconnects, timeouts, rankings and filters by date', async () => {
    const now = Date.now();
    const old = now - 30 * 24 * 60 * 60 * 1000;
    const storageByCollection: Record<string, unknown[]> = {
      fairness_hit_resolution: [
        { event_id: 'h1', hit: true, is_crit: true, damage: 30, timestamp: now },
        { event_id: 'h2', hit: false, is_crit: false, damage: 10, timestamp: now },
        { event_id: 'h3', hit: true, is_crit: false, damage: 99, timestamp: old }, // filtered out
      ],
      fairness_disconnects: [
        { event_id: 'd1', disconnect_reason: 'quit', was_winning: true, timestamp: now },
        { event_id: 'd2', disconnect_reason: 'quit', was_winning: false, timestamp: now },
        { event_id: 'd3', disconnect_reason: 'crash', was_winning: false, timestamp: now },
      ],
      fairness_timeouts: [
        { event_id: 't1', timeout_type: 'turn', consecutive_timeouts: 4, timestamp: now },
      ],
      fairness_ranking_deltas: [
        { event_id: 'r1', winner_rank_change: 5, loser_rank_change: -3, timestamp: now },
      ],
    };
    const mock = nk();
    (mock.storageRead as jest.Mock).mockImplementation((objects: { collection: string }[]) =>
      objects.flatMap((o) =>
        (storageByCollection[o.collection] || []).map((value) => ({ value }))
      )
    );
    const summary = getFairnessSummary(mock, {
      start_date: new Date(now - 1000).toISOString(),
      end_date: new Date(now + 1000).toISOString(),
    });
    expect(summary.hit_resolution_stats.total_hits).toBe(1);
    expect(summary.hit_resolution_stats.total_misses).toBe(1);
    expect(summary.hit_resolution_stats.total_critical_hits).toBe(1);
    expect(summary.hit_resolution_stats.avg_damage).toBe(20);
    expect(summary.disconnect_stats.total_disconnects).toBe(3);
    expect(summary.disconnect_stats.disconnects_by_reason).toEqual({ quit: 2, crash: 1 });
    expect(summary.disconnect_stats.disconnects_when_winning).toBe(1);
    expect(summary.timeout_stats.total_timeouts).toBe(1);
    expect(summary.timeout_stats.timeouts_by_type).toEqual({ turn: 1 });
    expect(summary.timeout_stats.avg_consecutive_timeouts).toBe(4);
    expect(summary.ranking_stats.total_matches).toBe(1);
    expect(summary.ranking_stats.avg_rank_change).toBe(4); // (5 + 3) / 2
    expect(summary.ranking_stats.max_positive_change).toBe(5);
    expect(summary.ranking_stats.max_negative_change).toBe(-3);
  });

  it('registerFairnessTelemetryEndpoints registers the five RPC ids', () => {
    const init = ({ registerRpc: jest.fn() }) as unknown as Runtime.Initializer;
    registerFairnessTelemetryEndpoints(init);
    const ids = (init.registerRpc as jest.Mock).mock.calls.map((c) => c[0]);
    expect(ids).toEqual([
      'armored_archer/log_hit_resolution',
      'armored_archer/log_disconnect',
      'armored_archer/log_timeout',
      'armored_archer/log_ranking_delta',
      'armored_archer/get_fairness_summary',
    ]);
  });

  it('rpcGetFairnessSummary rejects invalid payloads', async () => {
    const res = JSON.parse(
      rpcGetFairnessSummary(
        { userId: 'u1' } as Runtime.Context,
        logger as unknown as Runtime.Logger,
        nk(),
        '{"start_date":123}'
      )
    );
    expect(res.success).toBe(false);
  });

  it('rpcGetFairnessSummary fails closed when storage throws', async () => {
    const mock = nk();
    (mock.storageRead as jest.Mock).mockImplementation(() => { throw new Error('storage down'); });
    const res = JSON.parse(
      rpcGetFairnessSummary(
        { userId: 'u1' } as Runtime.Context,
        logger as unknown as Runtime.Logger,
        mock,
        '{}'
      )
    );
    expect(res).toEqual({ success: false, error: 'Failed to retrieve fairness summary' });
  });
});

describe('event log error paths (#1661)', () => {
  const failingNk = () =>
    ({ storageRead: jest.fn(), storageWrite: jest.fn().mockImplementation(() => { throw new Error('write fail'); }) }) as unknown as Runtime.Nakama;

  it('logHitResolution swallows storage failures', () => {
    const event = { event_id: 'h1', match_id: 'm1', timestamp: 1, player_id: 'p1', hit: true, damage: 10, is_crit: false } as unknown as HitResolutionEvent;
    expect(() => logHitResolution(failingNk(), event)).not.toThrow();
  });

  it('logDisconnect swallows storage failures', () => {
    const event = { event_id: 'd1', match_id: 'm1', timestamp: 1, user_id: 'u1', disconnect_reason: 'quit', was_winning: false } as unknown as DisconnectEvent;
    expect(() => logDisconnect(failingNk(), event)).not.toThrow();
  });

  it('logTimeout swallows storage failures', () => {
    const event = { event_id: 't1', match_id: 'm1', timestamp: 1, user_id: 'u1', timeout_type: 'turn', consecutive_timeouts: 2 } as unknown as TimeoutEvent;
    expect(() => logTimeout(failingNk(), event)).not.toThrow();
  });

  it('logRankingDelta swallows storage failures', () => {
    const event = { event_id: 'r1', match_id: 'm1', timestamp: 1, winner_id: 'w', loser_id: 'l', winner_rank_change: 1, loser_rank_change: -1 } as unknown as RankingDeltaEvent;
    expect(() => logRankingDelta(failingNk(), event)).not.toThrow();
  });
});
