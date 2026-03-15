/**
 * Webpack configuration for transpiling the Nakama bundle to ES5
 * This runs as a second pass after the main webpack build
 */
const path = require('path');

module.exports = {
  mode: 'production',
  entry: './data/modules/index.js',
  output: {
    path: path.resolve(__dirname, 'data/modules'),
    filename: 'index.es5.js',
    libraryTarget: 'commonjs2',
  },
  target: 'node',
  optimization: {
    minimize: false,
    splitChunks: false,
  },
  resolve: {
    extensions: ['.js', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        // Don't exclude anything - transpile everything for ES5
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: false,
            presets: [
              ['@babel/preset-env', {
                targets: { esmodules: false },
                modules: 'commonjs',
                loose: true,
                forceAllTransforms: true,
              }],
            ],
            plugins: ['@babel/plugin-transform-runtime'],
          },
        },
      },
    ],
  },
};
