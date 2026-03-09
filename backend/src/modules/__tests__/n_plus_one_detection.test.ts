import {
  trackQuery,
  trackQueryAsync,
  startOperationTracking,
  stopOperationTracking,
  withNPlusOneTracking,
  withNPlusOneTrackingAsync,
  setNPlusOneConfig,
  getNPlusOneConfig,
  isNPlusOneEnabled,
  setNPlusOneEnabled,
  getQueryStats,
  getAllQueryStats,
  getNPlusOneReport,
  getFormattedNPlusOneReport,
  initializeNPlusOneDetection,
  resetNPlusOneDetection,
} from '../n_plus_one_detection';

// Mock dependencies
jest.mock('prom-client', () => ({
  Registry: jest.fn().mockImplementation(() => ({
    metrics: jest.fn().mockResolvedValue('mock metrics'),
    contentType: 'text/plain',
  })),
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn(),
  })),
  Histogram: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    startTimer: jest.fn().mockReturnValue(jest.fn()),
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
  })),
  collectDefaultMetrics: jest.fn(),
}));

describe('n_plus_one_detection', () => {
  beforeEach(() => {
    // Reset the module state before each test
    resetNPlusOneDetection();
    setNPlusOneEnabled(true);
    setNPlusOneConfig({
      enabled: true,
      threshold: 3,
      logEnabled: false,
      metricsEnabled: false,
      slowQueryThresholdMs: 100,
      autoTrackStorage: true,
    });
  });

  describe('configuration', () => {
    it('should have default configuration', () => {
      const config = getNPlusOneConfig();
      expect(config.enabled).toBe(true);
      expect(config.threshold).toBe(3);
      expect(config.logEnabled).toBe(false);
      expect(config.metricsEnabled).toBe(false);
    });

    it('should update configuration', () => {
      setNPlusOneConfig({ threshold: 5 });
      const config = getNPlusOneConfig();
      expect(config.threshold).toBe(5);
      expect(config.enabled).toBe(true); // Should preserve other values
    });

    it('should enable/disable detection', () => {
      setNPlusOneEnabled(false);
      expect(isNPlusOneEnabled()).toBe(false);
      setNPlusOneEnabled(true);
      expect(isNPlusOneEnabled()).toBe(true);
    });

    it('should return a copy of config', () => {
      const config = getNPlusOneConfig();
      config.threshold = 999;
      const config2 = getNPlusOneConfig();
      expect(config2.threshold).not.toBe(999);
    });
  });

  describe('trackQuery', () => {
    it('should track a synchronous query', () => {
      const result = trackQuery('test_operation', 'storage', () => 'test_result');
      expect(result).toBe('test_result');

      const stats = getQueryStats('test_operation');
      expect(stats).toBeDefined();
      expect(stats?.totalQueries).toBe(1);
    });

    it('should track query duration', () => {
      const start = Date.now();
      trackQuery('duration_test', 'storage', () => {
        // Simulate some work
        const _x = 0;
        for (let i = 0; i < 1000; i++) {
          _x + i;
        }
        return 'done';
      });
      const end = Date.now();

      const stats = getQueryStats('duration_test');
      expect(stats?.totalDurationMs).toBeGreaterThan(0);
      expect(stats?.totalDurationMs).toBeLessThan(end - start + 100);
    });

    it('should track different query types', () => {
      trackQuery('op1', 'storage', () => 'result');
      trackQuery('op2', 'database', () => 'result');
      trackQuery('op3', 'leaderboard', () => 'result');
      trackQuery('op4', 'http', () => 'result');

      const stats1 = getQueryStats('op1');
      const stats2 = getQueryStats('op2');
      const stats3 = getQueryStats('op3');
      const stats4 = getQueryStats('op4');

      expect(stats1?.byType.storage?.count).toBe(1);
      expect(stats2?.byType.database?.count).toBe(1);
      expect(stats3?.byType.leaderboard?.count).toBe(1);
      expect(stats4?.byType.http?.count).toBe(1);
    });

    it('should not track when disabled', () => {
      setNPlusOneEnabled(false);
      const result = trackQuery('disabled_test', 'storage', () => 'result');
      expect(result).toBe('result');

      const stats = getQueryStats('disabled_test');
      expect(stats).toBeNull();
    });

    it('should pass through errors', () => {
      expect(() => {
        trackQuery('error_test', 'storage', () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');
    });

    it('should track query options', () => {
      trackQuery(
        'options_test',
        'storage',
        () => 'result',
        { collection: 'test_collection', key: 'test_key', userId: 'test_user' }
      );

      const stats = getQueryStats('options_test');
      expect(stats?.totalQueries).toBe(1);
    });
  });

  describe('trackQueryAsync', () => {
    it('should track an asynchronous query', async () => {
      const result = await trackQueryAsync('async_test', 'storage', async () => {
        return await Promise.resolve('async_result');
      });
      expect(result).toBe('async_result');

      const stats = getQueryStats('async_test');
      expect(stats?.totalQueries).toBe(1);
    });

    it('should handle async errors', async () => {
      await expect(
        trackQueryAsync('async_error', 'storage', async () => {
          throw new Error('Async error');
        })
      ).rejects.toThrow('Async error');
    });
  });

  describe('operation tracking', () => {
    it('should track multiple queries in an operation', () => {
      startOperationTracking('multi_query_op');

      // Simulate multiple queries (like N+1 pattern)
      trackQuery('multi_query_op', 'storage', () => 'result1');
      trackQuery('multi_query_op', 'storage', () => 'result2');
      trackQuery('multi_query_op', 'storage', () => 'result3');
      trackQuery('multi_query_op', 'storage', () => 'result4');

      const result = stopOperationTracking('multi_query_op');
      expect(result.queryCount).toBe(4);
    });

    it('should detect N+1 pattern when threshold exceeded', () => {
      startOperationTracking('n_plus_one_op');

      // Make more queries than threshold
      for (let i = 0; i < 5; i++) {
        trackQuery('n_plus_one_op', 'storage', () => `result${i}`, { collection: 'players' });
      }

      const result = stopOperationTracking('n_plus_one_op');
      expect(result.nPlusOneDetected).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should not detect N+1 when below threshold', () => {
      setNPlusOneConfig({ threshold: 10 });
      startOperationTracking('normal_op');

      for (let i = 0; i < 5; i++) {
        trackQuery('normal_op', 'storage', () => `result${i}`);
      }

      const result = stopOperationTracking('normal_op');
      expect(result.nPlusOneDetected).toBe(false);
    });

    it('should return empty result for unknown operation', () => {
      const result = stopOperationTracking('unknown_op');
      expect(result.queryCount).toBe(0);
      expect(result.nPlusOneDetected).toBe(false);
      expect(result.warnings).toEqual([]);
    });

    it('should track different collections separately', () => {
      startOperationTracking('diff_collections');

      // Query same collection multiple times
      trackQuery('diff_collections', 'storage', () => 'r1', { collection: 'players' });
      trackQuery('diff_collections', 'storage', () => 'r2', { collection: 'players' });
      trackQuery('diff_collections', 'storage', () => 'r3', { collection: 'players' });

      // Query different collection
      trackQuery('diff_collections', 'storage', () => 'r4', { collection: 'inventory' });

      const result = stopOperationTracking('diff_collections');
      expect(result.nPlusOneDetected).toBe(true);
    });
  });

  describe('withNPlusOneTracking', () => {
    it('should wrap synchronous function with tracking', () => {
      const result = withNPlusOneTracking('wrapped_sync', () => {
        trackQuery('wrapped_sync', 'storage', () => 'result');
        return 'final_result';
      });

      expect(result).toBe('final_result');
      const stats = getQueryStats('wrapped_sync');
      expect(stats?.totalQueries).toBe(1);
    });

    it('should wrap asynchronous function with tracking', async () => {
      const result = await withNPlusOneTrackingAsync('wrapped_async', async () => {
        await trackQueryAsync('wrapped_async', 'storage', async () => 'result');
        return 'async_final';
      });

      expect(result).toBe('async_final');
      const stats = getQueryStats('wrapped_async');
      expect(stats?.totalQueries).toBe(1);
    });

    it('should handle errors in wrapped functions', () => {
      expect(() => {
        withNPlusOneTracking('wrapped_error', () => {
          throw new Error('Wrapped error');
        });
      }).toThrow('Wrapped error');
    });
  });

  describe('reports', () => {
    it('should get query stats for specific operation', () => {
      trackQuery('report_test', 'storage', () => 'result');

      const stats = getQueryStats('report_test');
      expect(stats).not.toBeNull();
      expect(stats?.totalQueries).toBe(1);
    });

    it('should return null for unknown operation', () => {
      const stats = getQueryStats('nonexistent');
      expect(stats).toBeNull();
    });

    it('should get all query stats', () => {
      trackQuery('all_test_1', 'storage', () => 'r1');
      trackQuery('all_test_2', 'database', () => 'r2');

      const allStats = getAllQueryStats();
      expect(allStats.size).toBe(2);
    });

    it('should generate N+1 report', () => {
      trackQuery('report_gen', 'storage', () => 'r1');
      trackQuery('report_gen', 'storage', () => 'r2');
      trackQuery('report_gen', 'storage', () => 'r3');

      const report = getNPlusOneReport();
      expect(report.globalQueryCount).toBe(3);
      expect(report.operations.length).toBeGreaterThan(0);
      expect(report.config).toBeDefined();
    });

    it('should generate formatted report', () => {
      trackQuery('format_test', 'storage', () => 'result');

      const formatted = getFormattedNPlusOneReport();
      expect(formatted).toContain('N+1 Query Detection Report');
      expect(formatted).toContain('format_test');
    });
  });

  describe('initialization', () => {
    it('should initialize with logger', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      initializeNPlusOneDetection(mockLogger as any);
      // Should not throw
    });

    it('should not track when disabled', () => {
      setNPlusOneEnabled(false);

      startOperationTracking('disabled_op');
      trackQuery('disabled_op', 'storage', () => 'result');
      const result = stopOperationTracking('disabled_op');

      expect(result.queryCount).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear all tracked data', () => {
      trackQuery('reset_test', 'storage', () => 'result');
      trackQuery('reset_test', 'database', () => 'result');

      resetNPlusOneDetection();

      const stats = getQueryStats('reset_test');
      expect(stats).toBeNull();

      const allStats = getAllQueryStats();
      expect(allStats.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty operation name', () => {
      const result = trackQuery('', 'storage', () => 'result');
      expect(result).toBe('result');
    });

    it('should handle special characters in operation name', () => {
      const result = trackQuery('op-with-special.chars', 'storage', () => 'result');
      expect(result).toBe('result');
    });

    it('should handle very long operation names', () => {
      const longName = 'a'.repeat(1000);
      const result = trackQuery(longName, 'storage', () => 'result');
      expect(result).toBe('result');
    });

    it('should handle rapid consecutive queries', () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        trackQuery('rapid_test', 'storage', () => 'result');
      }
      const duration = Date.now() - start;

      // Should complete quickly
      expect(duration).toBeLessThan(1000);
      const stats = getQueryStats('rapid_test');
      expect(stats?.totalQueries).toBe(100);
    });
  });
});
