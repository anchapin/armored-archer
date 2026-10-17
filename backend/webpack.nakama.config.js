/**
 * Webpack configuration for building Nakama runtime modules
 * Optimized for ES5 compatibility with Nakama's Duktape/QuickJS runtime
 */
const path = require('path');
const webpackShared = require('./webpack.shared');

module.exports = {
  mode: webpackShared.BASE_MODE,
  entry: webpackShared.BASE_ENTRY,
  output: {
    ...webpackShared.BASE_OUTPUT,
    // Disable chunking and code splitting
    chunkLoading: false,
    chunkLoadingGlobal: undefined,
  },
  // Don't minimize to avoid introducing ES6 syntax
  optimization: {
    ...webpackShared.BASE_OPTIMIZATION,
    runtimeChunk: false,
    moduleIds: 'natural',
    chunkIds: 'natural',
  },
  // Target node for Nakama
  target: webpackShared.BASE_TARGET,
  resolve: webpackShared.NAKAMA_RESOLVE,
  externals: webpackShared.NAKAMA_EXTERNALS,
  module: {
    rules: [
      // Use babel-loader to transpile to ES5 during bundling
      {
        ...webpackShared.BASE_BABEL_RULE,
        use: {
          ...webpackShared.BASE_BABEL_RULE.use,
          options: {
            ...webpackShared.BASE_BABEL_RULE.use.options,
            configFile: path.resolve(__dirname, 'babel.config.js'),
          },
        },
      },
      // Also transpile node_modules dependencies
      {
        test: /\.js$/,
        include: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            configFile: path.resolve(__dirname, 'babel.config.js'),
            // Only transpile specific packages that use ES6+
            presets: [
              ['@babel/preset-env', {
                targets: { esmodules: false },
                modules: 'commonjs',
              }],
            ],
            // Loose-mode assumptions shared with babel.config.js (imported
            // from it directly; loose-mode output keeps the bundle small —
            // see issue #996 notes).
            assumptions: require('./babel.config.js').assumptions,
          },
        },
      },
    ],
  },
  // Disable webpack 5 features that introduce ES6
  experiments: {
    topLevelAwait: false,
  },
};
