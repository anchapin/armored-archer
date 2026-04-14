// ESLint Flat Configuration (ESLint v9+)
// Migration from .eslintrc.js - Issue #614

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const jsdocPlugin = require('eslint-plugin-jsdoc');
const importPlugin = require('eslint-plugin-import-x');

module.exports = [
  // Global ignores
  {
    ignores: [
      'build/',
      'node_modules/',
      '*.js',
      'src/types/nakama*.d.ts',
      'src/config/**',
      '**/__tests__/**',
      'src/utils/__tests__/**',
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
      '**/__mocks__/**',
    ],
  },

  // Base configuration for all TypeScript files
  {
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
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      'no-console': 'off',
      'import/no-named-as-default-member': 'off',
      eqeqeq: ['error', 'always'],
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-return-type': 'off',
      'complexity': ['error', { max: 15 }],
      'import/no-unresolved': 'off', // TypeScript compiler handles this
      'import/no-cycle': 'off', // Disabled due to resolver incompatibility with eslint-plugin-import-x
      'import/order': ['error', { alphabetize: { order: 'asc', caseInsensitive: true } }],
      'import/no-duplicates': 'error',
      'import/extensions': 'off', // TypeScript compiler handles extensions
    },
  },

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
