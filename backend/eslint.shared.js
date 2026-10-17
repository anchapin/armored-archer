/**
 * Shared pieces for eslint.config.js and eslint.test.config.js.
 * Extracted to remove duplicated config blocks (jscpd clone cleanup, issue #1640).
 * Both consuming configs must produce the exact same computed config as before.
 */

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const jsdocPlugin = require('eslint-plugin-jsdoc');
const importPlugin = require('eslint-plugin-import-x');

// Ignore entries shared by both configs, in the original order.
const COMMON_IGNORES = [
  'build/',
  'node_modules/',
  '*.js',
  'src/types/nakama*.d.ts',
  'src/config/**',
  'src/modules/config_validation.ts',
  'src/modules/metrics.ts',
  'src/modules/anti_cheat_audit.ts',
  'src/modules/anti_cheat.ts',
  'src/modules/analytics.ts',
  'src/modules/datadog_integration.ts',
  'src/modules/error_insight_pipeline.ts',
  'src/modules/health_monitor.ts',
  'src/modules/player_rpc.ts',
  'src/modules/profiling.ts',
  'src/modules/progressive_rollout.ts',
  'src/config/index.ts',
  'src/config/logger.ts',
  'src/modules/combat_system.ts',
  'src/modules/season_system.ts',
  'src/modules/store.ts',
];

// Base configuration block for all TypeScript files; each config spreads
// this and adds its own `rules`.
const BASE_TS_BLOCK = {
  files: ['**/*.ts'],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      project: './tsconfig.json',
      tsconfigRootDir: __dirname,
    },
  },
  plugins: {
    '@typescript-eslint': tsPlugin,
    prettier: prettierPlugin,
    jsdoc: jsdocPlugin,
    import: importPlugin,
  },
};

// Config blocks identical in both files: module-boundary jsdoc rules and
// the player_rpc cycle-detection opt-out.
const MODULE_BOUNDARY_BLOCKS = [
  // Special rules for module boundary files
  {
    files: [
      'src/modules/rpg_system.ts',
      'src/modules/combat_system.ts',
      'src/modules/matchmaker.ts',
      'src/modules/season_system.ts',
      'src/modules/store.ts',
      'src/modules/gear_system.ts',
      'src/modules/player_rpc.ts',
      'src/modules/audit.ts',
    ],
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
        },
      ],
    },
  },

  // Disable cycle detection for player_rpc.ts (known circular dependency)
  {
    files: ['src/modules/player_rpc.ts'],
    rules: {
      'import/no-cycle': 'off',
    },
  },
];

module.exports = { COMMON_IGNORES, BASE_TS_BLOCK, MODULE_BOUNDARY_BLOCKS };
