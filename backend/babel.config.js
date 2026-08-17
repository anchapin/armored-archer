/**
 * Babel configuration for Nakama runtime compatibility
 * Transpiles ES6+ JavaScript to ES5 for Nakama's Duktape/QuickJS runtime
 * Uses loose mode to inline helpers instead of requiring @babel/runtime
 */
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          // Target ES5.1 for Nakama compatibility
          esmodules: false,
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
