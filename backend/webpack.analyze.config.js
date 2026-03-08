/**
 * Webpack configuration for bundle analysis
 * Used to analyze bundle size and dependencies for the backend
 */
const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const fs = require('fs');

// Determine if we should run in analyze mode
const shouldAnalyze = process.argv.includes('--analyze') || process.env.ANALYZE === 'true';

module.exports = {
  mode: 'production',
  entry: './build/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    // Exclude Node.js built-ins and common external modules
    'node:console': 'commonjs console',
    'node:process': 'commonjs process',
    'node:util': 'commonjs util',
    'node:path': 'commonjs path',
    'node:url': 'commonjs url',
    'node:stream': 'commonjs stream',
    'node:events': 'commonjs events',
    'node:buffer': 'commonjs buffer',
    'node:http': 'commonjs http',
    'node:https': 'commonjs https',
    'node:zlib': 'commonjs zlib',
    'node:fs': 'commonjs fs',
    'node:os': 'commonjs os',
    'node:crypto': 'commonjs crypto',
    'node:net': 'commonjs net',
    'node:tls': 'commonjs tls',
  },
  resolve: {
    extensions: ['.js', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.node$/,
        use: 'node-loader',
      },
    ],
  },
  plugins: [
    // Only enable analyzer in analyze mode
    ...(shouldAnalyze ? [new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: 'bundle-report.html',
      openAnalyzer: false,
      logLevel: 'info',
    })] : []),
  ],
  performance: {
    hints: 'warning',
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
  stats: {
    colors: true,
    modules: false,
    children: false,
    chunks: false,
    chunkModules: false,
  },
};
