/**
 * Babel configuration for Nakama runtime compatibility
 * Transpiles ES6+ JavaScript to ES5 for Nakama's Duktape/QuickJS runtime
 */
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          // Target ES5.1 for Nakama compatibility
          esmodules: false,
        },
        modules: 'commonjs',
        loose: true,
        forceAllTransforms: true,
      },
    ],
  ],
  plugins: [
    // Transform runtime helpers for async/await support
    '@babel/plugin-transform-runtime',
  ],
  // Only transpile source files, not node_modules
  exclude: [/node_modules/],
};
