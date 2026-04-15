/**
 * Fairness Telemetry Module Tests
 * @fileoverview Tests for fairness telemetry including hit resolution, disconnects, timeouts, and ranking deltas.
 */

import {
  logHitResolution,
  logDisconnect,
  logTimeout,
  logRankingDelta,
  getFairnessSummary,
  rpcLogHitResolution,
  rpcLogDisconnect,
  rpcLogTimeout,
  rpcLogRankingDelta,
  rpcGetFairnessSummary,
  type HitResolutionEvent,
  type DisconnectEvent,
  type TimeoutEvent,
  type RankingDeltaEvent,
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
