/**
 * Jest config for the benchmark regression gate (issue #1031).
 *
 * The Go benchmark pipeline (`go test -bench` + benchstat baseline comparison)
 * was retired together with the abandoned Go backend migration. The TypeScript
 * replacement gate is the self-contained performance-threshold suite:
 * tests/integration/low_end_device_performance.test.ts.
 *
 * It is intentionally limited to that file:
 * - It needs no Nakama/PostgreSQL stack (pure timing/threshold assertions), so
 *   the "Benchmark Regression" workflow can run it without services.
 * - tests/integration/performance_smoke.test.ts DOES need the live stack and is
 *   covered by the integration job in ci.yml — do not add it here.
 *
 * maxWorkers: 1 keeps timing measurements stable (no parallel CPU contention).
 */
const base = require('./jest.config.js');

module.exports = {
  ...base,
  roots: ['<rootDir>/tests'],
  testMatch: ['**/tests/integration/low_end_device_performance.test.ts'],
  collectCoverage: false,
  passWithNoTests: false,
  maxWorkers: 1,
  testTimeout: 60000,
};
