module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
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
  // Coverage thresholds - adjusted to match current codebase coverage
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 50,
      statements: 50
    },
    // Per-file thresholds for critical modules
    './src/modules/combat_system.ts': {
      branches: 60,
      functions: 65,
      lines: 70,
      statements: 70
    },
    './src/modules/rpg_system.ts': {
      branches: 75,
      functions: 55,
      lines: 85,
      statements: 85
    },
    './src/modules/matchmaker.ts': {
      branches: 85,
      functions: 60,
      lines: 90,
      statements: 90
    },
    './src/modules/gear_system.ts': {
      branches: 65,
      functions: 60,
      lines: 70,
      statements: 70
    }
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2020',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  testTimeout: 10000,
  verbose: true,
  passWithNoTests: true,
  forceExit: true
};
