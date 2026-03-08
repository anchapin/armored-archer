module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
  ],
  plugins: ['@typescript-eslint', 'prettier', 'jsdoc', 'import'],
  settings: {
    'import/resolver': {
      typescript: {},
    },
  },
  env: {
    node: true,
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
    eqeqeq: ['error', 'always'],
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/require-param-type': 'off',
    'jsdoc/require-return-type': 'off',
    // Cyclomatic complexity - recommended threshold is 10-15
    // See: https://eslint.org/docs/latest/rules/complexity
    'complexity': ['warn', { max: 15 }],
    // ============================================================
    // Module Boundary Enforcement (Issue #314)
    // ============================================================
    // Basic import checks
    'import/no-unresolved': 'error',
    'import/order': ['error', { 'alphabetize': { 'order': 'asc', 'caseInsensitive': true } }],
    'import/no-duplicates': 'error',
    'import/extensions': ['error', 'ignorePackages', { 'ts': 'never' }],
    // Circular dependency detection - prevents tight coupling
    // This rule detects and prevents circular imports between modules
    'import/no-cycle': ['error', { maxDepth: Infinity }],
  },
  overrides: [
    {
      files: ['src/modules/(rpg_system|combat_system|matchmaker|season_system|store|gear_system|player_rpc|audit).ts'],
      rules: {
        'jsdoc/require-jsdoc': ['error', { require: { FunctionDeclaration: true, MethodDefinition: true, ClassDeclaration: true } }]
      }
    },
    // Known circular dependency: index.ts -> player_rpc.ts -> index.ts
    // This requires refactoring to resolve properly
    {
      files: ['src/modules/player_rpc.ts'],
      rules: {
        'import/no-cycle': 'off'
      }
    }
  ],
  ignorePatterns: ['build/', 'node_modules/', '*.js', 'src/types/nakama*.d.ts', 'src/config/**', 'src/modules/__tests__/**', 'src/modules/config_validation.ts', 'src/modules/metrics.ts', 'src/modules/validation.ts'],
};
