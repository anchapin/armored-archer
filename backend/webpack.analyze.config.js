const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  externals: [
    '@heroiclabs/nakama-js',
    '@opentelemetry/auto-instrumentations-node',
    '@opentelemetry/exporter-jaeger',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/exporter-zipkin',
    '@opentelemetry/sdk-node',
    '@sentry/node',
    'js-yaml',
    'lru-cache',
    'prom-client',
    'uuid',
    'winston',
    'zod',
  ],
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: process.argv.includes('--analyze') ? 'static' : 'disabled',
      reportFilename: 'bundle-report.html',
      openAnalyzer: false,
      generateStatsFile: true,
      statsFilename: 'bundle-stats.json',
    }),
  ],
  optimization: {
    minimize: false,
  },
  performance: {
    hints: false,
  },
};
