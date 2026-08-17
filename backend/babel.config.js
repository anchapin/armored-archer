/**
 * Babel configuration for Nakama runtime compatibility
 * Transpiles ES6+ JavaScript to ES5 for Nakama's Duktape/QuickJS runtime.
 * Uses loose mode to inline helpers instead of requiring @babel/runtime.
 *
 * IMPORTANT — ES2018+ regex lookbehind (issue #958):
 * Nakama's Duktape/QuickJS runtime cannot parse ES2018 regex lookbehind
 * assertions (`(?<=...)` / `(?<!...)`) at evaluation time. babel-preset-env
 * 7.29 does NOT ship a transformation that downlevels them, regardless of
 * the browserslist target (even `ie 11` leaves lookbehind literals intact —
 * verified against @babel/preset-env 7.29.3). We therefore tighten the
 * browserslist target to `ie 11` to maximise downleveling of everything
 * else (the previous `esmodules: false` target was too permissive), and
 * additionally rewrite any surviving lookbehind regex literals at bundle
 * post-processing time — see `scripts/transpile-bundle.js`.
 */
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          // Target Duktape/QuickJS in Nakama 3.21 (≈ ES5.1 + limited ES2015).
          // `ie 11` is the closest browserslist analog for an ES5.1 runtime
          // and is the lowest-cost target that forces preset-env to
          // downlevel arrow fns / async-await / template literals, etc.
          // `not supports js-regexp-lookbehind` (caniuse feature id) is
          // included so future preset-env versions that gain a lookbehind
          // transform will engage it. Reference: issue #958, PR #920.
          browsers: ['ie 11', 'not supports js-regexp-lookbehind'],
        },
        modules: 'commonjs',
        // Babel 8 removed the top-level `loose` and `spec` options —
        // replaced by the granular `assumptions` block below.
        forceAllTransforms: true,
      },
    ],
  ],
  // Don't use @babel/plugin-transform-runtime - it requires external @babel/runtime
  // Loose mode will inline all helpers directly into the bundle
  assumptions: {
    // Loose mode assumptions for smaller output
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
};
