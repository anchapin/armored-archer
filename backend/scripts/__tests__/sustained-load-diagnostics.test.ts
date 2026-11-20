import { describeSustainedLoad } from '../../tests/integration/sustained_load_diagnostics';

describe('sustained-load diagnostics', () => {
  test('keeps all 50 requests in order, including failures, without mutating inputs', () => {
    const samples = Array.from({ length: 50 }, (_, index) =>
      Object.freeze({ durationMs: index + 0.125, success: index !== 27 })
    );
    Object.freeze(samples);

    const diagnostics = describeSustainedLoad(samples);

    expect(diagnostics.requests).toEqual(
      samples.map((sample, index) => ({
        request: index + 1,
        durationMs: sample.durationMs,
        outcome: sample.success ? 'success' : 'failure',
      }))
    );
    expect(diagnostics.firstHalf).toEqual({
      count: 25,
      successes: 25,
      failures: 0,
      meanMs: 12.125,
      medianMs: 12.125,
      p95Ms: 23.125,
      maxMs: 24.125,
    });
    expect(diagnostics.secondHalf).toEqual({
      count: 25,
      successes: 24,
      failures: 1,
      meanMs: 37.125,
      medianMs: 37.125,
      p95Ms: 48.125,
      maxMs: 49.125,
    });
  });

  test('uses an even-sample median and nearest-rank p95, retaining outliers and zero times', () => {
    const diagnostics = describeSustainedLoad(
      [4, 0, 2, 100, 8, 6, 10, 12].map((durationMs) => ({ durationMs, success: true }))
    );
    expect(diagnostics.firstHalf).toEqual({
      count: 4,
      successes: 4,
      failures: 0,
      meanMs: 26.5,
      medianMs: 3,
      p95Ms: 100,
      maxMs: 100,
    });
    expect(diagnostics.secondHalf.medianMs).toBe(9);
  });

  test('reports empty halves without inventing zero-latency measurements', () => {
    expect(describeSustainedLoad([])).toEqual({
      requests: [],
      firstHalf: {
        count: 0,
        successes: 0,
        failures: 0,
        meanMs: null,
        medianMs: null,
        p95Ms: null,
        maxMs: null,
      },
      secondHalf: {
        count: 0,
        successes: 0,
        failures: 0,
        meanMs: null,
        medianMs: null,
        p95Ms: null,
        maxMs: null,
      },
    });
  });

  test('puts an odd trailing sample in the second half and retains a failed single request', () => {
    const diagnostics = describeSustainedLoad([{ durationMs: 1.23456789, success: false }]);
    expect(diagnostics.firstHalf.count).toBe(0);
    expect(diagnostics.secondHalf).toEqual({
      count: 1,
      successes: 0,
      failures: 1,
      meanMs: 1.23456789,
      medianMs: 1.23456789,
      p95Ms: 1.23456789,
      maxMs: 1.23456789,
    });
    expect(diagnostics.requests[0]).toEqual({
      request: 1,
      durationMs: 1.23456789,
      outcome: 'failure',
    });
  });
});
