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
const DOTENV_PATH = path.resolve(__dirname, '../.env');

console.log('🔄 Transpiling bundle to ES5 for Nakama compatibility...\n');

// ---- Build-time app-env snapshot (issue #1135 prerequisite) ----
// The Nakama JS runtime exposes no environment to module code, and the
// wrapper below defines process.env as a static object. Server source
// reads ~200 vars via process.env (secrets, thresholds, feature flags);
// with an empty env the bundle cannot boot under Nakama (anti_cheat
// throws without HMAC_SECRET since webpack bakes NODE_ENV=production).
// Fix: snapshot backend/.env at BUILD time. The FILE is the allowlist —
// only keys present in it are embedded (never arbitrary shell vars, so
// CI host secrets cannot leak into the artifact); shell/CI env overrides
// per-key so CI can inject secrets without a file. NODE_ENV is excluded
// (webpack already bakes it as "production"; embedding a second value
// would give static and computed reads different answers).
function __parseDotenvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) { return out; }
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) { continue; }
    const eq = trimmed.indexOf('=');
    if (eq < 0) { continue; }
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) { continue; }
    if (val.length >= 2 &&
        ((val.startsWith('"') && val.endsWith('"')) ||
         (val.startsWith("'") && val.endsWith("'")))) {
      val = val.slice(1, -1);
    }
    // Minimal escape handling for secrets/URLs (literal \n, \t, \r only;
    // other backslashes pass through untouched).
    val = val.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');
    out[key] = val;
  }
  return out;
}

