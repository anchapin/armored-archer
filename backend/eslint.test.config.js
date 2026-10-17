// ESLint Flat Configuration (ESLint v9+)
// Migration from .eslintrc.js - Issue #614

const importResolverTypescript = require('eslint-import-resolver-typescript');
const eslintShared = require('./eslint.shared');

module.exports = [
  // Global ignores
  {
    ignores: [
      ...eslintShared.COMMON_IGNORES.slice(0, 5),
      'src/modules/__tests__/**',
      ...eslintShared.COMMON_IGNORES.slice(5),
    ],
  },

  // Base configuration for all TypeScript files
  {
    ...eslintShared.BASE_TS_BLOCK,
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: {
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        },
      },
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
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'off',
      'no-console': 'off',
      'import/no-named-as-default-member': 'off',
      eqeqeq: ['error', 'always'],
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-return-type': 'off',
      'complexity': ['error', { max: 15 }],
      'import/no-unresolved': 'off', // TypeScript compiler handles this
      'import/order': ['error', { alphabetize: { order: 'asc', caseInsensitive: true } }],
      'import/no-duplicates': 'error',
      'import/extensions': 'off', // TypeScript compiler handles extensions
      'import/no-cycle': ['error', { maxDepth: Infinity }],
    },
  },

  ...eslintShared.MODULE_BOUNDARY_BLOCKS,
];
