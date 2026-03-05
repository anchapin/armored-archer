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
  // Coverage thresholds for critical systems
  // Target 80%+ on: NetworkManager auth, CombatManager calculations, PlayerStatsManager XP
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 55,
      statements: 55
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