const __dotenvVars = __parseDotenvFile(DOTENV_PATH);
const APP_ENV = {};
for (const key of Object.keys(__dotenvVars)) {
  if (key === 'NODE_ENV') { continue; }
  APP_ENV[key] = (process.env[key] !== undefined) ? process.env[key] : __dotenvVars[key];
}
// Escape for interpolation into the wrapper template literal below
// (JSON leaves backticks and ${ untouched, both of which would break it).
const APP_ENV_JSON = JSON.stringify(APP_ENV).split('`').join('\\`').split('${').join('\\${');
console.log(
  `Embedded ${Object.keys(APP_ENV).length} app env var(s) into bundle process.env` +
  ` (.env file: ${Object.keys(__dotenvVars).length} keys` +
  `${fs.existsSync(DOTENV_PATH) ? '' : ' (MISSING — shell env only)'})`
);
if (!APP_ENV.HMAC_SECRET) {
  console.log(
    '⚠ HMAC_SECRET not found in backend/.env or shell env — the bundle will ' +
    'refuse to boot under Nakama (anti_cheat, issue #1076). ' +
    'Add HMAC_SECRET to backend/.env and rebuild.'
  );
}
// Warn-only drift check: src references vs embedded keys (never fails build).
try {
  const grepOut = execSync('grep -rhoE "process\\.env\\.[A-Z_0-9]+" src/ --include="*.ts" || true',
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  const referenced = new Set(
    (grepOut.match(/process\.env\.([A-Z_0-9]+)/g) || []).map((s) => s.slice('process.env.'.length))
  );
  const missing = [...referenced].filter((k) => !(k in APP_ENV) && k !== 'NODE_ENV');
  if (missing.length > 0) {
    console.log(
      `⚠ ${missing.length} process.env var(s) referenced in src but absent from ` +
      `.env/shell (undefined under Nakama): ${missing.slice(0, 10).join(', ')}` +
      `${missing.length > 10 ? '…' : ''}`
    );
  }
} catch (e) { /* best-effort; never fail the build */ }

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

  // Rewrite ES2020 BigInt literals (`0n`, `10n`) to `BigInt("…")` call
  // expressions. Babel (7 and 8) ships NO transform that downlevels BigInt
  // literals — they require BigInt runtime support — so they survive the
  // preset-env pass verbatim, and Nakama 3.21's goja parser rejects them at
  // load time with "Unexpected token ILLEGAL" (verified against ioredis 6's
  // RESP decoder). Same treatment as the lookbehind pass above: rewrite the
  // known needles, then fail loud on any survivor.
  //
  // Current source: ioredis 6.0.0 `built/resp/decoder.js` (BigInt
  // accumulators for RESP3 big-number replies). That path is dead code on
  // this server: ioredis speaks RESP2 unless RESP3 is explicitly negotiated,
  // and our redis usage never issues commands that return bignum replies.
  // `BigInt("0")` / `BigInt("10")` preserve the exact semantics on any
  // BigInt-capable host and throw loudly (ReferenceError) rather than
  // silently mis-evaluate if the path is ever reached on a BigInt-less
  // runtime.
  const bigintLiteralReplacements = [
    {
      name: 'ioredis RESP decoder bind accumulator (×2, decoder.js:207/211)',
      needle: 'bind(this,0n)',
      replacement: 'bind(this,BigInt("0"))',
    },
    {
      name: 'ioredis RESP decoder digit accumulation (decoder.js:230)',
      needle: '*10n+BigInt(',
      replacement: '*BigInt("10")+BigInt(',
    },
  ];

  let bigintRewritesApplied = 0;
  for (const rw of bigintLiteralReplacements) {
    const occurrences = bundleContent.split(rw.needle).length - 1;
    if (occurrences > 0) {
      bundleContent = bundleContent.split(rw.needle).join(rw.replacement);
      bigintRewritesApplied += occurrences;
      console.log(`   • rewrote ${occurrences}× ${rw.name} (BigInt literal → call)`);
    }
  }

  // Fail loud if any BigInt literal survives in code position. The token
  // must not be part of a longer identifier (`i18n`, `base64Str…n`), so the
  // character before the digits and after the trailing `n` must not be an
  // identifier char. Reuses the string/comment walk from the lookbehind
  // scan.
  let remainingBigIntLiterals = 0;
  let firstBigIntSample = null;
  {
    let inSingle = false;
    let inDouble = false;
    let inLineComment = false;
    let inBlockComment = false;
    for (let i = 0; i < bundleContent.length; i++) {
      const ch = bundleContent[i];
      const two = bundleContent.slice(i, i + 2);
      if (inLineComment) {
        if (ch === '\n') inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (two === '*/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }
      if (inSingle || inDouble) {
        if (ch === '\\') {
          i++;
          continue;
        }
        if (inSingle && ch === "'") inSingle = false;
        if (inDouble && ch === '"') inDouble = false;
        continue;
      }
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
      if (ch === "'") {
        inSingle = true;
        continue;
      }
      if (ch === '"') {
        inDouble = true;
        continue;
      }
      if (/[0-9]/.test(ch)) {
        const prev = i > 0 ? bundleContent[i - 1] : '';
        if (/[A-Za-z0-9_$]/.test(prev)) continue; // part of an identifier (e.g. i18n)
        let j = i;
        while (j < bundleContent.length && /[0-9]/.test(bundleContent[j])) j++;
        const after = bundleContent[j] || '';
        if (bundleContent[j - 1] === 'n' && !/[A-Za-z0-9_$]/.test(after)) {
          remainingBigIntLiterals++;
          if (!firstBigIntSample) {
            firstBigIntSample = bundleContent.slice(Math.max(0, i - 20), j + 20);
          }
        }
        i = j;
      }
    }
  }
  if (remainingBigIntLiterals > 0) {
    console.error(
      `\n❌ ${remainingBigIntLiterals} unrewritten BigInt literal(s) remain in code positions in the bundle.\n` +
        `   Sample location: ${JSON.stringify(firstBigIntSample)}\n` +
        `   Add a new entry to bigintLiteralReplacements in scripts/transpile-bundle.js.\n`
    );
    process.exit(1);
  }

  if (bigintRewritesApplied > 0) {
    console.log(
      `🔧 BigInt rewrite pass: ${bigintRewritesApplied} literal replacement(s) applied; no BigInt literals remain in code positions.`
    );
  }

  // Add Nakama-compatible wrapper at the beginning
  // This defines exports and __webpack_require__ for Nakama's eval context
  const wrapper = `// Nakama JavaScript runtime compatibility
// Define globalThis for CommonJS compatibility
if (typeof globalThis === 'undefined') {
  var globalThis = this;
}
// Node-style "global" alias (goja provides globalThis but not global;
// bundled Node libraries reference the bare "global" at module-eval time).
if (typeof global === 'undefined') {
  var global = globalThis;
}
if (typeof globalThis.exports === 'undefined') {
  globalThis.exports = {};
}
// Define exports directly for Nakama's eval context
var exports = globalThis.exports;
var module = { exports: globalThis.exports };

// Webpack's module registry and require function
var __webpack_modules__ = {};
var __webpack_module_cache__ = {};
var __webpack_require__ = function(moduleId) {
  // Webpack preserves the "node:" builtin prefix (require("node:perf_hooks"))
  // — strip it so prefixed and bare requires resolve to the same shim.
  if (typeof moduleId === 'string' && moduleId.slice(0, 5) === 'node:') {
    moduleId = moduleId.slice(5);
  }
  // Check cache first
  if (__webpack_module_cache__[moduleId]) {
    return __webpack_module_cache__[moduleId].exports;
  }
  // Built-in module shims (see __builtin_shims__ below) — webpack's
  // externals config turns Node built-ins into require("util")-style
  // factories, and Nakama's goja runtime provides none of them.
  if (__builtin_shims__[moduleId]) {
    return __builtin_shims__[moduleId];
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

// Polyfill for process object (Nakama doesn't provide it).
// env is a BUILD-TIME snapshot of backend/.env (shell-overridable per
// key; see __parseDotenvFile above) — the only way module code can see
// deployment config under Nakama. Rebuild after changing backend/.env.
var process = {
  env: ${APP_ENV_JSON},
  version: 'v14.0.0',
  versions: { node: '14.0.0' },
  platform: 'nakama',
  arch: 'x64',
  pid: 1,
  argv: [],
  execArgv: [],
  title: 'nakama',
  release: { name: 'nakama' },
  stdout: { isTTY: false, write: function() { return true; } },
  stderr: { isTTY: false, write: function() { return true; } },
  stdin: { isTTY: false },
  cwd: function() { return '/nakama/data'; },
  nextTick: function(fn) {
    __drainSync(fn, Array.prototype.slice.call(arguments, 1));
  },
  hrtime: function(time) {
    var now = Date.now();
    var s = Math.floor(now / 1000);
    var ns = (now % 1000) * 1000000;
    if (time) {
      s -= time[0];
      ns -= time[1];
      if (ns < 0) { s -= 1; ns += 1000000000; }
    }
    return [s, ns];
  },
  uptime: function() { return Math.floor(Date.now() / 1000); },
  memoryUsage: function() { return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 }; },
  exit: function() {},
  // Event subscription surface (uncaughtException/unhandledRejection
  // handlers register here; Nakama never emits to them).
  _events: {},
  on: function(event, listener) {
    (this._events[event] || (this._events[event] = [])).push(listener);
    return this;
  },
  off: function(event, listener) {
    var list = this._events[event];
    if (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] === listener) { list.splice(i, 1); break; }
      }
    }
    return this;
  },
  removeListener: function(event, listener) { return this.off(event, listener); },
  listeners: function(event) { return (this._events[event] || []).slice(); },
  emitWarning: function() {},
  cpuUsage: function() { return { user: 0, system: 0 }; },
  getActiveResourcesInfo: function() { return []; },
  _getActiveRequests: function() { return []; },
  _getActiveHandles: function() { return []; },
  send: function() { return false; },
  getuid: function() { return 0; },
  getgid: function() { return 0; },
  getBuiltinModule: function() { return undefined; },
  execFile: function() {},
  browser: false
};

// Timer globals. Nakama's goja runtime provides no event loop, so true
// async timers are impossible here:
// - process.nextTick / setImmediate / queueMicrotask execute SYNCHRONOUSLY
//   (guarded against runaway re-entrancy). At module-eval time this matches
//   the observable behavior the bundled libraries need (readable-stream
//   resume, winston transport setup); elsewhere it runs deferred work early.
// - setTimeout / setInterval NEVER FIRE (they return inert handles with
//   ref/unref so "setInterval(...).unref()" patterns don't crash). Periodic
//   maintenance in server source (receipt/rate-limit/anti-cheat cleanup,
//   health checks, notification scheduler) therefore does not run under the
//   Nakama bundle — a pre-existing architectural limitation (these timers
//   never fired under Nakama; previously the bundle did not boot at all).
//   Production use of the bundle needs lazy/on-access cleanup instead.
var __nextTickDepth = 0;
function __drainSync(fn, args) {
  if (__nextTickDepth > 100) {
    throw new Error('process.nextTick re-entrancy limit exceeded (no event loop under Nakama)');
  }
  __nextTickDepth++;
  try { fn.apply(undefined, args); }
  finally { __nextTickDepth--; }
}
var __timerSeq = 1;
function __fakeTimerHandle() {
  var h = { __nakamaFakeTimer: true, __id: (__timerSeq++) };
  h.ref = function() { return h; };
  h.unref = function() { return h; };
  h.refresh = function() { return h; };
  return h;
}
function setTimeout() { return __fakeTimerHandle(); }
function clearTimeout() {}
function setInterval() { return __fakeTimerHandle(); }
function clearInterval() {}
function setImmediate(fn) {
  __drainSync(fn, Array.prototype.slice.call(arguments, 1));
  return __fakeTimerHandle();
}
function clearImmediate() {}
function queueMicrotask(fn) {
  __drainSync(fn, []);
}

// Polyfill for the W3C "performance" global (Nakama's goja runtime does
// not provide it). Required at module-eval time, not just call time:
// @opentelemetry/api captures "exports.otperformance = performance"
// unconditionally at import, which crashed module load with
// "ReferenceError: performance is not defined". now() backs otel span
// timing — Date.now() is millisecond-resolution and non-monotonic, which
// is acceptable for telemetry timestamps on this server.
// eventLoopUtilization returns a zeroed sample so config-gated otel
// diagnostics collect zeros instead of throwing.
var performance = {
  timeOrigin: Date.now(),
  now: function() { return Date.now(); },
  mark: function() {},
  measure: function() {},
  getEntries: function() { return []; },
  getEntriesByName: function() { return []; },
  getEntriesByType: function() { return []; },
  eventLoopUtilization: function() {
    return { utilization: 0, idle: 0, active: 0 };
  },
};

// Expose the performance polyfill on globalThis so bundled libraries that
// access "globalThis.performance" (e.g. @opentelemetry/api's otperformance
// module) resolve it rather than getting undefined.
globalThis.performance = performance;

// Polyfill for the "console" global. Nakama's goja runtime does not expose
// a bare "console" to module code, but bundled libraries capture it at
// module-eval time (e.g. Sentry: "var logger=console.error.bind(console)"
// crashed module load with "ReferenceError: console is not defined").
// No-op methods match the previously-shipped bundle's observable behavior
// (no application output on container stdout; Nakama's own structured
// logs are unaffected).
var console = {
  log: function() {},
  info: function() {},
  warn: function() {},
  error: function() {},
  debug: function() {},
  trace: function() {},
  dir: function() {},
  table: function() {},
  time: function() {},
  timeEnd: function() {},
  assert: function() {},
  count: function() {},
  group: function() {},
  groupEnd: function() {},
};

// Expose the console polyfill on globalThis so bundled libraries that
// access "globalThis.console" resolve it rather than getting undefined.
globalThis.console = console;

// Minimal Node "Buffer" global shim. Nakama's goja runtime provides no
// Buffer, but bundled libraries touch it at module-eval time:
// @opentelemetry/core's RandomIdGenerator executes
// "var SHARED_BUFFER = Buffer.allocUnsafe(16)" at import, which crashed
// server boot with "ReferenceError: Buffer is not defined". (Found while
// enabling the issue-#1135 latency measurement — the local stack could not
// boot, so rpcStageComplete could not be exercised at all.)
//
// Array-backed (no Uint8Array: keeps the shim ES5-safe for Nakama's
// parser) implementing the subset the bundle touches: alloc/allocUnsafe/
// from/concat/byteLength/isBuffer/isEncoding plus instance read/write/
// toString/slice/copy/fill/indexOf/equals. Deliberately loud (throws) on
// exotic inputs rather than silently misbehaving.
var Buffer = (function() {
  var HEX_DIGITS = '0123456789abcdef';
  var B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function __normEncoding(enc) {
    if (enc === undefined || enc === null || enc === '') { return 'utf8'; }
    var e = String(enc).toLowerCase();
    if (e === 'utf8' || e === 'utf-8') { return 'utf8'; }
    if (e === 'ascii' || e === 'latin1' || e === 'binary') { return 'ascii'; }
    if (e === 'base64' || e === 'base64url') { return 'base64'; }
    if (e === 'hex') { return 'hex'; }
    if (e === 'ucs2' || e === 'ucs-2' || e === 'utf16le' || e === 'utf-16le') { return 'ucs2'; }
    throw new Error('Unknown encoding: ' + enc);
  }

  function __utf8Encode(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var lo = str.charCodeAt(i + 1);
        if (lo >= 0xdc00 && lo <= 0xdfff) {
          var cp = ((c - 0xd800) << 10) + (lo - 0xdc00) + 0x10000;
          bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63),
            0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
          i++;
          continue;
        }
      }
      if (c < 0x80) { bytes.push(c); }
      else if (c < 0x800) { bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
      else { bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return bytes;
  }

  function __utf8Decode(buf, start, end) {
    var parts = [];
    var i = start;
    while (i < end) {
      var b0 = buf[i];
      if (b0 === undefined) { break; }
      if (b0 < 0x80) { parts.push(String.fromCharCode(b0)); i++; }
      else if ((b0 & 0xe0) === 0xc0 && i + 1 < end) {
        parts.push(String.fromCharCode(((b0 & 31) << 6) | (buf[i + 1] & 63))); i += 2;
      } else if ((b0 & 0xf0) === 0xe0 && i + 2 < end) {
        parts.push(String.fromCharCode(((b0 & 15) << 12) | ((buf[i + 1] & 63) << 6) | (buf[i + 2] & 63))); i += 3;
      } else if ((b0 & 0xf8) === 0xf0 && i + 3 < end) {
        var cp = ((b0 & 7) << 18) | ((buf[i + 1] & 63) << 12) | ((buf[i + 2] & 63) << 6) | (buf[i + 3] & 63);
        cp -= 0x10000;
        parts.push(String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023))); i += 4;
      } else { parts.push('�'); i++; }
    }
    return parts.join('');
  }

  function __hexEncode(buf, start, end) {
    var s = '';
    for (var i = start; i < end; i++) {
      var b = buf[i] & 255;
      s += HEX_DIGITS[(b >> 4) & 15] + HEX_DIGITS[b & 15];
    }
    return s;
  }

  function __hexDecode(str) {
    var s = String(str).replace(/\s+/g, '');
    var bytes = [];
    for (var i = 0; i + 1 < s.length; i += 2) {
      bytes.push(parseInt(s.substr(i, 2), 16) & 255);
    }
    return bytes;
  }

  function __asciiEncode(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) { bytes.push(str.charCodeAt(i) & 127); }
    return bytes;
  }

  function __asciiDecode(buf, start, end) {
    var s = '';
    for (var i = start; i < end; i++) { s += String.fromCharCode(buf[i] & 127); }
    return s;
  }

  function __ucs2Encode(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      bytes.push(c & 255, (c >> 8) & 255);
    }
    return bytes;
  }

  function __ucs2Decode(buf, start, end) {
    var s = '';
    for (var i = start; i + 1 < end; i += 2) {
      s += String.fromCharCode((buf[i] & 255) | ((buf[i + 1] & 255) << 8));
    }
    return s;
  }

  var __b64Rev = null;
  function __b64RevTable() {
    if (!__b64Rev) {
      __b64Rev = {};
      for (var i = 0; i < B64_CHARS.length; i++) { __b64Rev[B64_CHARS.charAt(i)] = i; }
    }
    return __b64Rev;
  }

  function __base64Encode(buf, start, end) {
    var s = '';
    var i = start;
    while (i < end) {
      var b0 = buf[i] & 255;
      var b1 = (i + 1 < end) ? buf[i + 1] & 255 : 0;
      var b2 = (i + 2 < end) ? buf[i + 2] & 255 : 0;
      s += B64_CHARS[b0 >> 2] + B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
      s += (i + 1 < end) ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '=';
      s += (i + 2 < end) ? B64_CHARS[b2 & 63] : '=';
      i += 3;
    }
    return s;
  }

  function __base64Decode(str) {
    var s = String(str).replace(/[^A-Za-z0-9+/=_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
    var rev = __b64RevTable();
    var bytes = [];
    for (var i = 0; i + 4 <= s.length; i += 4) {
      var p2 = s.charAt(i + 2);
      var p3 = s.charAt(i + 3);
      var c0 = rev[s.charAt(i)];
      var c1 = rev[s.charAt(i + 1)];
      var c2 = (p2 === '=') ? 0 : rev[p2];
      var c3 = (p3 === '=') ? 0 : rev[p3];
      if (c0 === undefined || c1 === undefined || c2 === undefined || c3 === undefined) { break; }
      bytes.push((c0 << 2) | (c1 >> 4));
      if (p2 !== '=') { bytes.push(((c1 & 15) << 4) | (c2 >> 2)); }
      if (p3 !== '=') { bytes.push(((c2 & 3) << 6) | c3); }
    }
    return bytes;
  }

  function __encodeString(str, enc) {
    if (enc === 'hex') { return __hexDecode(str); }
    if (enc === 'base64') { return __base64Decode(str); }
    if (enc === 'ascii') { return __asciiEncode(str); }
    if (enc === 'ucs2') { return __ucs2Encode(str); }
    return __utf8Encode(str);
  }

  function __clampRange(len, start, end) {
    var s = (start === undefined) ? 0 : start;
    var e = (end === undefined) ? len : end;
    if (s < 0) { s = Math.max(len + s, 0); } else { s = Math.min(s, len); }
    if (e < 0) { e = Math.max(len + e, 0); } else { e = Math.min(e, len); }
    return [s, Math.max(e, s)];
  }

  function BufferShim(arg, encodingOrOffset, length) {
    if (!(this instanceof BufferShim)) { return new BufferShim(arg, encodingOrOffset, length); }
    var bytes;
    var k;
    if (typeof arg === 'number') {
      var n = arg < 0 ? 0 : arg;
      bytes = new Array(n);
      for (k = 0; k < n; k++) { bytes[k] = 0; }
    } else if (typeof arg === 'string') {
      bytes = __encodeString(arg, __normEncoding(encodingOrOffset));
    } else if (arg instanceof BufferShim) {
      bytes = [];
      for (k = 0; k < arg.length; k++) { bytes.push(arg[k] & 255); }
    } else if (arg && typeof arg === 'object' && typeof arg.length !== 'number' &&
        typeof arg.byteLength === 'number') {
      // ArrayBuffer (+ optional byteOffset/length) — view it if typed
      // arrays exist, else fail loudly.
      var boff = (typeof encodingOrOffset === 'number') ? encodingOrOffset : 0;
      var blen = (typeof length === 'number') ? length : (arg.byteLength - boff);
      try {
        var u8 = new Uint8Array(arg, boff, blen);
        bytes = [];
        for (k = 0; k < u8.length; k++) { bytes.push(u8[k] & 255); }
      } catch (e) { throw new TypeError('Cannot view ArrayBuffer without Uint8Array support'); }
    } else if (arg && typeof arg.length === 'number') {
      // number[] / Uint8Array / array-likes (+ optional offset/length).
      var off = (typeof encodingOrOffset === 'number') ? encodingOrOffset : 0;
      var ln = (typeof length === 'number') ? length : (arg.length - off);
      bytes = [];
      for (k = 0; k < ln; k++) { bytes.push(arg[off + k] & 255); }
    } else {
      throw new TypeError('Unsupported Buffer argument');
    }
    this.length = bytes.length;
    for (k = 0; k < bytes.length; k++) { this[k] = bytes[k]; }
  }

  BufferShim.alloc = function(size, fill, encoding) {
    var b = new BufferShim(size < 0 ? 0 : size);
    if (fill !== undefined) { b.fill(fill, 0, b.length, encoding); }
    return b;
  };
  BufferShim.allocUnsafe = function(size) { return new BufferShim(size < 0 ? 0 : size); };
  BufferShim.allocUnsafeSlow = BufferShim.allocUnsafe;
  BufferShim.from = function(value, encOrOffset, len) {
    if (typeof value === 'string') { return new BufferShim(value, encOrOffset); }
    if (typeof value === 'number') { throw new TypeError('Buffer.from(number) is deprecated'); }
    return new BufferShim(value, encOrOffset, len);
  };
  BufferShim.concat = function(list, totalLength) {
    var all = [];
    var i;
    var j;
    for (i = 0; i < list.length; i++) {
      var b = list[i];
      if (!(b instanceof BufferShim)) { throw new TypeError('Buffer.concat list must contain Buffers'); }
      for (j = 0; j < b.length; j++) { all.push(b[j]); }
    }
    if (typeof totalLength === 'number') {
      all = all.slice(0, totalLength);
      while (all.length < totalLength) { all.push(0); }
    }
    return new BufferShim(all);
  };
  BufferShim.byteLength = function(s, enc) {
    if (typeof s === 'string') { return __encodeString(s, __normEncoding(enc)).length; }
    if (s instanceof BufferShim) { return s.length; }
    if (s && typeof s.length === 'number') { return s.length; }
    return 0;
  };
  BufferShim.isBuffer = function(b) { return b instanceof BufferShim; };
  BufferShim.isEncoding = function(enc) {
    try { __normEncoding(enc); return true; } catch (e) { return false; }
  };
  BufferShim.compare = function(a, b) {
    if (!(a instanceof BufferShim) || !(b instanceof BufferShim)) {
      throw new TypeError('Arguments must be Buffers');
    }
    return __bufCompare(a, b);
  };
  BufferShim.Buffer = BufferShim;

  function __bufCompare(a, b) {
    var n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) {
      var x = a[i] & 255;
      var y = b[i] & 255;
      if (x !== y) { return x < y ? -1 : 1; }
    }
    if (a.length === b.length) { return 0; }
    return a.length < b.length ? -1 : 1;
  }

  BufferShim.prototype.write = function(string, offset, length, encoding) {
    var off = 0;
    var len;
    var enc = 'utf8';
    if (typeof offset === 'string') { enc = offset; }
    else {
      off = offset >>> 0;
      if (typeof length === 'string') { enc = length; }
      else {
        if (length !== undefined) { len = length >>> 0; }
        if (typeof encoding === 'string') { enc = encoding; }
      }
    }
    var src = __encodeString(String(string), __normEncoding(enc));
    if (len === undefined) { len = Math.min(src.length, this.length - off); }
    else { len = Math.min(len, src.length, this.length - off); }
    for (var i = 0; i < len; i++) { this[off + i] = src[i]; }
    return len;
  };

  BufferShim.prototype.writeUInt8 = function(v, off) {
    off = off >>> 0; this[off] = v & 255; return off + 1;
  };
  BufferShim.prototype.writeUInt16BE = function(v, off) {
    v = v >>> 0; off = off >>> 0;
    this[off] = (v >>> 8) & 255; this[off + 1] = v & 255; return off + 2;
  };
  BufferShim.prototype.writeUInt16LE = function(v, off) {
    v = v >>> 0; off = off >>> 0;
    this[off] = v & 255; this[off + 1] = (v >>> 8) & 255; return off + 2;
  };
  BufferShim.prototype.writeUInt32BE = function(v, off) {
    v = v >>> 0; off = off >>> 0;
    this[off] = (v >>> 24) & 255; this[off + 1] = (v >>> 16) & 255;
    this[off + 2] = (v >>> 8) & 255; this[off + 3] = v & 255; return off + 4;
  };
  BufferShim.prototype.writeUInt32LE = function(v, off) {
    v = v >>> 0; off = off >>> 0;
    this[off] = v & 255; this[off + 1] = (v >>> 8) & 255;
    this[off + 2] = (v >>> 16) & 255; this[off + 3] = (v >>> 24) & 255; return off + 4;
  };
  BufferShim.prototype.writeInt8 = function(v, off) {
    return this.writeUInt8(v, off);
  };
  BufferShim.prototype.writeInt16BE = function(v, off) {
    return this.writeUInt16BE(v < 0 ? 0x10000 + v : v, off);
  };
  BufferShim.prototype.writeInt16LE = function(v, off) {
    return this.writeUInt16LE(v < 0 ? 0x10000 + v : v, off);
  };
  BufferShim.prototype.writeInt32BE = function(v, off) {
    return this.writeUInt32BE(v, off);
  };
  BufferShim.prototype.writeInt32LE = function(v, off) {
    return this.writeUInt32LE(v, off);
  };

  BufferShim.prototype.readUInt8 = function(off) { return this[off >>> 0] & 255; };
  BufferShim.prototype.readUInt16BE = function(off) {
    off = off >>> 0; return ((this[off] & 255) << 8) | (this[off + 1] & 255);
  };
  BufferShim.prototype.readUInt16LE = function(off) {
    off = off >>> 0; return (this[off] & 255) | ((this[off + 1] & 255) << 8);
  };
  BufferShim.prototype.readUInt32BE = function(off) {
    off = off >>> 0;
    return ((this[off] & 255) * 0x1000000) + (((this[off + 1] & 255) << 16) |
      ((this[off + 2] & 255) << 8) | (this[off + 3] & 255));
  };
  BufferShim.prototype.readUInt32LE = function(off) {
    off = off >>> 0;
    return ((this[off + 3] & 255) * 0x1000000) + (((this[off + 2] & 255) << 16) |
      ((this[off + 1] & 255) << 8) | (this[off] & 255));
  };
  BufferShim.prototype.readInt8 = function(off) {
    var v = this.readUInt8(off); return v >= 128 ? v - 256 : v;
  };
  BufferShim.prototype.readInt16BE = function(off) {
    var v = this.readUInt16BE(off); return v >= 32768 ? v - 65536 : v;
  };
  BufferShim.prototype.readInt16LE = function(off) {
    var v = this.readUInt16LE(off); return v >= 32768 ? v - 65536 : v;
  };
  BufferShim.prototype.readInt32BE = function(off) {
    var v = this.readUInt32BE(off); return v >= 2147483648 ? v - 4294967296 : v;
  };
  BufferShim.prototype.readInt32LE = function(off) {
    var v = this.readUInt32LE(off); return v >= 2147483648 ? v - 4294967296 : v;
  };

  BufferShim.prototype.toString = function(enc, start, end) {
    var e = __normEncoding(enc);
    var r = __clampRange(this.length, start, end);
    if (r[1] <= r[0]) { return ''; }
    if (e === 'hex') { return __hexEncode(this, r[0], r[1]); }
    if (e === 'base64') { return __base64Encode(this, r[0], r[1]); }
    if (e === 'ascii') { return __asciiDecode(this, r[0], r[1]); }
    if (e === 'ucs2') { return __ucs2Decode(this, r[0], r[1]); }
    return __utf8Decode(this, r[0], r[1]);
  };

  BufferShim.prototype.slice = function(start, end) {
    var r = __clampRange(this.length, start, end);
    var out = [];
    for (var i = r[0]; i < r[1]; i++) { out.push(this[i] & 255); }
    return new BufferShim(out);
  };
  BufferShim.prototype.subarray = BufferShim.prototype.slice;

  BufferShim.prototype.copy = function(target, targetStart, sourceStart, sourceEnd) {
    if (!(target instanceof BufferShim)) { throw new TypeError('target must be a Buffer'); }
    var ts = (targetStart === undefined) ? 0 : targetStart >>> 0;
    var ss = (sourceStart === undefined) ? 0 : sourceStart >>> 0;
    var se = (sourceEnd === undefined) ? this.length : sourceEnd >>> 0;
    var n = Math.min(se - ss, target.length - ts);
    if (n <= 0) { return 0; }
    var i;
    if (target === this && ts > ss) {
      for (i = n - 1; i >= 0; i--) { target[ts + i] = this[ss + i]; }
    } else {
      for (i = 0; i < n; i++) { target[ts + i] = this[ss + i]; }
    }
    return n;
  };

  BufferShim.prototype.fill = function(value, offset, end, encoding) {
    var s = (offset === undefined) ? 0 : offset >>> 0;
    var e = (end === undefined) ? this.length : end >>> 0;
    var fillBytes;
    var q;
    if (typeof value === 'string') {
      fillBytes = __encodeString(value, __normEncoding(encoding));
      if (fillBytes.length === 0) { return this; }
    } else if (value instanceof BufferShim) {
      fillBytes = [];
      for (q = 0; q < value.length; q++) { fillBytes.push(value[q]); }
      if (fillBytes.length === 0) { return this; }
    } else {
      fillBytes = [(value === undefined ? 0 : value) & 255];
    }
    for (var i = s; i < e; i++) { this[i] = fillBytes[(i - s) % fillBytes.length]; }
    return this;
  };

  BufferShim.prototype.equals = function(other) {
    return (other instanceof BufferShim) && __bufCompare(this, other) === 0;
  };
  BufferShim.prototype.compare = function(other, tStart, tEnd, sStart, sEnd) {
    var t = (tStart === undefined && tEnd === undefined) ? this : this.slice(tStart, tEnd);
    var s = (sStart === undefined && sEnd === undefined) ? other : other.slice(sStart, sEnd);
    return __bufCompare(t, s);
  };
  BufferShim.prototype.indexOf = function(val, byteOffset, enc) {
    var from = (byteOffset === undefined) ? 0 : byteOffset;
    if (from < 0) { from = Math.max(this.length + from, 0); }
    var needle;
    var q;
    if (typeof val === 'string') { needle = __encodeString(val, __normEncoding(enc)); }
    else if (val instanceof BufferShim) {
      needle = [];
      for (q = 0; q < val.length; q++) { needle.push(val[q]); }
    }
    else if (typeof val === 'number') { needle = [val & 255]; }
    else { throw new TypeError('indexOf value must be string, number or Buffer'); }
    if (needle.length === 0) { return -1; }
    for (var i = from; i + needle.length <= this.length; i++) {
      var found = true;
      for (var j = 0; j < needle.length; j++) {
        if ((this[i + j] & 255) !== needle[j]) { found = false; break; }
      }
      if (found) { return i; }
    }
    return -1;
  };
  BufferShim.prototype.lastIndexOf = function(val, byteOffset, enc) {
    var needle;
    var q;
    if (typeof val === 'string') { needle = __encodeString(val, __normEncoding(enc)); }
    else if (val instanceof BufferShim) {
      needle = [];
      for (q = 0; q < val.length; q++) { needle.push(val[q]); }
    }
    else if (typeof val === 'number') { needle = [val & 255]; }
    else { throw new TypeError('lastIndexOf value must be string, number or Buffer'); }
    if (needle.length === 0) { return -1; }
    var from = (byteOffset === undefined) ? this.length - needle.length : byteOffset;
    if (from < 0) { from = Math.max(this.length - needle.length + from, 0); }
    for (var i = Math.min(from, this.length - needle.length); i >= 0; i--) {
      var found = true;
      for (var j = 0; j < needle.length; j++) {
        if ((this[i + j] & 255) !== needle[j]) { found = false; break; }
      }
      if (found) { return i; }
    }
    return -1;
  };
  BufferShim.prototype.includes = function(val, byteOffset, enc) {
    return this.indexOf(val, byteOffset, enc) !== -1;
  };
  BufferShim.prototype.forEach = function(cb, thisArg) {
    for (var i = 0; i < this.length; i++) { cb.call(thisArg, this[i], i, this); }
  };
  BufferShim.prototype.toJSON = function() {
    var data = [];
    for (var i = 0; i < this.length; i++) { data.push(this[i] & 255); }
    return { type: 'Buffer', data: data };
  };

  return BufferShim;
})();

// Minimal BigInt global shim. Nakama's goja runtime has no BigInt, but
// bundled zod executes BigInt("...") at module-eval time for its
// BIGINT_FORMAT_RANGES validation constants, which crashed boot with
// "ReferenceError: BigInt is not defined". Number-backed: exact within
// MAX_SAFE_INTEGER, approximate beyond (adequate for these inert range
// constants — no real bigints can exist on this runtime, and bigint
// arithmetic beyond safe integers is not supported). Full removal comes
// with the zod-to-valibot migration (issue #1109).
function __NakamaBigInt(n) { this.__v = n; }
__NakamaBigInt.prototype.valueOf = function() { return this.__v; };
__NakamaBigInt.prototype.toString = function() { return String(this.__v); };
__NakamaBigInt.prototype.toJSON = function() { return String(this.__v); };
function BigInt(v) {
  if (v instanceof __NakamaBigInt) { return v; }
  if (typeof v === 'boolean') { v = v ? 1 : 0; }
  if (typeof v === 'number' || typeof v === 'string') {
    var n = Number(v);
    if (isNaN(n)) { throw new SyntaxError('Cannot convert to BigInt'); }
    return new __NakamaBigInt(n);
  }
  throw new TypeError('Cannot convert to BigInt');
}

// Minimal WHATWG TextEncoder/TextDecoder globals (UTF-8 only). Nakama's
// goja runtime provides neither, but bundled AWS SDK code instantiates
// them at module-eval time ("var textDecoder = new TextDecoder()"
// crashed boot with "ReferenceError: TextDecoder is not defined").
// Backed by the Buffer shim above, so encode/decode semantics match it.
// Limitations vs Node: only utf-8 labels accepted; decode() is stateless
// (stream:true chunk splits may emit U+FFFD at boundaries); fatal:true
// does not throw on malformed input. These paths are inert under Nakama
// (no AWS calls are made from the server runtime), so the limitations
// cannot affect request handling.
function TextEncoder() {}
TextEncoder.prototype.encoding = 'utf-8';
TextEncoder.prototype.encode = function(str) {
  return Buffer.from(String(str), 'utf8');
};
TextEncoder.prototype.encodeInto = function(str, dest) {
  var src = Buffer.from(String(str), 'utf8');
  var n = Math.min(src.length, dest.length);
  for (var i = 0; i < n; i++) { dest[i] = src[i]; }
  return { read: String(str).length, written: n };
};

function TextDecoder(label, options) {
  var lab = (label === undefined || label === null) ? 'utf-8' : String(label).toLowerCase();
  if (lab !== 'utf-8' && lab !== 'utf8') {
    throw new RangeError("The '" + label + "' encoding is not supported by the Nakama TextDecoder shim (utf-8 only)");
  }
  var opts = options || {};
  this.encoding = 'utf-8';
  this.fatal = !!opts.fatal;
  this.ignoreBOM = !!opts.ignoreBOM;
}
TextDecoder.prototype.decode = function(input, options) {
  if (input === undefined || input === null) { return ''; }
  var buf = (input instanceof Buffer) ? input : Buffer.from(input);
  var s = buf.toString('utf8');
  if (!this.ignoreBOM && s.length > 0 && s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1);
  }
  return s;
};

// Minimal Node "util" builtin shim. The real require("util") is not
// available under Nakama's goja runtime; libraries capture members at
// module-eval time (e.g. the debug package's
// "exports.destroy = util.deprecate(...)" crashed module load with
// "Object has no member 'deprecate'").
var util = {
  deprecate: function(fn) { return fn; },
  format: function(f) {
    if (typeof f !== 'string') {
      var parts = [];
      for (var i = 0; i < arguments.length; i++) {
        parts.push(String(arguments[i]));
      }
      return parts.join(' ');
    }
    var str = '';
    var argIdx = 1;
    for (var i = 0; i < f.length; i++) {
      if (f[i] === '%' && argIdx < arguments.length) {
        var next = f[i + 1];
        if (next === 's') { str += String(arguments[argIdx++]); i++; continue; }
        if (next === 'd') { str += Number(arguments[argIdx++]); i++; continue; }
        if (next === 'j') {
          try { str += JSON.stringify(arguments[argIdx++]); }
          catch (e) { str += '[Circular]'; }
          i++;
          continue;
        }
        if (next === '%') { str += '%'; i++; continue; }
      }
      str += f[i];
    }
    return str;
  },
  inspect: function(o) {
    try { return JSON.stringify(o); } catch (e) { return String(o); }
  },
  promisify: function(fn) {
    return function() {
      var args = Array.prototype.slice.call(arguments);
      var self = this;
      return new Promise(function(resolve, reject) {
        args.push(function(err, res) {
          if (err) { reject(err); } else { resolve(res); }
        });
        try { fn.apply(self, args); } catch (e) { reject(e); }
      });
    };
  },
  inherits: function(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: { value: ctor, enumerable: false, writable: true, configurable: true }
    });
  },
  isArray: Array.isArray,
  isBoolean: function(v) { return typeof v === 'boolean'; },
  isBuffer: function(v) { return false; },
  isDate: function(v) { return v instanceof Date; },
  isError: function(v) { return v instanceof Error; },
  isFunction: function(v) { return typeof v === 'function'; },
  isNull: function(v) { return v === null; },
  isNullOrUndefined: function(v) { return v === null || v === undefined; },
  isNumber: function(v) { return typeof v === 'number'; },
  isObject: function(v) { return v !== null && typeof v === 'object'; },
  isPrimitive: function(v) { return v === null || (typeof v !== 'object' && typeof v !== 'function'); },
  isRegExp: function(v) { return v instanceof RegExp; },
  isString: function(v) { return typeof v === 'string'; },
  isSymbol: function(v) { return typeof v === 'symbol'; },
  isUndefined: function(v) { return v === undefined; },
  noop: function() {},
  types: {
    isDate: function(v) { return v instanceof Date; },
    isPromise: function(v) { return v !== null && typeof v === 'object' && typeof v.then === 'function'; },
    isRegExp: function(v) { return v instanceof RegExp; }
  },
  TextEncoder: TextEncoder,
  TextDecoder: TextDecoder
};

// Minimal Node "events" builtin shim (EventEmitter). Required at
// module-eval time: ioredis and other classes extend EventEmitter at
// class-definition time, so the constructor must exist before any
// instance is ever created.
function EventEmitter() {
  this._events = {};
}
EventEmitter.prototype.on = function(event, listener) {
  (this._events[event] || (this._events[event] = [])).push(listener);
  return this;
};
EventEmitter.prototype.addListener = EventEmitter.prototype.on;
EventEmitter.prototype.once = function(event, listener) {
  var self = this;
  function g() {
    self.removeListener(event, g);
    listener.apply(this, arguments);
  }
  g.listener = listener;
  this.on(event, g);
  return this;
};
EventEmitter.prototype.removeListener = function(event, listener) {
  var list = this._events[event];
  if (!list) { return this; }
  for (var i = 0; i < list.length; i++) {
    if (list[i] === listener || list[i].listener === listener) {
      list.splice(i, 1);
      break;
    }
  }
  if (list.length === 0) { delete this._events[event]; }
  return this;
};
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.removeAllListeners = function(event) {
  if (event === undefined) { this._events = {}; }
  else { delete this._events[event]; }
  return this;
};
EventEmitter.prototype.emit = function(event) {
  var list = this._events[event];
  if (!list) { return false; }
  var args = Array.prototype.slice.call(arguments, 1);
  list = list.slice();
  for (var i = 0; i < list.length; i++) {
    list[i].apply(this, args);
  }
  return true;
};
EventEmitter.prototype.listenerCount = function(event) {
  return (this._events[event] || []).length;
};
EventEmitter.prototype.eventNames = function() {
  var names = [];
  for (var k in this._events) {
    if (Object.prototype.hasOwnProperty.call(this._events, k)) { names.push(k); }
  }
  return names;
};
EventEmitter.prototype.setMaxListeners = function() { return this; };
EventEmitter.defaultMaxListeners = 10;
// Node parity: require("events") IS the EventEmitter constructor (with
// .EventEmitter attached), not a namespace object — bundled code calls
// util.inherits(X, require("events")) and new (require("events"))().
EventEmitter.EventEmitter = EventEmitter;
var events = EventEmitter;

// Minimal Node "stream" builtin shim. Node parity: require("stream") IS
// the Stream constructor (with .Readable/.Writable/.Duplex/.Transform/
// .PassThrough/.Stream attached), not a namespace object — bundled code
// (readable-stream) calls util.inherits(Readable, require("stream")) at
// module-eval time, which crashed boot with
// "Object prototype may only be an Object or null: undefined" when the
// registry returned a namespace object.
function __NakamaStream() { EventEmitter.call(this); }
util.inherits(__NakamaStream, EventEmitter);
__NakamaStream.prototype.pipe = function() { return this; };
function __makeStreamSubclass() {
  function Sub() { __NakamaStream.call(this); }
  util.inherits(Sub, __NakamaStream);
  return Sub;
}
__NakamaStream.Stream = __NakamaStream;
__NakamaStream.Readable = __makeStreamSubclass();
__NakamaStream.Writable = __makeStreamSubclass();
__NakamaStream.Duplex = __makeStreamSubclass();
__NakamaStream.Transform = __makeStreamSubclass();
__NakamaStream.PassThrough = __makeStreamSubclass();

// Minimal Node "crypto" builtin shim. Server source imports
// createHmac/randomBytes (anti_cheat.ts) and libraries use
// randomUUID/getRandomValues (feature-detected). Randomness is
// Math.random-based (adequate for test/ID traffic, not for production
// secrets). createHmac digests return an empty string so signature
// VERIFICATION paths fail closed (mismatch) instead of silently
// accepting; do not rely on this shim for real HMAC validation.
function __randomByteString(n) {
  var bytes = [];
  var chars = '0123456789abcdef';
  for (var i = 0; i < n; i++) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  bytes.toString = function(encoding) {
    if (encoding === 'hex') {
      var out = '';
      for (var i = 0; i < this.length; i++) {
        out += chars[(this[i] >> 4) & 15] + chars[this[i] & 15];
      }
      return out;
    }
    var arr = [];
    for (var i = 0; i < this.length; i++) { arr.push(this[i]); }
    return arr.join(',');
  };
  return bytes;
}
function __uuidV4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0;
    var v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
var crypto = {
  randomUUID: __uuidV4,
  randomBytes: __randomByteString,
  getRandomValues: function(arr) {
    for (var i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  createHash: function() {
    return {
      update: function() { return this; },
      digest: function() { return ''; }
    };
  },
  createHmac: function() {
    return {
      update: function() { return this; },
      digest: function() { return ''; }
    };
  }
};

// Registry consulted by __webpack_require__ for externals that resolve to
// require("<builtin>") factories. Anything not listed falls back to {}
// (previous behavior). Shimmed members cover what bundled libraries touch
// at module-eval time plus safe runtime defaults; deep functionality
// (fs, net, tls, …) is intentionally inert on the Nakama runtime.
var __builtin_shims__ = {
  'util': util,
  'buffer': Buffer,
  'events': events,
  'crypto': crypto,
  'console': console,
  'process': process,
  'perf_hooks': {
    performance: performance,
    constants: {
      NODE_PERFORMANCE_GC_MAJOR: 4, NODE_PERFORMANCE_GC_MINOR: 1,
      NODE_PERFORMANCE_GC_INCREMENTAL: 8, NODE_PERFORMANCE_GC_WEAKCB: 16,
      NODE_PERFORMANCE_GC_FLAGS_NO: 0, NODE_PERFORMANCE_GC_FLAGS_CONSTRUCT_RETAINED: 2,
      NODE_PERFORMANCE_GC_FLAGS_FORCED: 4, NODE_PERFORMANCE_GC_FLAGS_SYNCHRONOUS_PHANTOM_PROCESSING: 8,
      NODE_PERFORMANCE_GC_FLAGS_ALL_AVAILABLE_GARBAGE: 16,
      NODE_PERFORMANCE_GC_FLAGS_ALL_EXTERNAL_MEMORY: 32,
      NODE_PERFORMANCE_GC_FLAGS_SCHEDULE_IDLE: 64
    },
    PerformanceObserver: function PerformanceObserverShim(cb) {
      this._cb = cb;
      this.observe = function() {};
      this.disconnect = function() {};
      this.takeRecords = function() { return []; };
    },
    monitorEventLoopDelay: function() {
      return { enable: function() {}, disable: function() {},
               on: function() { return this; },
               min: 0, max: 0, mean: 0, stddev: 0, percentiles: {}, exceeds: 0 };
    }
  },
  'tty': { isatty: function() { return false; } },
  'assert': {
    ok: function() {}, equal: function() {}, notEqual: function() {},
    strictEqual: function() {}, notStrictEqual: function() {},
    deepEqual: function() {}, notDeepEqual: function() {},
    deepStrictEqual: function() {}, notDeepStrictEqual: function() {},
    throws: function() {}, doesNotThrow: function() {}, fail: function() {}
  },
  'os': {
    EOL: '\\n', arch: function() { return 'x64'; }, type: function() { return 'Nakama'; },
    release: function() { return ''; }, hostname: function() { return 'nakama'; },
    platform: function() { return 'nakama'; }, homedir: function() { return '/nakama'; },
    cpus: function() { return []; }, freemem: function() { return 0; },
    totalmem: function() { return 0; }, loadavg: function() { return [0, 0, 0]; },
    uptime: function() { return 0; }, networkInterfaces: function() { return {}; },
    userInfo: function() { return { username: 'nakama', homedir: '/nakama' }; },
    constants: {}
  },
  'path': {
    sep: '/', delimiter: '/',
    join: function() {
      var parts = [];
      for (var i = 0; i < arguments.length; i++) {
        if (arguments[i]) { parts.push(String(arguments[i])); }
      }
      return parts.join('/').replace(/\\/+/g, '/');
    },
    resolve: function() { return __builtin_shims__['path'].join.apply(null, arguments); },
    normalize: function(p) { return String(p).replace(/\\/+/g, '/'); },
    basename: function(p) {
      var s = String(p).split('/');
      return s[s.length - 1] || '';
    },
    dirname: function(p) {
      var s = String(p).split('/');
      s.pop();
      return s.join('/') || '/';
    },
    extname: function(p) {
      var b = __builtin_shims__['path'].basename(p);
      var i = b.lastIndexOf('.');
      return i < 1 ? '' : b.substring(i);
    },
    isAbsolute: function(p) { return String(p).charAt(0) === '/'; }
  },
  'url': {
    parse: function(u) {
      return { href: u, protocol: null, slashes: null, host: null,
               port: null, hostname: null, hash: null, search: null,
               query: null, pathname: u, path: u, auth: null };
    },
    format: function(o) {
      if (typeof o === 'string') { return o; }
      return (o && o.href) ? o.href : String(o);
    },
    resolve: function(from, to) { return to; }
  },
  'string_decoder': {
    StringDecoder: function() {
      this.write = function(chunk) { return String(chunk); };
      this.end = function() { return ''; };
    }
  },
  'stream': __NakamaStream,
  'fs': {
    existsSync: function() { return false; },
    statSync: function() { throw new Error('fs unavailable on nakama runtime'); },
    readFileSync: function() { throw new Error('fs unavailable on nakama runtime'); },
    writeFileSync: function() {},
    mkdirSync: function() {},
    appendFileSync: function() {},
    openSync: function() { throw new Error('fs unavailable on nakama runtime'); },
    createReadStream: function() {
      return { on: function() { return this; }, pipe: function() { return this; } };
    },
    createWriteStream: function() {
      return { write: function() { return true; }, end: function() {},
               on: function() { return this; } };
    },
    constants: {}
  },
  'net': { connect: function() { throw new Error('net unavailable'); },
           createConnection: function() { throw new Error('net unavailable'); },
           isIP: function() { return 0; } },
  'tls': { connect: function() { throw new Error('tls unavailable'); },
           createSecureContext: function() { return {}; } },
  'dns': { lookup: function() {
             var cb = arguments[arguments.length - 1];
             if (typeof cb === 'function') { cb(new Error('dns unavailable')); }
           } },
  'http': { request: function() { throw new Error('http unavailable'); },
            get: function() { throw new Error('http unavailable'); },
            Agent: function() { this.destroy = function() {}; },
            globalAgent: { destroy: function() {} } },
  'https': { request: function() { throw new Error('https unavailable'); },
             get: function() { throw new Error('https unavailable'); },
             Agent: function() { this.destroy = function() {}; },
             globalAgent: { destroy: function() {} } },
  'http2': { connect: function() { throw new Error('http2 unavailable'); } },
  'zlib': {
    deflate: function(v, cb) { cb(new Error('zlib unavailable')); },
    gzip: function(v, cb) { cb(new Error('zlib unavailable')); },
    inflate: function(v, cb) { cb(new Error('zlib unavailable')); },
    gunzip: function(v, cb) { cb(new Error('zlib unavailable')); },
    createDeflate: function() { return { on: function() { return this; } }; },
    createGunzip: function() { return { on: function() { return this; } }; }
  },
  'child_process': { exec: function() {}, execFile: function() {}, spawn: function() {},
                     fork: function() {} },
  'worker_threads': { isMainThread: true, threadId: 0, parentPort: null,
                      workerData: null },
  'async_hooks': { createHook: function() {
                     return { enable: function() {}, disable: function() {} };
                   },
                   executionAsyncId: function() { return 0; },
                   triggerAsyncId: function() { return 0; } },
  'diagnostics_channel': { channel: function() {
                               return { subscribe: function() {},
                                        publish: function() {} };
                             },
                             subscribe: function() {},
                             tracingChannel: function(nameOrChannels) {
                               function makeChannel(name) {
                                 return { name: name, hasSubscribers: false,
                                          subscribe: function() {},
                                          unsubscribe: function() {},
                                          publish: function() {},
                                          bindStore: function(s, cb) { return cb; },
                                          unbindStore: function() {},
                                          runStores: function(d, fn) { return fn(); } };
                               }
                               if (typeof nameOrChannels === 'string') {
                                 return { start: makeChannel(nameOrChannels + ':start'),
                                          end: makeChannel(nameOrChannels + ':end'),
                                          asyncStart: makeChannel(nameOrChannels + ':asyncStart'),
                                          asyncEnd: makeChannel(nameOrChannels + ':asyncEnd'),
                                          error: makeChannel(nameOrChannels + ':error') };
                               }
                               var out = {};
                               var keys = ['start', 'end', 'asyncStart', 'asyncEnd', 'error'];
                               for (var i = 0; i < keys.length; i++) {
                                 out[keys[i]] = makeChannel(
                                   nameOrChannels ? nameOrChannels[keys[i]] : undefined);
                               }
                               return out;
                             } },
  'module': { createRequire: function() {
                return function() { return {}; };
              },
              _nodeModulePaths: function() { return []; },
              builtinModules: [
                'assert', 'async_hooks', 'buffer', 'child_process', 'cluster',
                'console', 'crypto', 'diagnostics_channel', 'dns', 'events',
                'fs', 'http', 'http2', 'https', 'module', 'net', 'os', 'path',
                'perf_hooks', 'process', 'punycode', 'querystrings', 'readline',
                'repl', 'stream', 'string_decoder', 'timers', 'tls', 'tty',
                'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib'
              ] },
  'v8': { getHeapStatistics: function() { return {}; },
           getHeapCodeStatistics: function() { return {}; },
           getHeapSpaceStatistics: function() { return []; } },
  'cluster': { isWorker: false, isPrimary: true, isMaster: true,
               on: function() {}, fork: function() {} },
  'readline': {
    createInterface: function() {
      return { on: function() { return this; }, once: function() { return this; },
               close: function() {}, pause: function() {}, resume: function() {},
               write: function() {}, prompt: function() {}, setPrompt: function() {},
               question: function(q, cb) { if (typeof cb === 'function') { cb(''); } },
               line: '' };
    },
    cursorTo: function() {}, moveCursor: function() {}, clearLine: function() {},
    clearScreenDown: function() {}, emitKeypressEvents: function() {}
  },
  'inspector': {
    open: function() {}, close: function() {},
    url: function() { return undefined; },
    Session: function() {
      this.connect = function() {};
      this.disconnect = function() {};
      this.on = function() { return this; };
      this.post = function(m, p, cb) { if (typeof cb === 'function') { cb(null, {}); } };
    }
  }
};

`;

  // Prepend the wrapper to the bundle
  bundleContent = wrapper + bundleContent;

  // Append the Nakama RPC static-registration bridge (generated at build
  // time). Nakama 3.21 resolves RPC handlers BY GLOBAL NAME via static AST
  // analysis of this file: InitModule must be a top-level function whose
  // body holds direct `initializer.registerRpc('<id>', <GlobalName>)`
  // statements, and each <GlobalName> must be a global function in EVERY
  // pooled runtime at dispatch time. Two-phase bridge:
  //   1. TOP-LEVEL stub declarations (this trailer, outside InitModule) —
  //      eval() runs in every pooled runtime, so `r.Get(globalName)` always
  //      finds a callable (Nakama pools 16+ runtimes; InitModule itself runs
  //      in only the bootstrap one).
  //   2. InitModule: runs the real entry InitModule with a capturing
  //      initializer, then OVERWRITES each stub global with the real wrapped
  //      handler (requires --runtime.js_read_only_globals=false, set in
  //      docker-compose.yml), then issues the direct static registrations
  //      the parser requires. Wrappers applied at the original call sites
  //      are preserved (captured values are the wrapped functions).
  const rpcIdPatterns = [
    /registerRpc\(\s*'([^']+)'/g,
    /registerRpcWithRateLimit\(\s*initializer,\s*'([^']+)'/g,
    /registerRpcWithMetrics\(\s*initializer,\s*'([^']+)'/g,
    /registerRpcWithProfiling\(\s*initializer,\s*'([^']+)'/g,
    /registerRpcWithNPlusOneTracking\(\s*initializer,\s*'([^']+)'/g,
  ];
  const rpcIds = new Set();
  function __collectRpcIds(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') { continue; }
        __collectRpcIds(full);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        const src = fs.readFileSync(full, 'utf8');
        for (const re of rpcIdPatterns) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(src)) !== null) { rpcIds.add(m[1]); }
        }
      }
    }
  }
  __collectRpcIds(path.resolve(__dirname, '../src'));
  const rpcIdList = [...rpcIds].sort();
  const rpcGlobalFor = (id) => '__rpc_' + id.replace(/[^A-Za-z0-9_]/g, '_');
  console.log(`\nRPC bridge: ${rpcIdList.length} RPC id(s) scanned from src`);
  const rpcMapLines = rpcIdList.map((id) => `  '${id}': '${rpcGlobalFor(id)}',`).join('\n');
  const rpcStubLines = rpcIdList
    .map((id) => `globalThis.${rpcGlobalFor(id)} = function() { throw new Error('RPC ${id} was not registered by InitModule'); };`)
    .join('\n');
  const rpcDirectLines = rpcIdList
    .map((id) => `  initializer.registerRpc('${id}', ${rpcGlobalFor(id)});`)
    .join('\n');
  const rpcBridgeTrailer = `
// Nakama RPC static-registration bridge (generated at build time:
// ${rpcIdList.length} RPC ids scanned from src). See scripts/transpile-bundle.js.
var __realInitModule = (module.exports && (module.exports.InitModule || module.exports.default)) || null;
var __rpcIdToGlobal = {
${rpcMapLines}
};
var __nakamaRpcCtx = { ctx: null, logger: null, nk: null };
// Phase 1: top-level stubs — evaluated in EVERY pooled runtime.
${rpcStubLines}
// Phase 2 (eval time, runs in EVERY pooled runtime): execute the real entry
// InitModule with a capturing initializer, then overwrite each stub global
// with the real wrapped handler (requires
// --runtime.js_read_only_globals=false, set in docker-compose.yml). Pool
// runtimes never execute InitModule themselves (Nakama runs it once in the
// bootstrap runtime only), so without this the pool would keep throwing
// stubs at dispatch. Each runtime therefore performs exactly one real-init
// pass at eval; per-runtime state (caches/timers) matches Nakama's normal
// per-runtime isolation.
var __safeCtx = new Proxy({ env: {}, node: 'nakama', version: '0.0.0-eval', execution_count: 0, userId: 'eval-time', username: 'eval', session_id: 'eval', client_ip: '127.0.0.1', client_port: '0', lang: 'en' }, {
  get: function(t, k) { return (k in t) ? t[k] : (k === 'userId' ? 'eval-time' : undefined); }
});
var __safeLogger = new Proxy({}, { get: function() { return function() {}; } });
var __safeNk = new Proxy({}, { get: function() { return function() { return undefined; }; } });

function __nakamaPublishHandlers(ctx, logger, nk, initializer) {
  var __captured = [];
  var __capture = {};
  __capture.registerRpc = function(id, fn) { __captured.push([id, fn]); };
  __realInitModule(ctx, logger, nk, initializer !== undefined ? initializer : __capture);
  for (var i = 0; i < __captured.length; i++) {
    var __gname = __rpcIdToGlobal[__captured[i][0]];
    if (__gname) { globalThis[__gname] = __captured[i][1]; }
  }
  if (typeof __rpcDebugLog === 'function') { __rpcDebugLog('bridge publish done'); }
}
// Phase 3: Nakama's AST parser requires direct
// initializer.registerRpc('<id>', <GlobalName>) statements inside InitModule;
// it also runs InitModule once in the bootstrap runtime (with the REAL
// ctx/logger/nk) — re-publish there so bootstrap-context-dependent handlers
// are rebuilt with proper context.
function InitModule(ctx, logger, nk, initializer) {
  if (!__realInitModule) { throw new Error('Nakama bridge: entry module exports no InitModule'); }
  // Pass initializer so the for-loop assigns real handlers to globalThis.
  // Phase 2 (3 args): uses __capture → real handlers assigned to globalThis.
  // Phase 3 (4 args): uses real initializer → real handlers also registered with Nakama.
  __nakamaPublishHandlers(ctx, logger, nk, initializer);
${rpcDirectLines}
}
`;
  // Phase 2b (pool runtimes): publish at eval time with placeholder
  // context. In the bootstrap runtime this ALSO runs (before InitModule
  // supplies the real ctx) — the real init is then executed a second time
  // inside InitModule with the real ctx/logger/nk. Real-init side effects
  // are per-runtime, so the bootstrap runtime simply re-initializes with
  // proper context; pool runtimes keep their eval-time handlers.
const rpcEvalPublish = `
if (typeof __realInitModule === 'function') {
  try {
    __nakamaPublishHandlers(
      __safeCtx, __safeLogger, __safeNk
    );
    // Drain pending promise jobs from init (regenerator coroutines, cache
    // warmers): goja has no microtask queue, so continuations would never
    // run and un-awaited Promise results returned to Nakama are rejected
    // as non-string. Yield to the (sync) microtask queue until drained.
    if (typeof Promise !== 'undefined') {
      Promise.resolve().then(function() {});
    }
  } catch (e) {
    /* eval-time publish is best-effort: pool runtimes retry nothing, but a
       throwing init must not break eval (Nakama would drop the module). */
  }
}
`;
  bundleContent = bundleContent + rpcBridgeTrailer;
  bundleContent = bundleContent + rpcEvalPublish;


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
