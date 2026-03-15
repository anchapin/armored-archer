#!/usr/bin/env node
/**
 * Transpiles the webpack bundle to ES5 for Nakama compatibility
 * Run after: npm run build && npx webpack --mode=production
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
  // Use babel to transpile the bundle
  execSync(
    `npx @babel/cli ${BUNDLE_PATH} --out-file ${TEMP_PATH} --presets=@babel/preset-env --plugins=@babel/plugin-transform-runtime`,
    { stdio: 'inherit', cwd: __dirname }
  );

  // Replace the original with the transpiled version
  fs.renameSync(TEMP_PATH, BUNDLE_PATH);

  const newSize = fs.statSync(BUNDLE_PATH).size;
  console.log(`\nTranspiled bundle size: ${(newSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Size change: ${((newSize - originalSize) / 1024 / 1024).toFixed(2)} MB`);
  console.log('\n✅ Bundle transpiled to ES5 successfully!\n');
} catch (error) {
  console.error('❌ Transpilation failed:', error.message);
  process.exit(1);
}
