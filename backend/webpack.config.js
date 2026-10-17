/**
 * Webpack configuration for building Nakama runtime modules
 * Transpiles to ES5 for Nakama's Duktape/QuickJS runtime compatibility
 */
const webpackShared = require('./webpack.shared');

module.exports = {
  mode: webpackShared.BASE_MODE,
  entry: webpackShared.BASE_ENTRY,
  output: webpackShared.BASE_OUTPUT,
  optimization: webpackShared.BASE_OPTIMIZATION,
  // Add Node.js target for webpack 5
  target: webpackShared.BASE_TARGET,
  resolve: webpackShared.NAKAMA_RESOLVE,
  externals: webpackShared.NAKAMA_EXTERNALS,
  module: {
    rules: [webpackShared.BASE_BABEL_RULE],
  },
};
