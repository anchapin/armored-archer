/**
 * Jest config dedicated to the database schema validation suite
 * (`tests/integration/schema.test.ts`).
 *
 * Why this config exists (Issue #893):
 *   The main `jest.config.js` restricts `roots` to `<rootDir>/src` and
 *   sets `passWithNoTests: true`. The previous `npm run test:schema`
 *   script invoked `jest tests/integration/schema.test.ts` — a path
 *   outside `roots` — so jest matched zero tests and exited green
 *   under `passWithNoTests`. That hid real schema drift from CI.
 *
 *   This dedicated config:
 *     - adds `<rootDir>/tests` to `roots` so jest can discover the file
 *     - scopes `testMatch` to the schema test only (not the wider
 *       `tests/integration/**` matcher used by `jest.integration.config.js`,
 *       which assumes a running Nakama server)
 *     - leaves `passWithNoTests` at its default `false`, so a missing
 *       schema test fails loudly instead of silently passing
 *
 *   Existing suites are unaffected:
 *     - `npm test` still uses `jest.config.js`
 *     - `npm run test:integration` still uses `jest.integration.config.js`
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  // Scope tightly: only the schema migration suite. Other files in
  // tests/integration/ require a running Nakama server and must NOT
  // run under `npm run test:schema` (which only assumes a Postgres
  // connection).
  testMatch: ['<rootDir>/tests/integration/schema.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverage: false,
  testTimeout: 60000,
  verbose: true,
  // No `passWithNoTests: true` — a missing schema test must fail the
  // build rather than silently pass.
  detectOpenHandles: true,
  detectLeaks: false,
  clearMocks: true,
  resetModules: false,
  restoreMocks: true,
  maxWorkers: 1,
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'ES2020',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          moduleResolution: 'bundler',
        },
      },
    ],
  },
  // Transform uuid package which uses ES module syntax (matches the
  // convention in `jest.integration.config.js`).
  transformIgnorePatterns: ['/node_modules/(?!(uuid)/)'],
};