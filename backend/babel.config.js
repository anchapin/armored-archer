/**
 * Babel configuration for Nakama runtime compatibility
 * Transpiles ES6+ JavaScript to ES5.1 for Nakama's Goja runtime.
 * Goja (Nakama 3.21) does NOT support ES2015+ syntax natively —
 * output must be ES5.1-compatible (var, function expressions, ES5 classes).
 *
 * IMPORTANT — ES2018+ regex lookbehind (issue #958):
 * Nakama's Goja runtime cannot parse ES2018 regex lookbehind
 * assertions (`(?<=...)` / `(?<!...)`) at evaluation time. babel-preset-env
 * 7.29 does NOT ship a transformation that downlevels them, regardless of
 * the browserslist target. We additionally rewrite any surviving lookbehind
 * regex literals at bundle post-processing time — see `scripts/transpile-bundle.js`.
 *
 * IMPORTANT — ES2020 operators (issue #1331):
 * Goja supports ES2020 syntax (arrow fns, async/await, destructuring) but
 * does NOT support nullish coalescing (??/?=) or optional chaining (?.).
 * We target IE 11 to force ALL modern syntax to ES5.1, including these.
 * This also ensures the transpile-bundle.js CLI step produces Goja-compatible
 * output (transpile-bundle.js uses babel.config.js directly).
 * Reference: issue #1331.
 */
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          // Target IE 11 to force ALL modern syntax to ES5.1. This ensures:
          // 1. async/await → generator functions (regenerator)
          // 2. ?? / ??= / ?.(?. ) → ES5 alternatives
          // 3. const/let → var
          // 4. arrow functions → function expressions
          // 5. classes → constructor functions
          // Reference: issue #1331.
          ie: '11',
        },
        modules: 'commonjs',
        // Babel 8 removed the top-level `loose` and `spec` options —
        // replaced by the granular `assumptions` block below.
        // NOTE: forceAllTransforms is intentionally omitted so preset-env
        // uses its normal intelligent transform selection per target.
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
