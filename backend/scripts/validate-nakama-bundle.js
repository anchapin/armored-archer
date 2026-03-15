#!/usr/bin/env node
/**
 * Validates the Nakama bundle for ES6+ syntax incompatibility
 * Nakama's Duktape/QuickJS runtime only supports ES5.1
 */

const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.resolve(__dirname, '../data/modules/index.js');

// ES6+ patterns that Nakama's runtime cannot parse
const es6Patterns = [
  { pattern: /(?<!\/\/.*)\bconst\s+/g, name: 'const declaration' },
  { pattern: /(?<!\/\/.*)\blet\s+/g, name: 'let declaration' },
  { pattern: /(?<!\/\/.*)\bclass\s+/g, name: 'class declaration' },
  { pattern: /(?<!\/\/.*)\basync\s+/g, name: 'async keyword' },
  { pattern: /(?<!\/\/.*)\bawait\s+/g, name: 'await keyword' },
  { pattern: /(?<!\/\/|[^=])=>/g, name: 'arrow function' },
  { pattern: /(?<!\/\/.*)`\$\{/g, name: 'template literal' },
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

  es6Patterns.forEach(({ pattern, name }) => {
    let match;
    let count = 0;
    const examples = [];

    // Reset regex
    pattern.lastIndex = 0;

    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('//')) return;

      // Test the pattern
      const testPattern = new RegExp(pattern.source, pattern.flags);
      if (testPattern.test(line)) {
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
