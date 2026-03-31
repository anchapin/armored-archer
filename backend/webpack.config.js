/**
 * Webpack configuration for building Nakama runtime modules
 * Transpiles to ES5 for Nakama's Duktape/QuickJS runtime compatibility
 */
const path = require('path');

module.exports = {
  mode: 'production',
  entry: './build/index.js',
  output: {
    path: path.resolve(__dirname, 'data/modules'),
    filename: 'index.js',
    // commonjs2 creates module.exports = exports["default"] which Nakama can use
    libraryTarget: 'commonjs2',
  },
  // Bundle everything into a single file
  optimization: {
    minimize: false,
    splitChunks: false,
  },
  // Add Node.js target for webpack 5
  target: 'node',
  // Add fallbacks for node.js core modules that some dependencies try to use
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
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
          },
        },
      },
    ],
  },
};
