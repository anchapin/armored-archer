/**
 * Webpack configuration for building Nakama runtime modules
 * Optimized for ES5 compatibility with Nakama's Duktape/QuickJS runtime
 */
const path = require('path');
const webpack = require('webpack');

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
    // Third-party packages not installed in node_modules / not bundled.
    // These are wrapped in try/catch in the source so Nakama runs without them.
    'firebase-admin': 'commonjs firebase-admin',
    '@opentelemetry/winston-transport': 'commonjs @opentelemetry/winston-transport',
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
              }],
            ],
            // Babel 8 removed the preset-level `loose` option — mirror the
            // granular `assumptions` block from babel.config.js instead
            // (loose-mode output keeps the bundle small; see issue #996 notes).
            assumptions: {
              noDocumentAll: true,
              setPublicClassFields: true,
              privateFieldsAsProperties: true,
              objectRestNoSymbols: true,
              constantReexports: true,
              enumerableModuleMeta: true,
              ignoreFunctionLength: true,
              ignoreToPrimitiveHint: true,
              mutableTemplateObject: true,
              noClassCalls: true,
              noNewArrows: true,
              skipForOfIteratorClosing: true,
              superIsCallableConstructor: true,
            },
          },
        },
      },
    ],
  },
  // Disable webpack 5 features that introduce ES6
  experiments: {
    topLevelAwait: false,
  },
  plugins: [
    // Note: Nakama Goja runtime doesn't provide __dirname natively.
    // We don't use DefinePlugin for __dirname anymore - instead, the code in
    // gear_system.ts uses process.cwd() directly for runtime path resolution.
    // This avoids webpack replacement issues.
  ],
};
