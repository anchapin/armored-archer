module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Include scripts/ so tooling tests (e.g. scripts/__tests__/
  // validate-nakama-bundle.test.ts, issue #994) are discovered by `npm test`.
  // Same approach as jest.schema.config.js, which adds <rootDir>/tests because
  // tests outside `roots` match zero tests. Only *.test.ts / *.spec.ts files
  // inside scripts/__tests__/ are picked up — testMatch is unchanged.
  roots: ['<rootDir>/src', '<rootDir>/scripts'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
    '!src/utils/redis.ts',
    '!src/utils/eslint-rules/**',
    '!src/config/errorTracking.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json', 'json-summary'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Performance tracking configuration
  // Enable performance metrics for detecting regressions
  // Note: Jest natively tracks test durations in the JSON reporter
  // NOTE: Custom performance reporter disabled - causes coverage collection to fail
  // reporters: [
  //   'default',
  //   ['<rootDir>/jest-performance-reporter.js', {
  //     thresholds: {
  //       test: 5000,
  //       suite: 30000,
  //       total: 120000,
  //       warning: 2000
  //     }
  //   }]
  // ],
  // Coverage thresholds - adjusted to actual coverage
  // Policy (issue #1071): every sub-80% per-file exception must either be
  // raised to the global gate (80/80/80/80) or carry a tracked ramp plan
  // (open issue reference + target date). Modules below the gate with
  // ratcheted thresholds are annotated with their tracking issue; raise
  // each to the gate and delete its ramp comment when the issue lands.
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Critical modules - high thresholds
    './src/modules/combat_system.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Raised to the global gate in issue #1071 (actual coverage on
    // 2026-08-18: 92/84/96/92 — stmts/branch/funcs/lines).
    './src/modules/rpg_system.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Raised to the global gate in issue #1071 (actual 91/82/94/91).
    './src/modules/matchmaker.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Ramp plan #1177: branches/functions ratcheted to just below actual
    // (79.2/76.4); statements/lines at the gate. Target: 80/80/80/80 by
    // 2026-10-15.
    './src/modules/gear_system.ts': {
      branches: 78,
      functions: 75,
      lines: 80,
      statements: 80
    },
    // Analytics module
    './src/modules/analytics.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
// Config module - 73% functions is the maximum achievable because
    // 3 TypeScript interface definitions (lines 137, 151, 252) create phantom
    // function entries in Istanbul/babel coverage instrumentation. All real
    // executable functions (11 total) are covered at 100%.
    //
    // Branches (66) and functions (73) thresholds are set below actual
    // measured coverage to handle variance between local and act CI
    // environments — the REVENUECAT/SESSION_ENCRYPTION env branches are only
    // exercised when those env vars are set, and interfaces create phantom
    // function entries (see above).
    //
    // Ramp plan #1177 (step 2026-09-15): statements/lines ratcheted from 78
    // up to 79 to lock current actual coverage (79.61/79.41 measured with
    // REVENUECAT/SESSION_ENCRYPTION unset — the act-CI floor). The full
    // 80/80/80 gate lands by 2026-10-31 via #1177 once the #1171
    // config-missing env-branch tests are restored.
    './src/config/index.ts': {
      branches: 66,
      functions: 73,
      lines: 79,
      statements: 79
    },
    // Raised to the global gate in issue #1071 (actual 96/85/100/96).
    './src/modules/stage_tracking.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Notifications
    './src/modules/notifications.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Metrics
    './src/modules/metrics.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Performance tracking modules
    './src/modules/error_insight_pipeline.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/modules/alerting.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/modules/health_monitor.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Season system - raised to the global gate in issue #1071
    // (actual 99/83/100/99).
    './src/modules/season_system.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Store - Ramp plan #1177: branches ratcheted to 78 (actual 78.2);
    // everything else at the gate. Target: 80/80/80/80 by 2026-10-31.
    './src/modules/store.ts': {
      branches: 78,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Progressive rollout
    './src/modules/progressive_rollout.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Datadog integration
    './src/modules/datadog_integration.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Files with lower coverage - grandfathered exceptions (issue #1071):
    // each remaining sub-80 exception carries a tracked ramp plan.
    //
    // Season leaderboard - raised to the global gate in issue #1071.
    // Core ranking logic (applyDailyDecay, getTopPlayers, getPlayerRank,
    // recordSeasonCompletion) is exercised by
    // __tests__/season_leaderboard_core.test.ts; RPC surface by
    // __tests__/season_leaderboard_rpc.test.ts.
    './src/modules/season_leaderboard.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Ramp plan #1177: branches/functions ratcheted to just below actual
    // (76.6/80.6); statements/lines at the gate. Target: 80/80/80/80 by
    // 2026-10-15.
    './src/modules/dynamic_difficulty.ts': {
      branches: 74,
      functions: 76,
      lines: 80,
      statements: 80
    },
    // Ramp plan #1177: all metrics ~58-64 (actual 59.8/58.3/64.3/58.9).
    // Target: 80/80/80/80 by 2026-09-30.
    './src/modules/encounter_pacing.ts': {
      branches: 58,
      functions: 64,
      lines: 58,
      statements: 59
    },
    // #1071 follow-up resolved: the #1176 coverage ramp landed and this
    // module now sits at the standard 80% gate.
    './src/modules/weapon_balance.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2020',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'bundler'
      }
    }],
    // Transform JS files with Babel for ES module support
    '^.+\\.js$': 'babel-jest'
  },
  // Fix for uuid ES module compatibility (Issue #615)
  // Transform uuid package which uses ES module syntax
  transformIgnorePatterns: [
    '/node_modules/(?!(uuid)/)'
  ],
  testTimeout: 30000,  // 30 seconds for local/act testing
  verbose: true,
  passWithNoTests: true,
  // Use detectOpenHandles in development, forceExit in CI to prevent hanging
  // CI mode: detectOpenHandles can cause indefinite waits, so use forceExit instead
  detectOpenHandles: !process.env.CI,
  forceExit: !!process.env.CI,
  // Detect leaks to find unclosed resources
  detectLeaks: false,
  // Clear mocks between tests to prevent interference
  clearMocks: true,
  // Reset modules between tests
  resetModules: false,
  // Restore mocks after each test
  restoreMocks: true,
};
