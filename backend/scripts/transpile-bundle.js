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
  // Use babel to transpile the bundle with config file.
  // Resolve the babel binary directly from node_modules so the call is deterministic
  // and does not depend on npx's PATH discovery (which previously fell back to the
  // legacy `babel@5.8.38` CLI on clean checkouts — see issue #892).
  const babelBin = path.resolve(__dirname, '../node_modules/.bin/babel');
  execSync(
    `"${babelBin}" ${BUNDLE_PATH} --out-file ${TEMP_PATH} --config-file ${path.resolve(__dirname, '../babel.config.js')}`,
    { stdio: 'inherit', cwd: __dirname }
  );

  // Read the transpiled bundle
  let bundleContent = fs.readFileSync(TEMP_PATH, 'utf8');

  // Rewrite any surviving ES2018+ regex lookbehind assertions to
  // Nakama-safe equivalents. babel-preset-env does not transform
  // lookbehind literals (verified: even `targets: { ie: '11' }` leaves
  // them intact) and Nakama's Duktape/QuickJS runtime throws at parse
  // time when it encounters `(?<=` or `(?<!`. See issue #958.
  //
  // Each entry is the lookbehind regex source as it appears in the
  // bundle text (regex literal and/or string form), and a
  // lookbehind-free replacement that preserves the original semantics
  // for our server code paths. The replacements stay inside the ES5.1
  // regex grammar that Nakama can parse.
  //
  // Adding a new transitive dependency: if `grep '(?<' bundle` finds
  // a new lookbehind literal, append its source here.
  const lookbehindReplacements = [
    // Sentry SQL sanitization — Sentry's postgresjs integration.
    // Bundle occurrences:
    //   • /(dollar)-?\b\d+\b/g              (regex literal, module 228)
    //   • "(?<!\\$)-?\\b\\d+\\b"            (string in new RegExp(...))
    // The lookbehind rejects an integer preceded by `$` so the postgres
    // `$1` placeholder is preserved in the sanitized span name. The
    // postgresjs instrumentation is dead code on this server (we use
    // `pg`, never `postgres.js`), so a slight semantic loosening — the
    // replacement also collapses any standalone `$N` to `?` — is
    // acceptable. Source: @sentry/core/build/cjs/integrations/postgresjs.js.
    {
      name: 'Sentry SQL sanitization (@sentry/core .../postgresjs.js)',
      needle: String.raw`/(?<!\$)-?\b\d+\b/g`,
      replacement: String.raw`/-?\b\d+\b/g`,
    },
    {
      name: 'Sentry SQL sanitization string form (new RegExp(...))',
      needle: String.raw`(?<!\\$)-?\\b\\d+\\b`,
      replacement: String.raw`-?\\b\\d+\\b`,
    },
  ];

  let lookbehindRewritesApplied = 0;
  for (const rw of lookbehindReplacements) {
    const occurrences = bundleContent.split(rw.needle).length - 1;
    if (occurrences > 0) {
      bundleContent = bundleContent.split(rw.needle).join(rw.replacement);
      lookbehindRewritesApplied += occurrences;
      console.log(
        `   • rewrote ${occurrences}× ${rw.name} (lookbehind stripped)`
      );
    }
  }

  // Fail loud if any *regex literal* (`/…(?<!…/[flags]`) lookbehind
  // remains — Nakama's parser cannot tokenize it. Lookbehind inside
  // string literals (`"…(?<!…"` / `'…(?<!…'`) and inside
  // `new RegExp(string, flags)` calls is safe: those are only parsed
  // when the string is evaluated, where the surrounding code (Sentry,
  // yaml, …) already wraps the call in a try/catch with a
  // non-lookbehind fallback. See issue #958.
  //
  // Approximation: scan the bundle text and flag any `(?<!` / `(?<=`
  // that is NOT sandwiched between a pair of matching quotes. We do
  // this by walking each character and tracking whether we are inside
  // a single-quoted or double-quoted string. This is O(n) but the
  // bundle is ~12 MB so we still finish in well under a second.
  let remainingRegexLiteralLookbehinds = 0;
  let firstSample = null;
  {
    let inSingle = false;
    let inDouble = false;
    let inLineComment = false;
    let inBlockComment = false;
    for (let i = 0; i < bundleContent.length - 4; i++) {
      const two = bundleContent.slice(i, i + 2);
      if (inLineComment) {
        if (bundleContent[i] === '\n') inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (two === '*/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }
      if (inSingle) {
        if (bundleContent[i] === '\\') {
          i++;
          continue;
        }
        if (bundleContent[i] === "'") inSingle = false;
        continue;
      }
      if (inDouble) {
        if (bundleContent[i] === '\\') {
          i++;
          continue;
        }
        if (bundleContent[i] === '"') inDouble = false;
        continue;
      }
      // Outside any string/comment.
      if (two === '//') {
        inLineComment = true;
        i++;
        continue;
      }
      if (two === '/*') {
        inBlockComment = true;
        i++;
        continue;
      }
      if (bundleContent[i] === "'") {
        inSingle = true;
        continue;
      }
      if (bundleContent[i] === '"') {
        inDouble = true;
        continue;
      }
      if (two === '(?' && i + 2 < bundleContent.length) {
        const next = bundleContent[i + 2];
        if (next === '<' && i + 3 < bundleContent.length) {
          const afterLt = bundleContent[i + 3];
          if (afterLt === '=' || afterLt === '!') {
            remainingRegexLiteralLookbehinds++;
            if (!firstSample) {
              firstSample = bundleContent.slice(Math.max(0, i - 10), i + 30);
            }
          }
        }
      }
    }
  }
  if (remainingRegexLiteralLookbehinds > 0) {
    console.error(
      `\n❌ ${remainingRegexLiteralLookbehinds} unreplaced ES2018 lookbehind assertion(s) remain in non-string positions in the bundle after rewrite pass.\n` +
        `   Sample location: ${JSON.stringify(firstSample)}\n` +
        `   Add a new entry to lookbehindReplacements in scripts/transpile-bundle.js.\n`
    );
    process.exit(1);
  }

  if (lookbehindRewritesApplied > 0) {
    console.log(
      `🔧 Lookbehind rewrite pass: ${lookbehindRewritesApplied} regex-literal replacement(s) applied; remaining lookbehinds all inside string literals (safe).`
    );
  }

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
