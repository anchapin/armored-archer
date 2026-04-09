import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  aggregateMatchMetrics,
  generateWeaponStats,
  detectBalanceIssues,
  exportAnalyticsReport,
  logMatchData,
  logAbandonment,
  logWeaponResult,
  logQueueTime,
  rpcLogMatchData,
  rpcLogAbandonment,
  rpcLogWeaponResult,
  rpcLogQueueTime,
  rpcGetMatchQualityMetrics,
  rpcGetWeaponStats,
  rpcDetectBalanceIssues,
  rpcExportAnalyticsReport,
  registerMatchmakingAnalyticsEndpoints,
  MATCHMAKING_ANALYTICS_TARGETS,
} from '../matchmaking_analytics';

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../metrics', () => ({
  registerRpcWithMetrics: jest.fn(),
}));

jest.mock('../audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../validation', () => ({
  validatePayload: jest.fn((schema: unknown, payload: string, name: string) => {
    try {
      const data = JSON.parse(payload);
      return { success: true, data };
    } catch {
      return { success: false, error: `Invalid JSON for ${name}` };
    }
  }),
  ZodSchemas: {
    log_match_data: {},
    log_abandonment: {},
    log_weapon_result: {},
    log_queue_time: {},
  },
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockCtx = {
  userId: 'user_123',
} as any;

const mockNk = {
  storageRead: jest.fn().mockResolvedValue([]),
  storageWrite: jest.fn().mockResolvedValue(undefined),
  storageDelete: jest.fn().mockResolvedValue(undefined),
} as any;

describe('Matchmaking Analytics Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNk.storageRead.mockResolvedValue([]);
    mockNk.storageWrite.mockResolvedValue(undefined);
  });

  describe('Target Metrics', () => {
    it('should have correct target rating difference', () => {
      expect(MATCHMAKING_ANALYTICS_TARGETS.TARGET_RATING_DIFF).toBe(100);
    });

    it('should have correct target completion rate', () => {
      expect(MATCHMAKING_ANALYTICS_TARGETS.TARGET_COMPLETION_RATE).toBe(0.9);
    });

    it('should have correct target win rate variance', () => {
      expect(MATCHMAKING_ANALYTICS_TARGETS.TARGET_WIN_RATE_VARIANCE).toBe(0.1);
    });

    it('should have correct target queue time median', () => {
      expect(MATCHMAKING_ANALYTICS_TARGETS.TARGET_QUEUE_TIME_MEDIAN).toBe(60);
    });

    it('should have correct target abandonment rate', () => {
      expect(MATCHMAKING_ANALYTICS_TARGETS.TARGET_ABANDONMENT_RATE).toBe(0.05);
    });
  });

  describe('aggregateMatchMetrics', () => {
    it('should return zero metrics when no match data exists', async () => {
      mockNk.storageRead.mockResolvedValue([]);

      const metrics = await aggregateMatchMetrics(mockNk);

      expect(metrics.total_matches).toBe(0);
      expect(metrics.completed_matches).toBe(0);
      expect(metrics.abandoned_matches).toBe(0);
      expect(metrics.avg_rating_diff).toBe(0);
      expect(metrics.median_queue_time).toBe(0);
    });

    it('should calculate average rating difference correctly', async () => {
      mockNk.storageRead
        .mockResolvedValueOnce([
          { value: { match_id: 'match1', rating_diff: 50, completed: true } },
          { value: { match_id: 'match2', rating_diff: 150, completed: true } },
          { value: { match_id: 'match3', rating_diff: 100, completed: true } },
        ])
        .mockResolvedValueOnce([]);

      const metrics = await aggregateMatchMetrics(mockNk);

      expect(metrics.total_matches).toBe(3);
      expect(metrics.avg_rating_diff).toBe(100); // (50 + 150 + 100) / 3
    });

    it('should calculate completion rate correctly', async () => {
      mockNk.storageRead
        .mockResolvedValueOnce([
          { value: { match_id: 'match1', completed: true } },
          { value: { match_id: 'match2', completed: true } },
          { value: { match_id: 'match3', completed: false } },
        ])
        .mockResolvedValueOnce([]);

      const metrics = await aggregateMatchMetrics(mockNk);

      expect(metrics.completed_matches).toBe(2);
      expect(metrics.abandoned_matches).toBe(1);
    });

    it('should calculate median queue time correctly', async () => {
      mockNk.storageRead
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { value: { queue_time: 30 } },
          { value: { queue_time: 45 } },
          { value: { queue_time: 60 } },
          { value: { queue_time: 90 } },
          { value: { queue_time: 120 } },
        ]);

      const metrics = await aggregateMatchMetrics(mockNk);

      expect(metrics.median_queue_time).toBe(60); // Middle value
    });
  });

  describe('generateWeaponStats', () => {
    it('should return empty object when no weapon stats exist', async () => {
      mockNk.storageRead.mockResolvedValue([]);

      const stats = await generateWeaponStats(mockNk);

      expect(Object.keys(stats).length).toBe(0);
    });

    it('should calculate win rate correctly', async () => {
      mockNk.storageRead.mockResolvedValue([
        {
          value: {
            weapon_id: 'weapon_1',
            matches_played: 10,
            wins: 6,
            losses: 4,
            avg_rating_diff: 50,
            last_updated: Date.now(),
          },
        },
      ]);

      const stats = await generateWeaponStats(mockNk);

      expect(stats['weapon_1'].win_rate).toBe(0.6);
    });
  });

  describe('detectBalanceIssues', () => {
    it('should detect high win rate issue', async () => {
      mockNk.storageRead
        .mockResolvedValue([
          {
            value: {
              weapon_id: 'op_weapon',
              matches_played: 20,
              wins: 16,
              losses: 4,
              win_rate: 0.8,
              avg_rating_diff: 50,
              last_updated: Date.now(),
            },
          },
        ])
        .mockResolvedValue([]);

      const issues = await detectBalanceIssues(mockNk);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].weapon_id).toBe('op_weapon');
      expect(issues[0].issue_type).toBe('high_win_rate');
      expect(issues[0].severity).toBe('medium');
    });

    it('should detect low win rate issue', async () => {
      mockNk.storageRead
        .mockResolvedValue([
          {
            value: {
              weapon_id: 'weak_weapon',
              matches_played: 20,
              wins: 4,
              losses: 16,
              win_rate: 0.2,
              avg_rating_diff: 50,
              last_updated: Date.now(),
            },
          },
        ])
        .mockResolvedValue([]);

      const issues = await detectBalanceIssues(mockNk);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].weapon_id).toBe('weak_weapon');
      expect(issues[0].issue_type).toBe('low_win_rate');
      expect(issues[0].severity).toBe('medium');
    });

    it('should skip weapons with insufficient data', async () => {
      mockNk.storageRead
        .mockResolvedValue([
          {
            value: {
              weapon_id: 'new_weapon',
              matches_played: 5,
              wins: 4,
              losses: 1,
              win_rate: 0.8,
              avg_rating_diff: 50,
              last_updated: Date.now(),
            },
          },
        ])
        .mockResolvedValue([]);

      const issues = await detectBalanceIssues(mockNk);

      expect(issues.length).toBe(0);
    });

    it('should detect high abandonment rate', async () => {
      mockNk.storageRead
        .mockResolvedValue([
          {
            value: {
              match_id: 'match1',
              completed: true,
            },
          },
          {
            value: {
              match_id: 'match2',
              completed: false,
            },
          },
          {
            value: {
              match_id: 'match3',
              completed: false,
            },
          },
        ])
        .mockResolvedValue([]);

      const issues = await detectBalanceIssues(mockNk);

      expect(issues.some((issue) => issue.issue_type === 'high_abandonment_rate')).toBe(true);
    });
  });

  describe('exportAnalyticsReport', () => {
    it('should export comprehensive analytics report', async () => {
      mockNk.storageRead.mockResolvedValue([]);

      const report = await exportAnalyticsReport(mockNk);

      expect(report).toHaveProperty('quality_metrics');
      expect(report).toHaveProperty('weapon_stats');
      expect(report).toHaveProperty('rating_diff_distribution');
      expect(report).toHaveProperty('detected_issues');
      expect(report).toHaveProperty('export_timestamp');
    });
  });

  describe('logMatchData', () => {
    it('should log match data to storage', async () => {
      const requestData = {
        match_id: 'match_123',
        timestamp: Date.now(),
        rating_diff: 50,
        weapons: ['weapon_1', 'weapon_2'],
        duration: 120,
      };

      await logMatchData(mockNk, requestData);

      expect(mockNk.storageWrite).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            collection: 'matchmaking_match_data',
            key: 'match_123',
            value: requestData,
          }),
        ])
      );
    });
  });

  describe('logAbandonment', () => {
    it('should log abandonment data and update match', async () => {
      mockNk.storageRead.mockResolvedValue([
        {
          value: {
            match_id: 'match_123',
            timestamp: Date.now(),
            rating_diff: 50,
            weapons: ['weapon_1'],
            duration: 120,
          },
        },
      ]);

      await logAbandonment(mockNk, {
        match_id: 'match_123',
        reason: 'player_disconnect',
        timestamp: Date.now(),
      });

      expect(mockNk.storageWrite).toHaveBeenCalled();
    });
  });

  describe('logWeaponResult', () => {
    it('should log weapon result and update stats', async () => {
      mockNk.storageRead.mockResolvedValue([
        {
          value: {
            weapon_id: 'weapon_1',
            matches_played: 10,
            wins: 5,
            losses: 5,
            win_rate: 0.5,
            avg_rating_diff: 50,
            last_updated: Date.now(),
          },
        },
      ]);

      await logWeaponResult(mockNk, 'weapon_1', true, 50);

      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should create new weapon stats if not exists', async () => {
      mockNk.storageRead.mockResolvedValue([]);

      await logWeaponResult(mockNk, 'new_weapon', false, 50);

      expect(mockNk.storageWrite).toHaveBeenCalled();
    });
  });

  describe('logQueueTime', () => {
    it('should log queue time to storage', async () => {
      await logQueueTime(mockNk, {
        queue_time: 45,
        timestamp: Date.now(),
      });

      expect(mockNk.storageWrite).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            collection: 'matchmaking_queue_times',
            value: expect.objectContaining({ queue_time: 45 }),
          }),
        ])
      );
    });

    it('should prune old queue times when limit exceeded', async () => {
      const mockQueueObjects = Array.from({ length: 10001 }, (_, i) => ({
        key: `queue_${i}`,
        value: { queue_time: 30, timestamp: Date.now() - i * 1000 },
      }));

      mockNk.storageRead.mockResolvedValueOnce([]).mockResolvedValueOnce(mockQueueObjects);

      await logQueueTime(mockNk, {
        queue_time: 45,
        timestamp: Date.now(),
      });

      expect(mockNk.storageDelete).toHaveBeenCalled();
    });
  });

  describe('RPC Handlers', () => {
    it('rpcLogMatchData should handle valid request', async () => {
      const payload = JSON.stringify({
        match_id: 'match_123',
        timestamp: Date.now(),
        rating_diff: 50,
        weapons: ['weapon_1'],
        duration: 120,
      });

      const result = await rpcLogMatchData(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
    });

    it('rpcLogAbandonment should handle valid request', async () => {
      const payload = JSON.stringify({
        match_id: 'match_123',
        reason: 'network_error',
        timestamp: Date.now(),
      });

      const result = await rpcLogAbandonment(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
    });

    it('rpcLogWeaponResult should handle valid request', async () => {
      const payload = JSON.stringify({
        weapon_id: 'weapon_1',
        is_win: true,
        timestamp: Date.now(),
      });

      const result = await rpcLogWeaponResult(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
    });

    it('rpcLogQueueTime should handle valid request', async () => {
      const payload = JSON.stringify({
        queue_time: 45,
        timestamp: Date.now(),
      });

      const result = await rpcLogQueueTime(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
    });

    it('rpcGetMatchQualityMetrics should return metrics', async () => {
      mockNk.storageRead.mockResolvedValue([]);

      const result = await rpcGetMatchQualityMetrics(mockCtx, mockLogger, mockNk, '{}');
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.metrics).toBeDefined();
    });

    it('rpcGetWeaponStats should return all weapon stats', async () => {
      mockNk.storageRead.mockResolvedValue([]);

      const result = await rpcGetWeaponStats(mockCtx, mockLogger, mockNk, '{}');
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.stats).toBeDefined();
    });

    it('rpcDetectBalanceIssues should detect issues', async () => {
      mockNk.storageRead.mockResolvedValue([]);

      const result = await rpcDetectBalanceIssues(mockCtx, mockLogger, mockNk, '{}');
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.issues).toBeDefined();
    });

    it('rpcExportAnalyticsReport should export report', async () => {
      mockNk.storageRead.mockResolvedValue([]);

      const result = await rpcExportAnalyticsReport(mockCtx, mockLogger, mockNk, '{}');
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.report).toBeDefined();
    });
  });

  describe('registerMatchmakingAnalyticsEndpoints', () => {
    it('should register all RPC endpoints', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as any;

      registerMatchmakingAnalyticsEndpoints(mockInitializer);

      // Verify that registerRpcWithMetrics was called 8 times (4 data logging + 4 query endpoints)
      const { registerRpcWithMetrics } = require('../metrics');
      expect(registerRpcWithMetrics).toHaveBeenCalledTimes(8);
    });
  });
});
