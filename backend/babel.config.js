/**
 * Babel configuration for Nakama runtime compatibility
 * Transpiles ES6+ JavaScript to ES2020 for Nakama's Goja runtime.
 * Goja (Nakama 3.21) supports ES2020 natively, but we need to
 * transform the ??= operator and other ES2020+ syntax.
 *
 * IMPORTANT — ES2018+ regex lookbehind (issue #958):
 * Nakama's Goja runtime cannot parse ES2018 regex lookbehind
 * assertions (`(?<=...)` / `(?<!...)`) at evaluation time. babel-preset-env
 * 7.29 does NOT ship a transformation that downlevels them, regardless of
 * the browserslist target. We additionally rewrite any surviving lookbehind
 * regex literals at bundle post-processing time — see `scripts/transpile-bundle.js`.
 */
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          // Goja supports ES2020, but the ??= operator and nullish
          // coalescing need transpilation. Target es2020 to handle ??=
          // while avoiding the hang that ie 11 causes on large bundles.
          // Reference: issue #958, PR #920.
          esmodules: true,
        },
        modules: 'commonjs',
        // Babel 8 removed the top-level `loose` and `spec` options —
        // replaced by the granular `assumptions` block below.
        forceAllTransforms: false,
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
