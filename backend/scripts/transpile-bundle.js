#!/usr/bin/env node
/**
 * Transpiles the webpack bundle to ES5 for Nakama compatibility
 * Run after: npm run build && npx webpack --mode=production
 *
 * This script:
 * 1. Transpiles the bundle to ES5 using Babel
 * 2. Wraps the bundle with Nakama-compatible globalThis.exports polyfill
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.resolve(__dirname, '../data/modules/index.js');
const TEMP_PATH = path.resolve(__dirname, '../data/modules/index.tmp.js');

console.log('🔄 Transpiling bundle to ES5 for Nakama compatibility...\n');

if (!fs.existsSync(BUNDLE_PATH)) {
  console.error('❌ Bundle not found. Run: npm run build && npx webpack --mode=production');
  process.exit(1);
}

const originalSize = fs.statSync(BUNDLE_PATH).size;
console.log(`Original bundle size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

try {
  // Use babel to transpile the bundle with config file
  execSync(
    `npx babel ${BUNDLE_PATH} --out-file ${TEMP_PATH} --config-file ${path.resolve(__dirname, '../babel.config.js')}`,
    { stdio: 'inherit', cwd: __dirname }
  );

  // Read the transpiled bundle
  let bundleContent = fs.readFileSync(TEMP_PATH, 'utf8');

  // Add Nakama-compatible wrapper at the beginning
  // This defines exports and __webpack_require__ for Nakama's eval context
  const wrapper = `// Nakama JavaScript runtime compatibility
// Define globalThis for CommonJS compatibility
if (typeof globalThis === 'undefined') {
  var globalThis = this;
}
if (typeof globalThis.exports === 'undefined') {
  globalThis.exports = {};
}
// Define exports directly for Nakama's eval context
var exports = globalThis.exports;

// Webpack's module registry and require function
var __webpack_modules__ = {};
var __webpack_module_cache__ = {};
var __webpack_require__ = function(moduleId) {
  // Check cache first
  if (__webpack_module_cache__[moduleId]) {
    return __webpack_module_cache__[moduleId].exports;
  }
  // Check if module exists
  if (!__webpack_modules__[moduleId]) {
    // For external Node.js modules (fs, path, etc.), return empty object
    // Nakama provides these through its runtime
    return {};
  }
  // Create and cache module
  var module = __webpack_module_cache__[moduleId] = {
    exports: {},
    loaded: false
  };
  // Execute module function
  __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
  // Mark as loaded
  module.loaded = true;
  return module.exports;
};
// Expose module registry for webpack bootstrap
__webpack_require__.m = __webpack_modules__;
__webpack_require__.c = __webpack_module_cache__;

// Alias require to __webpack_require__ for Node.js core module compatibility
var require = __webpack_require__;

// Polyfill for process object (Nakama doesn't provide it)
var process = {
  env: {},
  version: 'v14.0.0',
  versions: { node: '14.0.0' },
  platform: 'nakama',
  arch: 'x64',
  pid: 1,
  cwd: function() { return '/nakama/data'; },
  nextTick: function(fn) { setTimeout(fn, 0); },
  browser: false
};

`;

  // Prepend the wrapper to the bundle
  bundleContent = wrapper + bundleContent;

  // Write the wrapped bundle
  fs.writeFileSync(TEMP_PATH, bundleContent);

  // Replace the original with the wrapped version
  fs.renameSync(TEMP_PATH, BUNDLE_PATH);

  const newSize = fs.statSync(BUNDLE_PATH).size;
  console.log(`\nTranspiled bundle size: ${(newSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Size change: ${((newSize - originalSize) / 1024 / 1024).toFixed(2)} MB`);
  console.log('\n✅ Bundle transpiled to ES5 successfully!\n');
} catch (error) {
  console.error('❌ Transpilation failed:', error.message);
  process.exit(1);
}
