#!/usr/bin/env node
/**
 * Validates the Nakama bundle for ES6+ syntax incompatibility
 * Nakama's Duktape/QuickJS runtime only supports ES5.1
 */

const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.resolve(__dirname, '../data/modules/index.js');

// ES6+ patterns that Nakama's runtime cannot parse
// Note: We check for actual code, not comments or string literals
const es6Patterns = [
  // Check for actual const/let/class declarations (not in strings or comments)
  { pattern: /^\s*const\s+[a-zA-Z_$]/, name: 'const declaration', strict: true },
  { pattern: /^\s*let\s+[a-zA-Z_$]/, name: 'let declaration', strict: true },
  { pattern: /^\s*(export\s+)?class\s+[a-zA-Z_$]/, name: 'class declaration', strict: true },
  { pattern: /^\s*async\s+[a-zA-Z_$\(\)]/, name: 'async keyword', strict: true },
  { pattern: /^\s*await\s+/, name: 'await keyword', strict: true },
  // Arrow functions: look for actual function patterns (param) => { or param =>
  { pattern: /\([^)]*\)\s*=>\s*[\{\(]/, name: 'arrow function', strict: true },
  { pattern: /[a-zA-Z_$]\s*=>\s*\{/, name: 'arrow function (single param)', strict: true },
  // Template literals with actual interpolation (not in strings)
  { pattern: /`[^`]*\$\{[^}]+\}[^`]*`/, name: 'template literal', strict: false },
];

function validateBundle() {
  if (!fs.existsSync(BUNDLE_PATH)) {
    console.error(`❌ Bundle not found at: ${BUNDLE_PATH}`);
    console.error('Run: npm run build && npx webpack --mode=production');
    process.exit(1);
  }

  const bundle = fs.readFileSync(BUNDLE_PATH, 'utf8');
  const lines = bundle.split('\n');

  let totalErrors = 0;
  const errorsByType = {};

  console.log('🔍 Validating Nakama bundle for ES5 compatibility...\n');
  console.log(`Bundle size: ${(bundle.length / 1024).toFixed(2)} KB`);
  console.log(`Total lines: ${lines.length}\n`);

  es6Patterns.forEach(({ pattern, name, strict }) => {
    let count = 0;
    const examples = [];
    let inMultilineComment = false;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Track multiline comment state
      if (trimmedLine.startsWith('/*')) {
        inMultilineComment = true;
      }
      if (trimmedLine.includes('*/')) {
        inMultilineComment = false;
        return;
      }

      // Skip single-line comments
      if (trimmedLine.startsWith('//')) return;

      // Skip multiline comments (JSDoc, etc.)
      if (inMultilineComment) return;

      // Skip lines that are entirely inside /* */ comment blocks
      if (trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) return;

      // Test the pattern
      if (pattern.test(line)) {
        count++;
        if (examples.length < 3) {
          examples.push({
            line: index + 1,
            content: line.trim().substring(0, 80),
          });
        }
      }
    });

    if (count > 0) {
      totalErrors += count;
      errorsByType[name] = count;
      console.error(`❌ ${name}: ${count} occurrences`);
      examples.forEach((ex) => {
        console.error(`   Line ${ex.line}: ${ex.content}`);
      });
    } else {
      console.log(`✅ ${name}: No occurrences`);
    }
  });

  console.log('\n' + '='.repeat(60));

  if (totalErrors > 0) {
    console.error(`\n❌ Bundle validation FAILED: ${totalErrors} ES6+ patterns found`);
    console.error('\nThese patterns are not compatible with Nakama\'s ES5.1 runtime.');
    console.error('The bundle needs to be transpiled with Babel to ES5.\n');
    process.exit(1);
  } else {
    console.log(`\n✅ Bundle validation PASSED: ES5 compatible`);
    console.log('The bundle is ready for Nakama runtime.\n');
    process.exit(0);
  }
}

validateBundle();
