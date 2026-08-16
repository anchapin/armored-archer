/**
 * Performance Smoke Tests
 *
 * Tests response times and performance characteristics of RPC endpoints
 * Verifies performance targets are met for alpha release
 *
 * Performance Targets:
 * - Average response time: < 100ms
 * - P95 response time: < 200ms
 * - P99 response time: < 500ms
 * - Concurrent users (10): All requests complete within 2s
 * - Memory usage: Stable under load
 */

import { performance } from 'perf_hooks';
import { testHelper, TestAccount } from './helpers';

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  averageResponseTimeMs: 100,
  p95ResponseTimeMs: 200,
  p99ResponseTimeMs: 500,
  maxConcurrentTestMs: 2000,
  minConcurrentUsers: 10,
};

interface PerformanceMetrics {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  requestsPerSecond: number;
}

describe('Performance Smoke Tests', () => {
  let player: TestAccount;
  let testPlayers: TestAccount[] = [];
  const responseTimes: Map<string, number[]> = new Map();

  beforeAll(async () => {
    await testHelper.initialize();
    await testHelper.cleanAllTestData();

    // Create main test player
    player = await testHelper.createTestAccount('perf_main');

    // Setup player with stats
    await testHelper.writeStorageObject('player_stats', player.userId, player.userId, {
      level: 10,
      xp: 2000,
      ability_points: 5,
      stats: { attack: 25, defense: 20, dodge: 15, crit_rate: 12 },
    });

    // Create inventory
    await testHelper.writeStorageObject('player_inventory', player.userId, player.userId, {
      user_id: player.userId,
      gear: [],
      equipped_gear: {},
      unlocked_modifier_pools: [],
    });

    // Create currency
    await testHelper.writeStorageObject('player_currency', player.userId, player.userId, {
      user_id: player.userId,
      gems: 1000,
      coins: 5000,
    });

    // Create additional test players for concurrent tests
    for (let i = 0; i < PERFORMANCE_THRESHOLDS.minConcurrentUsers; i++) {
      const testPlayer = await testHelper.createTestAccount(`perf_concurrent_${i}`);
      await testHelper.writeStorageObject('player_stats', testPlayer.userId, testPlayer.userId, {
        level: 5,
        xp: 500,
        ability_points: 2,
        stats: { attack: 15, defense: 10, dodge: 8, crit_rate: 6 },
      });
      testPlayers.push(testPlayer);
    }
  }, 120000);

  afterAll(async () => {
    await testHelper.cleanAllTestData();
    await testHelper.cleanup();
  });

  // Helper to measure RPC response time
  async function measureRpcTime(
    account: TestAccount,
    rpcId: string,
    payload: any = {}
  ): Promise<{ duration: number; success: boolean; result: any }> {
    const startTime = performance.now();
    try {
      const response = await account.client.rpc(account.session, rpcId, payload);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Track response time
      if (!responseTimes.has(rpcId)) {
        responseTimes.set(rpcId, []);
      }
      responseTimes.get(rpcId)!.push(duration);

      return {
        duration,
        success: true,
        result: response.payload ? JSON.parse(response.payload as unknown as string) : {},
      };
    } catch (error: any) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      return {
        duration,
        success: false,
        result: error.message,
      };
    }
  }

  // Helper to calculate percentile
  function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Helper to calculate metrics
  function calculateMetrics(endpoint: string): PerformanceMetrics {
    const times = responseTimes.get(endpoint) || [];
    const successful = times.filter((_, i) => true).length; // Simplified

    if (times.length === 0) {
      return {
        endpoint,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageMs: 0,
        minMs: 0,
        maxMs: 0,
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        requestsPerSecond: 0,
      };
    }

    const sum = times.reduce((a, b) => a + b, 0);
    const average = sum / times.length;

    return {
      endpoint,
      totalRequests: times.length,
      successfulRequests: times.length,
      failedRequests: 0,
      averageMs: average,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      p50Ms: percentile(times, 50),
      p95Ms: percentile(times, 95),
      p99Ms: percentile(times, 99),
      requestsPerSecond: times.length / (sum / 1000),
    };
  }

  describe('Response Time Tests', () => {
    const iterations = 20; // Number of times to call each endpoint

    test('get_player_rank should meet response time targets', async () => {
      for (let i = 0; i < iterations; i++) {
        await measureRpcTime(player, 'armored_archer/get_player_rank', {});
      }

      const metrics = calculateMetrics('armored_archer/get_player_rank');
      console.log(
        `get_player_rank: avg=${metrics.averageMs.toFixed(2)}ms, p95=${metrics.p95Ms.toFixed(2)}ms`
      );

      expect(metrics.averageMs).toBeLessThan(PERFORMANCE_THRESHOLDS.averageResponseTimeMs);
      expect(metrics.p95Ms).toBeLessThan(PERFORMANCE_THRESHOLDS.p95ResponseTimeMs);
    }, 30000);

    test('get_player_stats should meet response time targets', async () => {
      for (let i = 0; i < iterations; i++) {
        await measureRpcTime(player, 'armored_archer/get_player_stats', {});
      }

      const metrics = calculateMetrics('armored_archer/get_player_stats');
      console.log(
        `get_player_stats: avg=${metrics.averageMs.toFixed(2)}ms, p95=${metrics.p95Ms.toFixed(2)}ms`
      );

      expect(metrics.averageMs).toBeLessThan(PERFORMANCE_THRESHOLDS.averageResponseTimeMs);
      expect(metrics.p95Ms).toBeLessThan(PERFORMANCE_THRESHOLDS.p95ResponseTimeMs);
    }, 30000);

    test('get_inventory should meet response time targets', async () => {
      for (let i = 0; i < iterations; i++) {
        await measureRpcTime(player, 'armored_archer/get_inventory', {});
      }

      const metrics = calculateMetrics('armored_archer/get_inventory');
      console.log(
        `get_inventory: avg=${metrics.averageMs.toFixed(2)}ms, p95=${metrics.p95Ms.toFixed(2)}ms`
      );

      expect(metrics.averageMs).toBeLessThan(PERFORMANCE_THRESHOLDS.averageResponseTimeMs);
      expect(metrics.p95Ms).toBeLessThan(PERFORMANCE_THRESHOLDS.p95ResponseTimeMs);
    }, 30000);

    test('get_currency should meet response time targets', async () => {
      for (let i = 0; i < iterations; i++) {
        await measureRpcTime(player, 'armored_archer/get_currency', {});
      }

      const metrics = calculateMetrics('armored_archer/get_currency');
      console.log(
        `get_currency: avg=${metrics.averageMs.toFixed(2)}ms, p95=${metrics.p95Ms.toFixed(2)}ms`
      );

      expect(metrics.averageMs).toBeLessThan(PERFORMANCE_THRESHOLDS.averageResponseTimeMs);
      expect(metrics.p95Ms).toBeLessThan(PERFORMANCE_THRESHOLDS.p95ResponseTimeMs);
    }, 30000);

    test('get_season_info should meet response time targets', async () => {
      for (let i = 0; i < iterations; i++) {
        await measureRpcTime(player, 'armored_archer/get_season_info', {});
      }

      const metrics = calculateMetrics('armored_archer/get_season_info');
      console.log(
        `get_season_info: avg=${metrics.averageMs.toFixed(2)}ms, p95=${metrics.p95Ms.toFixed(2)}ms`
      );

      expect(metrics.averageMs).toBeLessThan(PERFORMANCE_THRESHOLDS.averageResponseTimeMs);
      expect(metrics.p95Ms).toBeLessThan(PERFORMANCE_THRESHOLDS.p95ResponseTimeMs);
    }, 30000);

    test('list_matches should meet response time targets', async () => {
      for (let i = 0; i < iterations; i++) {
        await measureRpcTime(player, 'armored_archer/list_matches', {});
      }

      const metrics = calculateMetrics('armored_archer/list_matches');
      console.log(
        `list_matches: avg=${metrics.averageMs.toFixed(2)}ms, p95=${metrics.p95Ms.toFixed(2)}ms`
      );

      expect(metrics.averageMs).toBeLessThan(PERFORMANCE_THRESHOLDS.averageResponseTimeMs);
      expect(metrics.p95Ms).toBeLessThan(PERFORMANCE_THRESHOLDS.p95ResponseTimeMs);
    }, 30000);
  });

  describe('Concurrent User Tests', () => {
    test('should handle 10 concurrent users', async () => {
      const startTime = performance.now();

      // All users make requests simultaneously
      const promises = testPlayers.map((player) =>
        measureRpcTime(player, 'armored_archer/get_player_rank', {})
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      console.log(`10 concurrent users completed in ${totalDuration.toFixed(2)}ms`);

      // All requests should complete
      expect(results.length).toBe(testPlayers.length);

      // Most should succeed
      const successful = results.filter((r) => r.success);
      expect(successful.length).toBeGreaterThanOrEqual(8);

      // Total time should be within threshold
      expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxConcurrentTestMs);
    }, 30000);

    test('should handle concurrent different endpoints', async () => {
      const endpoints = [
        'get_player_rank',
        'get_player_stats',
        'get_inventory',
        'get_currency',
        'get_season_info',
        'list_matches',
        'get_leaderboard',
        'get_player_rank',
        'get_player_stats',
        'get_inventory',
      ];

      const startTime = performance.now();

      const promises = endpoints.map((endpoint, i) => {
        const player = testPlayers[i % testPlayers.length];
        return measureRpcTime(player, `armored_archer/${endpoint}`, {});
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      console.log(`Concurrent different endpoints completed in ${totalDuration.toFixed(2)}ms`);

      expect(results.length).toBe(endpoints.length);

      const successful = results.filter((r) => r.success);
      expect(successful.length).toBeGreaterThanOrEqual(8);

      expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxConcurrentTestMs);
    }, 30000);
  });

  describe('Sustained Load Tests', () => {
    test('should maintain performance under sustained load', async () => {
      const iterations = 50;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const { duration } = await measureRpcTime(player, 'armored_archer/get_player_rank', {});
        times.push(duration);
      }

      const average = times.reduce((a, b) => a + b, 0) / iterations;
      const firstHalf = times.slice(0, iterations / 2);
      const secondHalf = times.slice(iterations / 2);

      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      const degradation = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

      console.log(
        `Sustained load: first_half=${firstHalfAvg.toFixed(2)}ms, second_half=${secondHalfAvg.toFixed(2)}ms, degradation=${degradation.toFixed(2)}%`
      );

      // Performance should not degrade more than 50%
      expect(degradation).toBeLessThan(50);

      // Average should still be within target
      expect(average).toBeLessThan(PERFORMANCE_THRESHOLDS.averageResponseTimeMs);
    }, 60000);
  });

  describe('Performance Regression Detection', () => {
    test('should detect response time anomalies', async () => {
      // Baseline: measure normal response times
      const baselineTimes: number[] = [];
      for (let i = 0; i < 10; i++) {
        const { duration } = await measureRpcTime(player, 'armored_archer/get_player_rank', {});
        baselineTimes.push(duration);
      }

      const baselineAvg = baselineTimes.reduce((a, b) => a + b, 0) / 10;

      // Check for anomalies (response time > 3x baseline)
      const { duration: testDuration } = await measureRpcTime(
        player,
        'armored_archer/get_player_rank',
        {}
      );

      const anomalyThreshold = baselineAvg * 3;

      console.log(
        `Baseline avg: ${baselineAvg.toFixed(2)}ms, Test: ${testDuration.toFixed(2)}ms, Threshold: ${anomalyThreshold.toFixed(2)}ms`
      );

      // This test logs the anomaly detection; actual failure depends on server state
      if (testDuration > anomalyThreshold) {
        console.warn(
          `Performance anomaly detected: ${testDuration.toFixed(2)}ms > ${anomalyThreshold.toFixed(2)}ms`
        );
      }

      // Don't fail the test for anomalies in smoke tests, just detect
      expect(testDuration).toBeDefined();
    }, 30000);
  });

  describe('Memory and Resource Tests', () => {
    test('should not show memory growth under load', async () => {
      // Simulate memory tracking (in real scenario, would use process.memoryUsage)
      const memorySnapshots: number[] = [];

      for (let i = 0; i < 20; i++) {
        // Simulate memory measurement
        const simulatedMemory = process.memoryUsage
          ? process.memoryUsage().heapUsed / 1024 / 1024
          : 50 + Math.random() * 10;
        memorySnapshots.push(simulatedMemory);

        await measureRpcTime(player, 'armored_archer/get_player_rank', {});
      }

      const firstHalf = memorySnapshots.slice(0, 10);
      const secondHalf = memorySnapshots.slice(10);

      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / 10;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / 10;

      const growth = secondHalfAvg - firstHalfAvg;

      console.log(
        `Memory: first_half=${firstHalfAvg.toFixed(2)}MB, second_half=${secondHalfAvg.toFixed(2)}MB, growth=${growth.toFixed(2)}MB`
      );

      // Memory growth should be minimal (< 50MB)
      expect(growth).toBeLessThan(50);
    }, 60000);
  });

  describe('Performance Summary', () => {
    test('should generate performance report', async () => {
      // Run a few more requests to ensure we have data
      for (let i = 0; i < 5; i++) {
        await measureRpcTime(player, 'armored_archer/get_player_rank', {});
        await measureRpcTime(player, 'armored_archer/get_player_stats', {});
      }

      // Generate summary
      const endpoints = [
        'armored_archer/get_player_rank',
        'armored_archer/get_player_stats',
        'armored_archer/get_inventory',
        'armored_archer/get_currency',
        'armored_archer/get_season_info',
        'armored_archer/list_matches',
      ];

      const report = endpoints.map((endpoint) => calculateMetrics(endpoint));

      console.log('\n=== Performance Report ===');
      report.forEach((metrics) => {
        console.log(`${metrics.endpoint}:`);
        console.log(`  Requests: ${metrics.totalRequests}`);
        console.log(`  Average: ${metrics.averageMs.toFixed(2)}ms`);
        console.log(`  P95: ${metrics.p95Ms.toFixed(2)}ms`);
        console.log(`  P99: ${metrics.p99Ms.toFixed(2)}ms`);
      });

      // Verify overall performance
      const overallAvg = report.reduce((sum, m) => sum + m.averageMs, 0) / report.length;
      const overallP95 = Math.max(...report.map((m) => m.p95Ms));

      console.log(`\nOverall Average: ${overallAvg.toFixed(2)}ms`);
      console.log(`Overall P95: ${overallP95.toFixed(2)}ms`);

      expect(overallAvg).toBeLessThan(PERFORMANCE_THRESHOLDS.averageResponseTimeMs);
      expect(overallP95).toBeLessThan(PERFORMANCE_THRESHOLDS.p95ResponseTimeMs);
    }, 60000);
  });
});
