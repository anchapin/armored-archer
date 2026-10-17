/**
 * Shared webpack pieces for the Nakama bundle configs
 * (webpack.config.js and webpack.nakama.config.js).
 * Extracted to remove duplicated blocks (jscpd clone cleanup, issue #1640).
 * Both consuming configs must produce the exact same computed config as before.
 */

// Add fallbacks for node.js core modules that some dependencies try to use
const NAKAMA_RESOLVE = {
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
};

// Exclude Node.js built-ins - Nakama provides them
const NAKAMA_EXTERNALS = {
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
};


const path = require('path');

// Fields identical in both configs.
const BASE_MODE = 'production';
const BASE_ENTRY = './build/index.js';
const BASE_TARGET = 'node';

const BASE_OUTPUT = {
  path: path.resolve(__dirname, 'data/modules'),
  filename: 'index.js',
  // commonjs2 creates module.exports = exports["default"] which Nakama can use
  libraryTarget: 'commonjs2',
};

// Bundle everything into a single file
const BASE_OPTIMIZATION = {
  minimize: false,
  splitChunks: false,
};

// babel-loader rule for project sources; the nakama config spreads this and
// pins `configFile` explicitly.
const BASE_BABEL_RULE = {
  test: /\.js$/,
  exclude: /node_modules/,
  use: {
    loader: 'babel-loader',
    options: {
      cacheDirectory: true,
    },
  },
};

module.exports = {
  NAKAMA_RESOLVE,
  NAKAMA_EXTERNALS,
  BASE_MODE,
  BASE_ENTRY,
  BASE_TARGET,
  BASE_OUTPUT,
  BASE_OPTIMIZATION,
  BASE_BABEL_RULE,
};
