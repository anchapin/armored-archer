/**
 * Low-End Device Performance Benchmark Gate (issue #1073)
 *
 * This gate consumes REAL client measurements instead of simulated values:
 * a headless Godot run of the actual gameplay scene
 * (scripts/run-headless-performance-benchmark.sh -> test/benchmark/headless_benchmark.gd)
 * exports a PerformanceProfiler snapshot to
 * fixtures/performance/generated/headless_benchmark.snapshot.json, and this
 * suite validates that snapshot against the shared threshold config
 * (fixtures/performance/performance-targets.json).
 *
 * The gate FAILS when no snapshot exists - it can no longer pass vacuously.
 * It still needs no Nakama/PostgreSQL services, only the generated snapshot.
 *
 * Thresholds are sourced exclusively from performance-targets.json (single
 * source of truth); docs/PERFORMANCE.md mirrors them for humans and its
 * Budget-tier row is cross-checked against the config below.
 */

import { readFileSync } from 'fs';
import * as path from 'path';

// --- Shared configuration (single source of truth) ---

interface TierThresholds {
  targetFps: number;
  minFps: number;
  maxParticles: number;
  shadowQuality: number;
  memoryThresholdMb: number;
}

interface PerformanceTargets {
  schemaVersion: number;
  deviceTiers: {
    flagship: TierThresholds;
    midRange: TierThresholds;
    budget: TierThresholds;
  };
  budgetDevice: {
    maxMemoryMb: number;
    maxFrameTimeMs: number;
    maxNetworkLatencyMs: number;
  };
  memoryLeakDetection: {
    growthThresholdMb: number;
    growthRateThresholdMbPerMin: number;
    requiredSamples: number;
  };
  headlessBenchmark: {
    source: string;
    minFrames: number;
    minMeasuredSeconds: number;
    minAverageFps: number;
    maxAvgFrameTimeMs: number;
    maxPeakMemoryMb: number;
  };
}

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'performance');
const TARGETS_PATH = path.join(FIXTURES_DIR, 'performance-targets.json');
const GENERATED_SNAPSHOT_PATH = path.join(
  FIXTURES_DIR,
  'generated',
  'headless_benchmark.snapshot.json'
);
const EXAMPLE_SNAPSHOT_PATH = path.join(FIXTURES_DIR, 'headless_benchmark.example.snapshot.json');
const PERFORMANCE_DOC_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'PERFORMANCE.md');

function loadPerformanceTargets(): PerformanceTargets {
  return JSON.parse(readFileSync(TARGETS_PATH, 'utf8')) as PerformanceTargets;
}

// --- Real snapshot loading (the gate's input) ---

interface BenchmarkSnapshot {
  schemaVersion?: number;
  source?: string;
  generatedAt?: number;
  godotVersion?: string;
  platform?: string;
  displayServer?: string;
  scenePath?: string;
  framesRun?: number;
  warmupFrames?: number;
  measuredWallSeconds?: number;
  benchmarkSceneNodeCount?: number;
  profiler?: Record<string, unknown>;
  [key: string]: unknown;
}

function snapshotGenerationHint(): string {
  return [
    'No real benchmark snapshot found.',
    'The gate requires measurements from an actual headless Godot run of the client.',
    'Generate one with: ./scripts/run-headless-performance-benchmark.sh',
    `(expected at ${GENERATED_SNAPSHOT_PATH}, or override with PERF_BENCHMARK_SNAPSHOT)`,
  ].join(' ');
}

function loadGeneratedSnapshot(): BenchmarkSnapshot {
  const snapshotPath = process.env.PERF_BENCHMARK_SNAPSHOT || GENERATED_SNAPSHOT_PATH;
  const raw = readFileSync(snapshotPath, 'utf8');
  return JSON.parse(raw) as BenchmarkSnapshot;
}

function loadExampleSnapshot(): BenchmarkSnapshot {
  // EXAMPLE fixture - used ONLY to unit-test the evaluator logic below.
  // The gate itself never reads this file.
  return JSON.parse(readFileSync(EXAMPLE_SNAPSHOT_PATH, 'utf8')) as BenchmarkSnapshot;
}

// --- Snapshot evaluation (pure logic, unit-tested against the example fixture) ---

