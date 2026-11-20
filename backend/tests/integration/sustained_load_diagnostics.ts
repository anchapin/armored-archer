export interface SustainedLoadSample {
  durationMs: number;
  success: boolean;
}

function summarizeHalf(samples: readonly SustainedLoadSample[]) {
  const sorted = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
  const count = sorted.length;
  const middle = Math.floor(count / 2);

  return {
    count,
    successes: samples.filter((sample) => sample.success).length,
    failures: samples.filter((sample) => !sample.success).length,
    meanMs: count ? sorted.reduce((sum, duration) => sum + duration, 0) / count : null,
    medianMs: count
      ? count % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle]
      : null,
    p95Ms: count ? sorted[Math.ceil(count * 0.95) - 1] : null,
    maxMs: count ? sorted[count - 1] : null,
  };
}

/** Diagnostics only. Never drops failures, rounds values, or changes the gate's inputs. */
export function describeSustainedLoad(samples: readonly SustainedLoadSample[]) {
  const midpoint = Math.floor(samples.length / 2);
  return {
    requests: samples.map((sample, index) => ({
      request: index + 1,
      durationMs: sample.durationMs,
      outcome: sample.success ? 'success' : 'failure',
    })),
    firstHalf: summarizeHalf(samples.slice(0, midpoint)),
    secondHalf: summarizeHalf(samples.slice(midpoint)),
  };
}
