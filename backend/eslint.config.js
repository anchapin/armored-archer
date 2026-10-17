// ESLint Flat Configuration (ESLint v9+)
// Migration from .eslintrc.js - Issue #614

const eslintShared = require('./eslint.shared');

module.exports = [
  // Global ignores
  {
    ignores: [
      ...eslintShared.COMMON_IGNORES.slice(0, 5),
      '**/__tests__/**',
      'src/utils/__tests__/**',
      ...eslintShared.COMMON_IGNORES.slice(5),
      '**/__mocks__/**',
    ],
  },

  // Base configuration for all TypeScript files
  {
    ...eslintShared.BASE_TS_BLOCK,
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
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

  ...eslintShared.MODULE_BOUNDARY_BLOCKS,

  // Module-boundary enforcement (issue #1086).
  //
  // The matchmaker → season_system → season_leaderboard → matchmaker
  // 3-node import cycle was broken by extracting `calculateRank` into
  // ./rank and pointing season_leaderboard at it. `import/no-cycle`
  // is currently disabled due to an eslint-plugin-import-x resolver
  // incompatibility (see line 80), so this `no-restricted-imports`
  // rule is the durable guardrail that prevents the cycle from
  // being re-introduced: season_leaderboard must not reach back into
  // matchmaker. New pure helpers should land in ./rank instead.
  {
    files: ['src/modules/season_leaderboard.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: './matchmaker',
              message:
                "Importing from './matchmaker' closes the matchmaker ↔ season_leaderboard ↔ season_system import cycle (issue #1086). Pure rank helpers belong in './rank'.",
            },
          ],
        },
      ],
    },
  },
];