interface EvaluationResult {
  passed: boolean;
  failures: string[];
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Validates snapshot structure/provenance and evaluates the profiler
 * measurements against the headless benchmark thresholds from the shared
 * config. Returns every failure so reports show the full picture.
 */
function evaluateSnapshotAgainstThresholds(
  snapshot: BenchmarkSnapshot,
  targets: PerformanceTargets
): EvaluationResult {
  const failures: string[] = [];
  const gate = targets.headlessBenchmark;

  // Structural + provenance checks: the measurement must come from a real
  // engine run of the real gameplay scene.
  if (snapshot.schemaVersion !== 1) {
    failures.push(`snapshot.schemaVersion must be 1 (got ${String(snapshot.schemaVersion)})`);
  }
  if (snapshot.source !== gate.source) {
    failures.push(
      `snapshot.source must be "${gate.source}" (got ${String(snapshot.source)}) - ` +
        'refusing to evaluate a measurement of unknown provenance'
    );
  }
  if (typeof snapshot.godotVersion !== 'string' || !/^4\./.test(snapshot.godotVersion)) {
    failures.push(
      `snapshot.godotVersion must be a Godot 4.x version string (got ${String(snapshot.godotVersion)})`
    );
  }
  if (typeof snapshot.displayServer !== 'string' || snapshot.displayServer === '') {
    failures.push('snapshot.displayServer must be a non-empty string');
  }
  if (snapshot.scenePath !== 'res://scenes/main.tscn') {
    failures.push(
      `snapshot.scenePath must be the real gameplay scene res://scenes/main.tscn ` +
        `(got ${String(snapshot.scenePath)})`
    );
  }

  // Measurement-window checks: enough frames over enough wall time to be
  // representative (guards against a snapshot captured from a truncated run).
  const framesRun = num(snapshot.framesRun);
  if (framesRun === null || framesRun < gate.minFrames) {
    failures.push(
      `snapshot.framesRun must be >= ${gate.minFrames} (got ${String(snapshot.framesRun)})`
    );
  }
  const measuredSeconds = num(snapshot.measuredWallSeconds);
  if (measuredSeconds === null || measuredSeconds < gate.minMeasuredSeconds) {
    failures.push(
      `snapshot.measuredWallSeconds must be >= ${gate.minMeasuredSeconds} ` +
        `(got ${String(snapshot.measuredWallSeconds)})`
    );
  }

  // The measurement window must be unthrottled: a capped Engine.max_fps (e.g.
  // the budget tier's 30 FPS) hides the real per-frame cost behind sleep time.
  if (num(snapshot.engineMaxFps) !== 0) {
    failures.push(
      `snapshot.engineMaxFps must be 0 (uncapped) during measurement ` +
        `(got ${String(snapshot.engineMaxFps)}) - a throttled run measures the ` +
        'throttle interval, not real frame cost'
    );
  }

  // Profiler measurement checks (real numbers from PerformanceProfiler).
  const profiler = snapshot.profiler;
  if (profiler === undefined || profiler === null) {
    failures.push('snapshot.profiler (PerformanceProfiler snapshot) is missing');
    return { passed: false, failures };
  }

  const averageFps = num(profiler.average_fps);
  if (averageFps === null) {
    failures.push('profiler.average_fps missing or not a finite number');
  } else if (averageFps < gate.minAverageFps) {
    failures.push(
      `REAL average FPS ${averageFps.toFixed(1)} is below the budget minimum ` +
        `${gate.minAverageFps} (regression: frame cost too high for budget devices)`
    );
  }

  const avgFrameTimeMs = num(profiler.avg_frame_time_ms);
  if (avgFrameTimeMs === null) {
    failures.push('profiler.avg_frame_time_ms missing or not a finite number');
  } else if (avgFrameTimeMs > gate.maxAvgFrameTimeMs) {
    failures.push(
      `REAL average frame time ${avgFrameTimeMs.toFixed(2)}ms exceeds the budget-device ` +
        `frame budget ${gate.maxAvgFrameTimeMs}ms (regression detected on real measurement)`
    );
  }

  const peakMemoryMb = num(profiler.memory_peak_mb);
  if (peakMemoryMb === null) {
    failures.push('profiler.memory_peak_mb missing or not a finite number');
  } else if (peakMemoryMb > gate.maxPeakMemoryMb) {
    failures.push(
      `REAL peak static memory ${peakMemoryMb.toFixed(1)}MB exceeds the budget device ` +
        `limit ${gate.maxPeakMemoryMb}MB (regression detected on real measurement)`
    );
  }

  if (profiler.memory_leak_detected === true) {
    failures.push(
      `PerformanceProfiler flagged a memory leak during the run: ${String(profiler.memory_growth_mb)}MB growth`
    );
  }

  return { passed: failures.length === 0, failures };
}

// --- The gate ---

describe('Low-End Device Performance Benchmark Gate (real measurements)', () => {
  const targets = loadPerformanceTargets();

  describe('Shared threshold config (single source of truth)', () => {
    it('loads and has the required schema', () => {
      expect(targets.schemaVersion).toBe(1);
      expect(targets.deviceTiers).toBeDefined();
      expect(targets.budgetDevice).toBeDefined();
      expect(targets.memoryLeakDetection).toBeDefined();
      expect(targets.headlessBenchmark).toBeDefined();
    });

    it('keeps tier thresholds internally consistent', () => {
      for (const [tierName, tier] of Object.entries(targets.deviceTiers)) {
        expect(tier.minFps).toBeLessThan(tier.targetFps);
        expect(tier.maxParticles).toBeGreaterThan(0);
        expect(tier.memoryThresholdMb).toBeGreaterThan(0);
        expect([0, 1, 2]).toContain(tier.shadowQuality);
        expect(tierName).toBeTruthy();
      }
    });

    it('derives the frame-time budget from the budget target FPS (no hand-copied constants)', () => {
      const budget = targets.deviceTiers.budget;
      expect(targets.budgetDevice.maxFrameTimeMs).toBeCloseTo(1000 / budget.targetFps, 1);
      expect(targets.headlessBenchmark.maxAvgFrameTimeMs).toBeCloseTo(
        1000 / budget.targetFps,
        1
      );
      expect(targets.headlessBenchmark.minAverageFps).toBe(budget.minFps);
      expect(targets.budgetDevice.maxMemoryMb).toBe(budget.memoryThresholdMb);
      expect(targets.headlessBenchmark.maxPeakMemoryMb).toBe(budget.memoryThresholdMb);
    });

    it('matches the Budget tier row in docs/PERFORMANCE.md (doc stays in sync)', () => {
      const doc = readFileSync(PERFORMANCE_DOC_PATH, 'utf8');
      const budget = targets.deviceTiers.budget;
      const rowPattern = new RegExp(
        String.raw`\*\*Budget\*\*[^|]*\|[^|]*\|\s*${budget.targetFps}\s*\|\s*${budget.minFps}\s*\|\s*${budget.maxParticles}\s*\|`
      );
      expect(doc).toMatch(rowPattern);
      expect(doc).toMatch(
        new RegExp(String.raw`\*\*Budget\*\*\s*\|\s*${budget.memoryThresholdMb}\s*MB`)
      );
      // The doc must point readers at the canonical machine-readable config.
      expect(doc).toContain('performance-targets.json');
    });
  });

  describe('Real headless benchmark snapshot', () => {
    it('exists - the gate cannot pass without a real measurement', () => {
      const snapshotPath = process.env.PERF_BENCHMARK_SNAPSHOT || GENERATED_SNAPSHOT_PATH;
      let exists = true;
      let parseError: string | null = null;
      try {
        JSON.parse(readFileSync(snapshotPath, 'utf8'));
      } catch (error) {
        exists = false;
        parseError = error instanceof Error ? error.message : String(error);
      }
      expect(
        exists ? 'present' : `missing/unreadable (${parseError}). ${snapshotGenerationHint()}`
      ).toBe('present');
    });

    it('passes the budget-device thresholds from the shared config', () => {
      const snapshot = loadGeneratedSnapshot();
      const result = evaluateSnapshotAgainstThresholds(snapshot, targets);
      expect(result.failures).toEqual([]);
      expect(result.passed).toBe(true);
    });

    it('captures a representative measurement window', () => {
      const snapshot = loadGeneratedSnapshot();
      const gate = targets.headlessBenchmark;
      expect(snapshot.framesRun).toBeGreaterThanOrEqual(gate.minFrames);
      expect(snapshot.measuredWallSeconds).toBeGreaterThanOrEqual(gate.minMeasuredSeconds);
      expect(snapshot.benchmarkSceneNodeCount).toBeGreaterThan(1);
    });

    it('reports real PerformanceProfiler fields', () => {
      const profiler = loadGeneratedSnapshot().profiler;
      expect(profiler).toBeDefined();
      expect(num(profiler?.average_fps)).not.toBeNull();
      expect(num(profiler?.avg_frame_time_ms)).not.toBeNull();
      expect(num(profiler?.memory_peak_mb)).not.toBeNull();
      expect(num(profiler?.memory_current_mb)).not.toBeNull();
      expect(typeof profiler?.device_tier).toBe('string');
      expect(typeof profiler?.memory_leak_detected).toBe('boolean');
    });
  });

  describe('Snapshot evaluator logic (example fixture - not used by the gate)', () => {
    // These tests exercise evaluateSnapshotAgainstThresholds() against a
    // clearly-labeled EXAMPLE fixture so regressions in the evaluator itself
    // are caught independently of a live Godot run.
    it('accepts a well-formed, passing example snapshot', () => {
      const result = evaluateSnapshotAgainstThresholds(loadExampleSnapshot(), targets);
      expect(result.failures).toEqual([]);
      expect(result.passed).toBe(true);
    });

    it('fails a snapshot whose real frame time exceeds the budget', () => {
      const snapshot = loadExampleSnapshot();
      snapshot.profiler!.avg_frame_time_ms = targets.headlessBenchmark.maxAvgFrameTimeMs + 5;
      const result = evaluateSnapshotAgainstThresholds(snapshot, targets);
      expect(result.passed).toBe(false);
      expect(result.failures.join('\n')).toMatch(/average frame time .* exceeds/);
    });

    it('fails a snapshot whose real average FPS is below the budget minimum', () => {
      const snapshot = loadExampleSnapshot();
      snapshot.profiler!.average_fps = targets.headlessBenchmark.minAverageFps - 1;
      const result = evaluateSnapshotAgainstThresholds(snapshot, targets);
      expect(result.passed).toBe(false);
      expect(result.failures.join('\n')).toMatch(/average FPS .* below the budget minimum/);
    });

    it('fails a snapshot whose real peak memory exceeds the budget limit', () => {
      const snapshot = loadExampleSnapshot();
      snapshot.profiler!.memory_peak_mb = targets.headlessBenchmark.maxPeakMemoryMb + 1;
      const result = evaluateSnapshotAgainstThresholds(snapshot, targets);
      expect(result.passed).toBe(false);
      expect(result.failures.join('\n')).toMatch(/peak static memory .* exceeds/);
    });

    it('fails a snapshot with too few measured frames', () => {
      const snapshot = loadExampleSnapshot();
      snapshot.framesRun = 10;
      const result = evaluateSnapshotAgainstThresholds(snapshot, targets);
      expect(result.passed).toBe(false);
      expect(result.failures.join('\n')).toMatch(/framesRun must be >=/);
    });

    it('fails a snapshot measured through a frame-rate cap', () => {
      const snapshot = loadExampleSnapshot();
      snapshot.engineMaxFps = 30;
      const result = evaluateSnapshotAgainstThresholds(snapshot, targets);
      expect(result.passed).toBe(false);
      expect(result.failures.join('\n')).toMatch(/must be 0 \(uncapped\)/);
    });

    it('fails a snapshot with an unprovenanced source', () => {
      const snapshot = loadExampleSnapshot();
      snapshot.source = 'hand-written';
      const result = evaluateSnapshotAgainstThresholds(snapshot, targets);
      expect(result.passed).toBe(false);
      expect(result.failures.join('\n')).toMatch(/unknown provenance/);
    });

    it('fails a snapshot measured against the wrong scene', () => {
      const snapshot = loadExampleSnapshot();
      snapshot.scenePath = 'res://scenes/ui/login_screen.tscn';
      const result = evaluateSnapshotAgainstThresholds(snapshot, targets);
      expect(result.passed).toBe(false);
      expect(result.failures.join('\n')).toMatch(/real gameplay scene/);
    });

    it('fails a snapshot flagged with a memory leak', () => {
      const snapshot = loadExampleSnapshot();
      snapshot.profiler!.memory_leak_detected = true;
      snapshot.profiler!.memory_growth_mb = 80;
      const result = evaluateSnapshotAgainstThresholds(snapshot, targets);
      expect(result.passed).toBe(false);
      expect(result.failures.join('\n')).toMatch(/memory leak/);
    });

    it('fails a snapshot missing the profiler block entirely', () => {
      const snapshot = loadExampleSnapshot();
      delete snapshot.profiler;
      const result = evaluateSnapshotAgainstThresholds(snapshot, targets);
      expect(result.passed).toBe(false);
      expect(result.failures.join('\n')).toMatch(/profiler .* missing/);
    });
  });
});
