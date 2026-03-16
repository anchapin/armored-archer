/**
 * Webpack configuration for building Nakama runtime modules
 * Optimized for ES5 compatibility with Nakama's Duktape/QuickJS runtime
 */
const path = require('path');

module.exports = {
  mode: 'production',
  entry: './build/index.js',
  output: {
    path: path.resolve(__dirname, 'data/modules'),
    filename: 'index.js',
    libraryTarget: 'commonjs2',
    // Disable chunking and code splitting
    chunkLoading: false,
    chunkLoadingGlobal: undefined,
  },
  // Don't minimize to avoid introducing ES6 syntax
  optimization: {
    minimize: false,
    splitChunks: false,
    runtimeChunk: false,
    moduleIds: 'natural',
    chunkIds: 'natural',
  },
  // Target node for Nakama
  target: 'node',
  // Add fallbacks for node.js core modules
  resolve: {
    extensions: ['.js', '.json'],
    fallback: {
      'fs': false,
      'path': false,
      'crypto': false,
      'os': false,
      'util': false,
      'stream': false,
      'buffer': false,
      'http': false,
      'https': false,
      'zlib': false,
      'url': false,
      'net': false,
      'tls': false,
    },
  },
  externals: {
    // Exclude Node.js built-ins - Nakama provides them
    'console': 'commonjs console',
    'process': 'commonjs process',
    'util': 'commonjs util',
    'path': 'commonjs path',
    'url': 'commonjs url',
    'stream': 'commonjs stream',
    'events': 'commonjs events',
    'buffer': 'commonjs buffer',
    'http': 'commonjs http',
    'https': 'commonjs https',
    'zlib': 'commonjs zlib',
    'fs': 'commonjs fs',
    'os': 'commonjs os',
    'crypto': 'commonjs crypto',
    'net': 'commonjs net',
    'tls': 'commonjs tls',
    'child_process': 'commonjs child_process',
  },
  // Use babel-loader to transpile to ES5 during bundling
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
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
                loose: true,
              }],
            ],
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
