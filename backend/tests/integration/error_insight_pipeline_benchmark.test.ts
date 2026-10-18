/**
 * Error insight pipeline benchmark (TD-004 / issue #1665).
 *
 * The pipeline sits on the error-ingestion path, so per-error overhead
 * multiplies under incident load. Before the #1665 optimization, a 10k-error
 * burst cost >110s locally (every collectError re-analyzed the entire
 * rolling window, re-parsing every timestamp). After: ~2s.
 *
 * Budgets below are set with ~10x headroom over local measurements to stay
 * green on shared CI runners while still catching a regression back to
 * quadratic behavior. Needs no Nakama/PostgreSQL services and no Godot
 * snapshot.
 */

jest.mock('../../src/config', () => ({
  config: {
    errorInsights: {
      enabled: true,
      aggregationWindowMinutes: 15,
      maxInsights: 100,
      minOccurrencesForInsight: 3,
      patternTtlDays: 7,
    },
  },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { collectError, getErrorStore } from '../../src/modules/error_insight_pipeline';

// Budgets: ~10x headroom over local post-optimization measurements
// (burst 1.9s, window queries <0.1s for 100 scans of a full store).
const BURST_BUDGET_MS = 20_000;
const RANGE_QUERY_BUDGET_MS = 1_000;

describe('error insight pipeline benchmark (TD-004)', () => {
  beforeEach(() => {
    getErrorStore().clear();
  });

  it('absorbs a 10k-error burst within budget', () => {
    const N = 10_000;
    const start = performance.now();
    for (let i = 0; i < N; i++) {
      collectError(new Error(`database timeout shard-${i % 50}`), {
        rpcName: `rpc_${i % 25}`,
        userId: `user-${i % 200}`,
      });
    }
    const elapsed = performance.now() - start;
    console.log(
      `BENCH collectError x${N}: ${elapsed.toFixed(0)}ms (${(elapsed / N).toFixed(3)}ms/op)`
    );
    expect(elapsed).toBeLessThan(BURST_BUDGET_MS);
  });

  it('answers range queries over a full store within budget', () => {
    for (let i = 0; i < 10_000; i++) {
      collectError(new Error(`cache miss storm ${i % 40}`), { rpcName: `rpc_${i % 25}` });
    }
    const store = getErrorStore();

    const start = performance.now();
    for (let q = 0; q < 100; q++) {
      store.getErrorsInRange(new Date(Date.now() - 15 * 60 * 1000), new Date());
    }
    const elapsed = performance.now() - start;
    console.log(`BENCH 100x getErrorsInRange over 10k store: ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(RANGE_QUERY_BUDGET_MS);
  });
});
