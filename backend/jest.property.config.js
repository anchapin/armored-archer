/**
 * Jest config for property-based tests (issue #1031).
 *
 * The property-based suite lives in tests/unit/property_based.test.ts, which is
 * outside the default jest roots (src/, scripts/ — see AGENTS.md). This config
 * scopes a run to that directory so `npm run test:property` (and the
 * "Property-Based Tests" GitHub workflow) execute it explicitly.
 */
const base = require('./jest.config.js');

module.exports = {
  ...base,
  roots: ['<rootDir>/tests/unit'],
  collectCoverage: false,
  // The suite must always be discovered — a silent no-op pass would hide drift
  // (e.g. the file being renamed or moved out of tests/unit).
  passWithNoTests: false,
};
