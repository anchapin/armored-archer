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
    // Cyclomatic complexity - recommended threshold is 10-20
    // See: https://eslint.org/docs/latest/rules/complexity
    'complexity': ['warn', { max: 15 }],
    // Module boundary enforcement
    'import/no-unresolved': 'error',
    'import/order': ['error', { 'alphabetize': { 'order': 'asc', 'caseInsensitive': true } }],
    'import/no-duplicates': 'error',
    'import/extensions': ['error', 'ignorePackages', { 'ts': 'never' }],
  },
  overrides: [
    {
      files: ['src/modules/(rpg_system|combat_system|matchmaker|season_system|store|gear_system|player_rpc|audit).ts'],
      rules: {
        'jsdoc/require-jsdoc': ['error', { require: { FunctionDeclaration: true, MethodDefinition: true, ClassDeclaration: true } }]
      }
    }
  ],
  ignorePatterns: ['build/', 'node_modules/', '*.js', 'src/types/nakama*.d.ts', 'src/config/**', 'src/modules/__tests__/**', 'src/modules/config_validation.ts', 'src/modules/metrics.ts', 'src/modules/validation.ts'],
};
